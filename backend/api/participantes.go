package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/aomenos1km/app-web/db"
	"github.com/aomenos1km/app-web/models"
	"github.com/gin-gonic/gin"
)

// ListarParticipantes retorna todos os participantes de um contrato
func ListarParticipantes(c *gin.Context) {
	contratoID := c.Param("id")
	authUser := getAuthzUser(c)
	ctx := c.Request.Context()
	consultorResponsavelEvento := authUser.IsAdmin()
	if !authUser.IsAdmin() && !authUser.IsConsultor() {
		canAccess, err := canAccessContrato(ctx, authUser, contratoID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
			return
		}
		if !canAccess {
			rejectForbidden(c, "Você não tem permissão para ver participantes deste evento")
			return
		}
	}
	if authUser.IsConsultor() {
		var consultor string
		err := db.Pool.QueryRow(ctx, `SELECT COALESCE(consultor, '') FROM contratos WHERE id = $1`, contratoID).Scan(&consultor)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
			return
		}
		consultorResponsavelEvento = namesMatch(consultor, authUser.Nome)
	}

	rows, err := db.Pool.Query(ctx, `
		SELECT id,
		       contrato_id,
		       COALESCE(nome, ''),
		       COALESCE(whatsapp, ''),
		       COALESCE(email, ''),
		       COALESCE(tamanho_camiseta, ''),
		       COALESCE(modalidade, ''),
		       data_inscricao,
		       COALESCE(cpf, ''),
		       nascimento::text,
		       COALESCE(cidade, ''),
		       COALESCE(modalidade_distancia, ''),
		       COALESCE(tempo_pratica, ''),
		       COALESCE(tem_assessoria, ''),
		       COALESCE(objetivo, ''),
		       COALESCE(apto_fisico, false),
		       COALESCE(termo_responsabilidade, false),
		       COALESCE(uso_imagem, false),
		       COALESCE(interesse_assessoria, false),
		       COALESCE(formato_interesse, ''),
		       COALESCE(como_conheceu, ''),
		       COALESCE(observacoes, ''),
		       COALESCE(uf, ''),
		       COALESCE(comprovante_url, ''),
		       COALESCE(status_pagamento, ''),
		       numero_kit,
		       criado_em,
		       atualizado_em
		FROM participantes
		WHERE contrato_id = $1
		ORDER BY nome ASC
	`, contratoID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	defer rows.Close()

	var lista []models.Participante
	for rows.Next() {
		var p models.Participante
		err := rows.Scan(
			&p.ID, &p.ContratoID, &p.Nome, &p.Whatsapp, &p.Email,
			&p.TamanhoCamiseta, &p.Modalidade, &p.DataInscricao,
			&p.CPF, &p.Nascimento, &p.Cidade, &p.ModalidadeDistancia, &p.TempoPratica,
			&p.TemAssessoria, &p.Objetivo, &p.AptoFisico, &p.TermoResponsabilidade,
			&p.UsoImagem, &p.InteresseAssessoria, &p.FormatoInteresse, &p.ComoConheceu,
			&p.Observacoes, &p.UF, &p.ComprovanteURL, &p.StatusPagamento,
			&p.NumeroKit, &p.CriadoEm, &p.AtualizadoEm,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: fmt.Sprintf("erro ao ler participante: %v", err)})
			return
		}
		if authUser.IsConsultor() && !consultorResponsavelEvento {
			p.Whatsapp = ""
			p.Email = ""
			p.ComprovanteURL = ""
		}
		lista = append(lista, p)
	}

	if err := rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	if lista == nil {
		lista = []models.Participante{}
	}

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: lista})
}

func empresaEhAomenos1km(empresaNome string) bool {
	normalized := strings.ToLower(strings.TrimSpace(empresaNome))
	normalized = strings.ReplaceAll(normalized, " ", "")
	normalized = strings.ReplaceAll(normalized, "-", "")
	normalized = strings.ReplaceAll(normalized, "_", "")
	return strings.Contains(normalized, "aomenos1km")
}

func eventoRequerPagamento(empresaNome string, precoIngresso float64) bool {
	if precoIngresso <= 0 {
		return false
	}
	return empresaEhAomenos1km(empresaNome)
}

// CriarParticipante realiza o check-in de um participante (rota pública via token do evento)
func CriarParticipante(c *gin.Context) {
	var input models.ParticipanteInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	// Valida se o contrato existe e tem vagas
	var qtdContratada int
	var precoIngresso float64
	var empresaNome string
	var nomeEvento string
	var descricaoContrato string
	var dataEvento *string
	err := db.Pool.QueryRow(context.Background(),
		`SELECT qtd_contratada,
		        COALESCE(preco_ingresso, 0),
		        COALESCE(empresa_nome, ''),
		        COALESCE(nome_evento, ''),
		        COALESCE(descricao, ''),
		        data_evento::text
		 FROM contratos
		 WHERE id = $1`, input.ContratoID,
	).Scan(&qtdContratada, &precoIngresso, &empresaNome, &nomeEvento, &descricaoContrato, &dataEvento)
	if err != nil {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: "Evento não encontrado"})
		return
	}
	eventoPago := eventoRequerPagamento(empresaNome, precoIngresso)

	var inscritos int
	inscritosQuery := `SELECT COUNT(*) FROM participantes WHERE contrato_id = $1`
	if eventoPago {
		inscritosQuery = `
			SELECT COUNT(*)
			FROM participantes
			WHERE contrato_id = $1
			  AND COALESCE(status_pagamento, '') = 'Confirmado'
		`
	}
	_ = db.Pool.QueryRow(context.Background(), inscritosQuery, input.ContratoID).Scan(&inscritos)

	if inscritos >= qtdContratada {
		c.JSON(http.StatusConflict, models.APIResponse{
			Success: false,
			Error:   "Evento lotado. Não há mais vagas disponíveis.",
		})
		return
	}

	// Evita duplicidade pelo CPF no mesmo evento
	var existente int
	_ = db.Pool.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM participantes WHERE contrato_id = $1 AND cpf = $2`,
		input.ContratoID, input.CPF,
	).Scan(&existente)

	if existente > 0 {
		c.JSON(http.StatusConflict, models.APIResponse{
			Success: false,
			Error:   "Este CPF já está registrado neste evento.",
		})
		return
	}

	// Converte nascimento "YYYY-MM-DD" → date
	var nascimento interface{}
	if input.Nascimento != "" {
		nascimento = input.Nascimento
	}

	var id string
	statusPagamento := "Confirmado"
	if eventoPago {
		statusPagamento = "Pendente"
	}
	err = db.Pool.QueryRow(context.Background(), `
		INSERT INTO participantes (
			contrato_id, nome, whatsapp, email, tamanho_camiseta, modalidade,
			cpf, nascimento, cidade, modalidade_distancia, tempo_pratica,
			tem_assessoria, objetivo, apto_fisico, termo_responsabilidade,
			uso_imagem, interesse_assessoria, formato_interesse, como_conheceu,
			observacoes, uf, comprovante_url, status_pagamento
		) VALUES (
			$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23
		) RETURNING id`,
		input.ContratoID, input.Nome, input.Whatsapp, input.Email, input.TamanhoCamiseta, input.Modalidade,
		input.CPF, nascimento, input.Cidade, input.ModalidadeDistancia, input.TempoPratica,
		input.TemAssessoria, input.Objetivo, input.AptoFisico, input.TermoResponsabilidade,
		input.UsoImagem, input.InteresseAssessoria, input.FormatoInteresse, input.ComoConheceu,
		input.Observacoes, input.UF, input.ComprovanteURL, statusPagamento,
	).Scan(&id)

	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	checkoutURL := ""
	if eventoPago {
		checkoutURL, err = gerarCheckoutAsaas(input, precoIngresso, empresaNome, nomeEvento, id, dataEvento)
		if err != nil {
			_, _ = db.Pool.Exec(context.Background(), `DELETE FROM participantes WHERE id = $1`, id)
			c.JSON(http.StatusBadGateway, models.APIResponse{Success: false, Error: "Falha ao gerar pagamento. Tente novamente em instantes."})
			return
		}
		_, _ = db.Pool.Exec(context.Background(), `UPDATE participantes SET comprovante_url = $1 WHERE id = $2`, checkoutURL, id)
	}

	// Dispara notificações assíncronas de ocupação
	if !eventoPago {
		novoTotal := inscritos + 1
		go dispararNotificacaoOcupacao(input.ContratoID, empresaNome, nomeEvento, descricaoContrato, novoTotal, qtdContratada)
	}
	publishParticipantesAtualizados(input.ContratoID, id, "criado")

	// Envia confirmação via WhatsApp para o participante
	if input.Whatsapp != "" {
		go enviarWhatsAppParticipante(input.Nome, input.Whatsapp)
	}

	c.JSON(http.StatusCreated, models.APIResponse{
		Success: true,
		Message: "Inscrição realizada com sucesso!",
		Data:    gin.H{"id": id, "checkout_url": checkoutURL},
	})
}

type asaasCustomer struct {
	ID string `json:"id"`
}

type asaasListCustomersResponse struct {
	Data []asaasCustomer `json:"data"`
}

type asaasPaymentResponse struct {
	InvoiceURL            string `json:"invoiceUrl"`
	TransactionReceiptURL string `json:"transactionReceiptUrl"`
}

type asaasErrorResponse struct {
	Errors []struct {
		Description string `json:"description"`
	} `json:"errors"`
}

func shouldLogAsaasDescription() bool {
	// Chave explícita para debug pontual local.
	if v := strings.ToLower(strings.TrimSpace(os.Getenv("ASAAS_DEBUG_DESCRIPTION"))); v == "1" || v == "true" || v == "yes" {
		return true
	}

	appEnv := strings.ToLower(strings.TrimSpace(os.Getenv("APP_ENV")))
	goEnv := strings.ToLower(strings.TrimSpace(os.Getenv("GO_ENV")))
	ginMode := strings.ToLower(strings.TrimSpace(os.Getenv("GIN_MODE")))

	if appEnv == "production" || goEnv == "production" || ginMode == "release" {
		return false
	}

	return appEnv == "dev" || appEnv == "development" || goEnv == "dev" || goEnv == "development" || ginMode == "debug" || ginMode == ""
}

func gerarCheckoutAsaas(input models.ParticipanteInput, valor float64, empresaNome, nomeEvento, participanteID string, dataEvento *string) (string, error) {
	apiKey := strings.TrimSpace(os.Getenv("ASAAS_API_KEY"))
	if apiKey == "" {
		return "", fmt.Errorf("ASAAS_API_KEY não configurada")
	}

	baseURL := strings.TrimSpace(os.Getenv("ASAAS_BASE_URL"))
	if baseURL == "" {
		baseURL = "https://api-sandbox.asaas.com"
	}

	customerID, err := buscarOuCriarClienteAsaas(baseURL, apiKey, input, participanteID)
	if err != nil {
		return "", err
	}

	dueDate := time.Now().AddDate(0, 0, 1).Format("2006-01-02")
	if dataEvento != nil && *dataEvento != "" {
		if dt, parseErr := time.Parse("2006-01-02", strings.TrimSpace(*dataEvento)); parseErr == nil {
			if dt.After(time.Now()) {
				dueDate = dt.Format("2006-01-02")
			}
		}
	}

	evento := strings.TrimSpace(nomeEvento)
	if evento == "" {
		evento = strings.TrimSpace(empresaNome)
	}
	if evento == "" {
		evento = "Evento"
	}
	dataEventoDescricao := "-"
	if dataEvento != nil {
		rawData := strings.TrimSpace(*dataEvento)
		if rawData != "" {
			if dt, parseErr := time.Parse("2006-01-02", rawData); parseErr == nil {
				dataEventoDescricao = dt.Format("02/01/2006")
			} else {
				dataEventoDescricao = rawData
			}
		}
	}
	nomeParticipante := strings.TrimSpace(input.Nome)
	if nomeParticipante == "" {
		nomeParticipante = "Participante"
	}
	// Cada informação fica em sua própria linha para melhorar leitura no Asaas.
	descricao := strings.TrimSpace(fmt.Sprintf(
		"Evento: %s\nData Evento: %s\nQtd Ingresso: 1\nParticipante: %s",
		evento,
		dataEventoDescricao,
		nomeParticipante,
	))
	if len(descricao) > 500 {
		descricao = descricao[:500]
	}
	if shouldLogAsaasDescription() {
		fmt.Printf("[ASAAS DEBUG] participante=%s descricao=%q\n", participanteID, descricao)
	}

	payload := map[string]any{
		"customer":          customerID,
		"billingType":       "UNDEFINED",
		"value":             valor,
		"dueDate":           dueDate,
		"description":       descricao,
		"externalReference": participanteID,
	}

	body, status, err := asaasRequest("POST", baseURL+"/v3/payments", apiKey, payload)
	if err != nil {
		return "", err
	}
	if status < 200 || status >= 300 {
		return "", fmt.Errorf("ASAAS payments status %d: %s", status, extrairErroAsaas(body))
	}

	var pagamento asaasPaymentResponse
	if err := json.Unmarshal(body, &pagamento); err != nil {
		return "", fmt.Errorf("erro ao interpretar resposta ASAAS: %w", err)
	}
	if strings.TrimSpace(pagamento.InvoiceURL) == "" {
		return "", fmt.Errorf("ASAAS não retornou invoiceUrl")
	}

	return pagamento.InvoiceURL, nil
}

func buscarOuCriarClienteAsaas(baseURL, apiKey string, input models.ParticipanteInput, participanteID string) (string, error) {
	cpf := somenteDigitos(input.CPF)
	if cpf == "" {
		return "", fmt.Errorf("CPF obrigatório para cobrança ASAAS")
	}

	getURL := fmt.Sprintf("%s/v3/customers?cpfCnpj=%s", baseURL, cpf)
	body, status, err := asaasRequest("GET", getURL, apiKey, nil)
	if err != nil {
		return "", err
	}
	if status >= 200 && status < 300 {
		var lista asaasListCustomersResponse
		if err := json.Unmarshal(body, &lista); err == nil && len(lista.Data) > 0 && strings.TrimSpace(lista.Data[0].ID) != "" {
			return lista.Data[0].ID, nil
		}
	}

	payload := map[string]any{
		"name":              strings.TrimSpace(input.Nome),
		"cpfCnpj":           cpf,
		"email":             strings.TrimSpace(input.Email),
		"mobilePhone":       somenteDigitos(input.Whatsapp),
		"externalReference": participanteID,
	}
	body, status, err = asaasRequest("POST", baseURL+"/v3/customers", apiKey, payload)
	if err != nil {
		return "", err
	}
	if status < 200 || status >= 300 {
		return "", fmt.Errorf("ASAAS customers status %d: %s", status, extrairErroAsaas(body))
	}

	var cliente asaasCustomer
	if err := json.Unmarshal(body, &cliente); err != nil {
		return "", fmt.Errorf("erro ao interpretar cliente ASAAS: %w", err)
	}
	if strings.TrimSpace(cliente.ID) == "" {
		return "", fmt.Errorf("ASAAS não retornou customer id")
	}

	return cliente.ID, nil
}

func asaasRequest(method, url, apiKey string, payload any) ([]byte, int, error) {
	var bodyReader io.Reader
	if payload != nil {
		raw, err := json.Marshal(payload)
		if err != nil {
			return nil, 0, err
		}
		bodyReader = bytes.NewBuffer(raw)
	}

	req, err := http.NewRequest(method, url, bodyReader)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("accept", "application/json")
	req.Header.Set("content-type", "application/json")
	req.Header.Set("access_token", apiKey)

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, err
	}
	return body, resp.StatusCode, nil
}

func extrairErroAsaas(body []byte) string {
	var errBody asaasErrorResponse
	if err := json.Unmarshal(body, &errBody); err == nil && len(errBody.Errors) > 0 {
		return strings.TrimSpace(errBody.Errors[0].Description)
	}
	return strings.TrimSpace(string(body))
}

func somenteDigitos(value string) string {
	var b strings.Builder
	for _, r := range value {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

// EditarParticipante permite editar dados de um participante
func EditarParticipante(c *gin.Context) {
	id := c.Param("id")
	authUser := getAuthzUser(c)
	ctx := c.Request.Context()
	if !authUser.IsAdmin() {
		canAccess, err := canAccessParticipante(ctx, authUser, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
			return
		}
		if !canAccess {
			rejectForbidden(c, "Você não tem permissão para editar participantes deste evento")
			return
		}
	}
	var input models.ParticipanteEdicao
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	var contratoID string
	err := db.Pool.QueryRow(ctx, `SELECT contrato_id FROM participantes WHERE id = $1`, id).Scan(&contratoID)
	if err != nil {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: "Participante não encontrado"})
		return
	}

	result, err := db.Pool.Exec(ctx, `
		UPDATE participantes SET
			nome = $1,
			cpf = $2,
			nascimento = NULLIF($3, '')::date,
			whatsapp = $4,
			email = $5,
			cidade = $6,
			uf = $7,
			tamanho_camiseta = $8,
			modalidade = $9,
			modalidade_distancia = $10,
			tempo_pratica = $11,
			tem_assessoria = $12,
			objetivo = $13,
			apto_fisico = $14,
			termo_responsabilidade = $15,
			uso_imagem = $16,
			interesse_assessoria = $17,
			formato_interesse = $18,
			como_conheceu = $19,
			observacoes = $20,
			numero_kit = $21,
			status_pagamento = $22,
			comprovante_url = $23,
			atualizado_em = NOW()
		WHERE id = $24`,
		input.Nome, input.CPF, input.Nascimento, input.Whatsapp, input.Email,
		input.Cidade, input.UF, input.TamanhoCamiseta, input.Modalidade,
		input.ModalidadeDistancia, input.TempoPratica, input.TemAssessoria, input.Objetivo,
		input.AptoFisico, input.TermoResponsabilidade, input.UsoImagem, input.InteresseAssessoria,
		input.FormatoInteresse, input.ComoConheceu, input.Observacoes, input.NumeroKit,
		input.StatusPagamento, input.ComprovanteURL,
		id,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	if result.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: "Participante não encontrado"})
		return
	}
	publishParticipantesAtualizados(contratoID, id, "editado")

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Message: "Participante atualizado"})
}

// DeletarParticipante remove um participante
func DeletarParticipante(c *gin.Context) {
	id := c.Param("id")
	authUser := getAuthzUser(c)
	ctx := c.Request.Context()
	if !authUser.IsAdmin() {
		canAccess, err := canAccessParticipante(ctx, authUser, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
			return
		}
		if !canAccess {
			rejectForbidden(c, "Você não tem permissão para remover participantes deste evento")
			return
		}
	}
	var contratoID string
	err := db.Pool.QueryRow(ctx, `SELECT contrato_id FROM participantes WHERE id = $1`, id).Scan(&contratoID)
	if err != nil {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: "Participante não encontrado"})
		return
	}
	result, err := db.Pool.Exec(ctx,
		`DELETE FROM participantes WHERE id = $1`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	if result.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: "Participante não encontrado"})
		return
	}
	publishParticipantesAtualizados(contratoID, id, "removido")

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Message: "Participante removido"})
}

// HistoricoParticipantes retorna todos os participantes de todos os eventos com filtros
func HistoricoParticipantes(c *gin.Context) {
	busca := c.Query("q")
	authUser := getAuthzUser(c)
	query := `
		SELECT p.id, p.contrato_id, p.nome, p.whatsapp, p.email,
		       p.tamanho_camiseta, p.modalidade, p.data_inscricao,
		       p.cpf, p.cidade, p.uf, p.status_pagamento, p.criado_em,
		       c.nome_evento, c.empresa_nome, c.data_evento
		FROM participantes p
		LEFT JOIN contratos c ON c.id = p.contrato_id
		WHERE 1=1`

	args := []interface{}{}
	if busca != "" {
		query += fmt.Sprintf(" AND (p.nome ILIKE $%d OR p.email ILIKE $%d OR p.cpf ILIKE $%d OR p.whatsapp ILIKE $%d)",
			1, 2, 3, 4)
		like := "%" + busca + "%"
		args = append(args, like, like, like, like)
	}

	if !authUser.IsAdmin() {
		query += fmt.Sprintf(" AND c.consultor ILIKE $%d", len(args)+1)
		args = append(args, strings.TrimSpace(authUser.Nome))
	}

	query += " ORDER BY p.criado_em DESC LIMIT 500"

	rows, err := db.Pool.Query(context.Background(), query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	defer rows.Close()

	type PartCompleto struct {
		models.Participante
		NomeEvento  string  `json:"nome_evento"`
		EmpresaNome string  `json:"empresa_nome"`
		DataEvento  *string `json:"data_evento"`
	}

	var lista []PartCompleto
	for rows.Next() {
		var p PartCompleto
		err := rows.Scan(
			&p.ID, &p.ContratoID, &p.Nome, &p.Whatsapp, &p.Email,
			&p.TamanhoCamiseta, &p.Modalidade, &p.DataInscricao,
			&p.CPF, &p.Cidade, &p.UF, &p.StatusPagamento, &p.CriadoEm,
			&p.NomeEvento, &p.EmpresaNome, &p.DataEvento,
		)
		if err != nil {
			continue
		}
		lista = append(lista, p)
	}

	if lista == nil {
		lista = []PartCompleto{}
	}

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: lista})
}

// ─── Helpers internos ────────────────────────────────────────────────────────

func montarContextoNotificacaoEvento(contratoID, empresaNome, nomeEvento, descricaoContrato string) string {
	empresa := strings.TrimSpace(empresaNome)
	evento := strings.TrimSpace(nomeEvento)
	descricao := strings.TrimSpace(descricaoContrato)

	// Fallback defensivo: se vierem vazios, tenta buscar no contrato por ID.
	if empresa == "" || (evento == "" && descricao == "") {
		var empresaDB, eventoDB, descricaoDB string
		err := db.Pool.QueryRow(context.Background(), `
			SELECT COALESCE(empresa_nome, ''), COALESCE(nome_evento, ''), COALESCE(descricao, '')
			FROM contratos
			WHERE id = $1
		`, contratoID).Scan(&empresaDB, &eventoDB, &descricaoDB)
		if err == nil {
			if empresa == "" {
				empresa = strings.TrimSpace(empresaDB)
			}
			if evento == "" {
				evento = strings.TrimSpace(eventoDB)
			}
			if descricao == "" {
				descricao = strings.TrimSpace(descricaoDB)
			}
		}
	}

	eventoBase := evento
	if eventoBase == "" {
		eventoBase = descricao
	}

	if empresa != "" && eventoBase != "" {
		return fmt.Sprintf("%s - %s", empresa, eventoBase)
	}
	if empresa != "" {
		return empresa
	}
	if eventoBase != "" {
		return eventoBase
	}

	if len(contratoID) >= 8 {
		return fmt.Sprintf("Evento (%s)", contratoID[:8])
	}
	return "Evento"
}

func notificarOcupacaoAtualContrato(contratoID string) {
	var qtdContratada int
	var precoIngresso float64
	var empresaNome, nomeEvento, descricaoContrato string
	err := db.Pool.QueryRow(context.Background(), `
		SELECT
			qtd_contratada,
			COALESCE(preco_ingresso, 0),
			COALESCE(empresa_nome, ''),
			COALESCE(nome_evento, ''),
			COALESCE(descricao, '')
		FROM contratos
		WHERE id = $1
	`, contratoID).Scan(&qtdContratada, &precoIngresso, &empresaNome, &nomeEvento, &descricaoContrato)
	if err != nil || qtdContratada == 0 {
		return
	}

	inscritosQuery := `SELECT COUNT(*) FROM participantes WHERE contrato_id = $1`
	if eventoRequerPagamento(empresaNome, precoIngresso) {
		inscritosQuery = `
			SELECT COUNT(*)
			FROM participantes
			WHERE contrato_id = $1
			  AND COALESCE(status_pagamento, '') = 'Confirmado'
		`
	}

	var inscritos int
	if err := db.Pool.QueryRow(context.Background(), inscritosQuery, contratoID).Scan(&inscritos); err != nil {
		return
	}

	dispararNotificacaoOcupacao(contratoID, empresaNome, nomeEvento, descricaoContrato, inscritos, qtdContratada)
}

// dispararNotificacaoOcupacao cria notificação interna e dispara WhatsApp para admin
func dispararNotificacaoOcupacao(contratoID string, empresaNome, nomeEvento, descricaoContrato string, inscritos, total int) {
	if total == 0 {
		return
	}
	pct := (inscritos * 100) / total

	var titulo, mensagem string
	contexto := montarContextoNotificacaoEvento(contratoID, empresaNome, nomeEvento, descricaoContrato)

	switch {
	case inscritos == 1:
		titulo = "🚀 Lista Aberta!"
		mensagem = fmt.Sprintf("%s — Primeiro check-in realizado (1/%d).", contexto, total)
	case pct == 30:
		titulo = "👍 30%% das vagas preenchidas"
		mensagem = fmt.Sprintf("%s — %d/%d vagas ocupadas.", contexto, inscritos, total)
	case pct == 50:
		titulo = "🔥 Metade da lista!"
		mensagem = fmt.Sprintf("%s — 50%% de ocupação (%d/%d).", contexto, inscritos, total)
	case pct == 70:
		titulo = "📈 Alta Adesão: 70%%"
		mensagem = fmt.Sprintf("%s — 70%% das vagas (%d/%d).", contexto, inscritos, total)
	case pct == 90:
		titulo = "⚠️ Quase lotado: 90%%"
		mensagem = fmt.Sprintf("%s — Restam apenas 10%% das vagas (%d/%d).", contexto, inscritos, total)
	case inscritos >= total:
		titulo = "⛔ LOTAÇÃO MÁXIMA"
		mensagem = fmt.Sprintf("%s — Todas as %d vagas foram preenchidas!", contexto, total)
	default:
		return
	}

	_, _ = criarNotificacao(
		context.Background(),
		titulo,
		mensagem,
		"warning",
		&contratoID,
		nil,
		"Sistema",
		"Automação",
	)

	adminNum := os.Getenv("WHATSAPP_ADMIN_NUMBER")
	if adminNum != "" {
		_ = enviarWhatsApp(adminNum, fmt.Sprintf("*%s*\n%s\nEvento: %s", titulo, mensagem, contratoID))
	}
}

// enviarWhatsAppParticipante envia mensagem de confirmação para quem acabou de se inscrever
func enviarWhatsAppParticipante(nome, numero string) {
	msg := fmt.Sprintf(
		"Olá *%s*! ✅\n\nSua inscrição foi confirmada com sucesso.\n\nAomenos1km 🏃",
		nome,
	)
	_ = enviarWhatsApp(numero, msg)
}

// ─── Verificação de Pagamento ────────────────────────────────────────────────

type asaasPaymentData struct {
	ID                    string `json:"id"`
	Status                string `json:"status"`
	InvoiceURL            string `json:"invoiceUrl"`
	TransactionReceiptURL string `json:"transactionReceiptUrl"`
}

type asaasPaymentsListResponse struct {
	Data []asaasPaymentData `json:"data"`
}

func statusAsaasPago(status string) bool {
	s := strings.ToUpper(strings.TrimSpace(status))
	return s == "CONFIRMED" || s == "RECEIVED" || s == "RECEIVED_IN_CASH"
}

// VerificarStatusPagamento verifica o status de pagamento de um participante
func VerificarStatusPagamento(c *gin.Context) {
	participanteID := c.Param("id")
	if participanteID == "" {
		c.JSON(400, models.APIResponse{Success: false, Error: "ID do participante obrigatório"})
		return
	}

	// Busca o participante
	var contratID, statusAtual, nome, whatsapp, comprovanteAtual string
	err := db.Pool.QueryRow(context.Background(), `
		SELECT contrato_id, status_pagamento, nome, whatsapp, COALESCE(comprovante_url, '')
		FROM participantes
		WHERE id = $1`,
		participanteID,
	).Scan(&contratID, &statusAtual, &nome, &whatsapp, &comprovanteAtual)
	if err != nil {
		c.JSON(404, models.APIResponse{Success: false, Error: "Participante não encontrado"})
		return
	}

	// Se já confirmado, retorna sucesso
	if statusAtual == "Confirmado" {
		c.JSON(200, models.APIResponse{Success: true, Data: gin.H{"status": "Confirmado", "comprovante_url": comprovanteAtual, "pagamento_confirmado": true}})
		return
	}

	// Verifica o status do pagamento na Asaas
	statusAsaas, comprovanteURL, err := verificarPagamentoNaAsaas(participanteID)
	if err != nil {
		// Se falhar na Asaas, retorna o status atual
		c.JSON(200, models.APIResponse{Success: true, Data: gin.H{"status": statusAtual, "comprovante_url": comprovanteAtual, "pagamento_confirmado": false}})
		return
	}

	// Se pagamento foi confirmado na Asaas, atualiza no BD
	pagamentoConfirmado := statusAsaasPago(statusAsaas)
	if pagamentoConfirmado {
		if strings.TrimSpace(comprovanteURL) == "" {
			comprovanteURL = comprovanteAtual
		}
		_, _ = db.Pool.Exec(context.Background(), `
			UPDATE participantes SET
				status_pagamento = 'Confirmado',
				comprovante_url = CASE WHEN $2 <> '' THEN $2 ELSE comprovante_url END,
				atualizado_em = NOW()
			WHERE id = $1`, participanteID, comprovanteURL,
		)
		publishParticipantesAtualizados(contratID, participanteID, "pagamento_confirmado")
		go notificarOcupacaoAtualContrato(contratID)

		// Envia WhatsApp atualizando que pagamento foi confirmado
		if whatsapp != "" {
			msg := fmt.Sprintf(
				"Olá *%s*! ✅\n\nSua inscrição foi *confirmada com sucesso* após a validação do pagamento.\n\nAomenos1km 🏃",
				nome,
			)
			_ = enviarWhatsApp(whatsapp, msg)
		}
	}

	if strings.TrimSpace(comprovanteURL) == "" {
		comprovanteURL = comprovanteAtual
	}

	c.JSON(200, models.APIResponse{Success: true, Data: gin.H{"status": statusAsaas, "comprovante_url": comprovanteURL, "pagamento_confirmado": pagamentoConfirmado}})
}

func verificarPagamentoNaAsaas(participanteID string) (string, string, error) {
	apiKey := strings.TrimSpace(os.Getenv("ASAAS_API_KEY"))
	if apiKey == "" {
		return "", "", fmt.Errorf("ASAAS_API_KEY não configurada")
	}

	baseURL := strings.TrimSpace(os.Getenv("ASAAS_BASE_URL"))
	if baseURL == "" {
		baseURL = "https://api-sandbox.asaas.com"
	}

	url := fmt.Sprintf("%s/v3/payments?externalReference=%s", baseURL, participanteID)
	body, status, err := asaasRequest("GET", url, apiKey, nil)
	if err != nil {
		return "", "", err
	}

	if status < 200 || status >= 300 {
		return "", "", fmt.Errorf("ASAAS returned status %d", status)
	}

	var lista asaasPaymentsListResponse
	if err := json.Unmarshal(body, &lista); err != nil {
		return "", "", fmt.Errorf("erro ao parse resposta ASAAS: %w", err)
	}

	// Busca o primeiro pagamento que não está recusado
	for _, p := range lista.Data {
		if p.Status != "DECLINED" && p.Status != "DELETED" {
			comprovanteURL := strings.TrimSpace(p.TransactionReceiptURL)
			if comprovanteURL == "" {
				comprovanteURL = strings.TrimSpace(p.InvoiceURL)
			}
			return p.Status, comprovanteURL, nil
		}
	}

	// Se houver paymentId correspondente, retorna o status do primeiro
	if len(lista.Data) > 0 {
		comprovanteURL := strings.TrimSpace(lista.Data[0].TransactionReceiptURL)
		if comprovanteURL == "" {
			comprovanteURL = strings.TrimSpace(lista.Data[0].InvoiceURL)
		}
		return lista.Data[0].Status, comprovanteURL, nil
	}

	return "PENDING", "", nil
}
