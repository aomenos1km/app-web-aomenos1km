package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/aomenos1km/app-web/db"
	"github.com/aomenos1km/app-web/models"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

const (
	statusRascunho   = "Rascunho"
	statusFinalizada = "Finalizada"
	statusEnviada    = "Enviada"
	statusConvertida = "Convertida"
)

func normalizePropostaStatus(raw string) string {
	status := strings.TrimSpace(raw)
	if status == "" {
		return ""
	}
	if strings.EqualFold(status, statusRascunho) {
		return statusRascunho
	}
	if strings.EqualFold(status, statusFinalizada) {
		return statusFinalizada
	}
	if strings.EqualFold(status, statusEnviada) {
		return statusEnviada
	}
	if strings.EqualFold(status, statusConvertida) {
		return statusConvertida
	}
	return ""
}

func empresaEhAomenos1kmProposta(empresaNome string) bool {
	normalized := strings.ToLower(strings.TrimSpace(empresaNome))
	normalized = strings.ReplaceAll(normalized, " ", "")
	normalized = strings.ReplaceAll(normalized, "-", "")
	normalized = strings.ReplaceAll(normalized, "_", "")
	return strings.Contains(normalized, "aomenos1km")
}

var retroativoValorPagoRegex = regexp.MustCompile(`(?i)\[retroativo:valor_pago=([0-9]+(?:[\.,][0-9]+)?)\]`)

func propostaEhRetroativa(observacoes string) bool {
	return strings.Contains(strings.ToLower(observacoes), "[origem:retroativo]")
}

func extrairValorPagoRetroativo(observacoes string) float64 {
	match := retroativoValorPagoRegex.FindStringSubmatch(observacoes)
	if len(match) < 2 {
		return 0
	}
	raw := strings.ReplaceAll(strings.TrimSpace(match[1]), ",", ".")
	v, err := strconv.ParseFloat(raw, 64)
	if err != nil || v < 0 {
		return 0
	}
	return v
}

func canTransitionPropostaStatus(current, next string) bool {
	if current == next {
		return true
	}
	switch current {
	case statusRascunho:
		return next == statusFinalizada
	case statusFinalizada:
		return next == statusEnviada
	case statusEnviada:
		return next == statusConvertida
	default:
		return false
	}
}

// ListarPropostas retorna o histórico de propostas geradas no gerador de orçamento.
func ListarPropostas(c *gin.Context) {
	ctx := c.Request.Context()
	query := `
		SELECT id, orcamento_publico_id, empresa_id, empresa_nome, responsavel, email, telefone,
		       evento_nome, data_evento::text, COALESCE(hora_chegada, ''), local_id, local_nome, cidade_evento, qtd_pessoas,
		       km_evento, margem_percent, subtotal_itens, taxa_local, valor_margem, valor_total,
		       observacoes, status, criado_em, atualizado_em
		FROM propostas
		WHERE 1=1
		ORDER BY criado_em DESC
		LIMIT 150`
	args := []interface{}{}

	rows, err := db.Pool.Query(ctx, query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	defer rows.Close()

	lista := []models.Proposta{}
	for rows.Next() {
		var p models.Proposta
		if err := rows.Scan(
			&p.ID, &p.OrcamentoPublico, &p.EmpresaID, &p.EmpresaNome, &p.Responsavel, &p.Email, &p.Telefone,
			&p.EventoNome, &p.DataEvento, &p.HoraChegada, &p.LocalID, &p.LocalNome, &p.CidadeEvento, &p.QtdPessoas,
			&p.KMEvento, &p.MargemPercent, &p.SubtotalItens, &p.TaxaLocal, &p.ValorMargem, &p.ValorTotal,
			&p.Observacoes, &p.Status, &p.CriadoEm, &p.AtualizadoEm,
		); err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
			return
		}
		lista = append(lista, p)
	}

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: lista})
}

// BuscarProposta retorna uma proposta com os itens detalhados.
func BuscarProposta(c *gin.Context) {
	id := c.Param("id")
	ctx := c.Request.Context()

	var p models.Proposta
	err := db.Pool.QueryRow(ctx, `
		SELECT p.id, p.orcamento_publico_id, p.empresa_id, p.empresa_nome, p.responsavel, p.email, p.telefone,
		       p.evento_nome, p.data_evento::text, COALESCE(p.hora_chegada, ''), p.local_id, p.local_nome, p.cidade_evento, p.qtd_pessoas,
		       p.km_evento, p.margem_percent, p.subtotal_itens, p.taxa_local, p.valor_margem, p.valor_total,
		       p.observacoes, p.status, p.criado_em, p.atualizado_em,
		       COALESCE((SELECT DISTINCT ON (proposta_id) autor_nome FROM notificacoes WHERE proposta_id = p.id ORDER BY proposta_id, criado_em DESC), '') AS autor_nome
		FROM propostas p
		WHERE p.id = $1`, id).Scan(
		&p.ID, &p.OrcamentoPublico, &p.EmpresaID, &p.EmpresaNome, &p.Responsavel, &p.Email, &p.Telefone,
		&p.EventoNome, &p.DataEvento, &p.HoraChegada, &p.LocalID, &p.LocalNome, &p.CidadeEvento, &p.QtdPessoas,
		&p.KMEvento, &p.MargemPercent, &p.SubtotalItens, &p.TaxaLocal, &p.ValorMargem, &p.ValorTotal,
		&p.Observacoes, &p.Status, &p.CriadoEm, &p.AtualizadoEm, &p.AutorNome,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: "Proposta não encontrada"})
			return
		}
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	itemRows, err := db.Pool.Query(ctx, `
		SELECT id, proposta_id, insumo_id, nome, descricao, quantidade, valor_unitario, valor_total, ordem, criado_em
		FROM proposta_itens
		WHERE proposta_id = $1
		ORDER BY ordem ASC`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	defer itemRows.Close()

	itens := []models.PropostaItem{}
	for itemRows.Next() {
		var item models.PropostaItem
		if err := itemRows.Scan(
			&item.ID, &item.PropostaID, &item.InsumoID, &item.Nome, &item.Descricao,
			&item.Quantidade, &item.ValorUnit, &item.ValorTotal, &item.Ordem, &item.CriadoEm,
		); err == nil {
			itens = append(itens, item)
		}
	}
	p.Itens = itens

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: p})
}

// CriarProposta salva uma proposta com seus itens em transação única.
func CriarProposta(c *gin.Context) {
	var input models.PropostaInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	if len(input.Itens) == 0 {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Informe ao menos um item para salvar a proposta"})
		return
	}

	tx, err := db.Pool.Begin(context.Background())
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	defer tx.Rollback(context.Background())

	// Regra de negócio: toda proposta nasce em Rascunho.
	status := statusRascunho

	var propostaID string
	err = tx.QueryRow(context.Background(), `
		INSERT INTO propostas (
			orcamento_publico_id, empresa_id, empresa_nome, responsavel, email, telefone,
			evento_nome, data_evento, local_id, local_nome, cidade_evento, qtd_pessoas,
			km_evento, margem_percent, subtotal_itens, taxa_local, valor_margem, valor_total, hora_chegada,
			preco_ingresso, observacoes, status
		) VALUES (
			$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22
		) RETURNING id`,
		input.OrcamentoPublico, input.EmpresaID, input.EmpresaNome, input.Responsavel, input.Email, input.Telefone,
		input.EventoNome, input.DataEvento, input.LocalID, input.LocalNome, input.CidadeEvento, input.QtdPessoas,
		input.KMEvento, input.MargemPercent, input.SubtotalItens, input.TaxaLocal, input.ValorMargem, input.ValorTotal,
		input.HoraChegada, input.PrecoIngresso, input.Observacoes, status,
	).Scan(&propostaID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	ordem := 1
	insertedItems := 0
	for _, item := range input.Itens {
		nome := strings.TrimSpace(item.Nome)
		if nome == "" {
			continue
		}

		qtd := item.Quantidade
		if qtd < 0 {
			qtd = 0
		}
		valorUnit := item.ValorUnit
		if valorUnit < 0 {
			valorUnit = 0
		}
		valorTotal := qtd * valorUnit

		_, err = tx.Exec(context.Background(), `
			INSERT INTO proposta_itens (
				proposta_id, insumo_id, nome, descricao, quantidade, valor_unitario, valor_total, ordem
			) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
			propostaID, item.InsumoID, nome, item.Descricao, qtd, valorUnit, valorTotal, ordem,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
			return
		}

		ordem++
		insertedItems++
	}

	if insertedItems == 0 {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Nenhum item válido foi informado"})
		return
	}

	if input.OrcamentoPublico != nil && *input.OrcamentoPublico != "" {
		_, _ = tx.Exec(context.Background(), `
			UPDATE orcamentos_publicos
			   SET status = 'Em Análise'
			 WHERE id = $1
			   AND status = 'Novo'`, *input.OrcamentoPublico)
	}

	autorNome := strings.TrimSpace(c.GetString("nome"))
	if autorNome == "" {
		autorNome = strings.TrimSpace(c.GetString("login"))
	}
	if autorNome == "" {
		autorNome = "Sistema"
	}
	autorPerfil := strings.TrimSpace(c.GetString("perfil"))
	if autorPerfil == "" {
		autorPerfil = "Sistema"
	}

	titulo := "Proposta Gerada"
	mensagem := strings.TrimSpace(input.EmpresaNome)
	if mensagem == "" {
		mensagem = strings.TrimSpace(input.EventoNome)
	}
	if mensagem == "" {
		mensagem = "Cliente não informado"
	}

	if err := tx.Commit(context.Background()); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	_, _ = criarNotificacao(
		context.Background(),
		titulo,
		mensagem,
		"proposta",
		nil,
		&propostaID,
		autorNome,
		autorPerfil,
	)

	c.JSON(http.StatusCreated, models.APIResponse{
		Success: true,
		Message: "Proposta salva com sucesso",
		Data:    gin.H{"id": propostaID},
	})
}

// ConverterPropostaContrato converte uma proposta em contrato para fluxo operacional.
func ConverterPropostaContrato(c *gin.Context) {
	id := c.Param("id")

	var p models.Proposta
	err := db.Pool.QueryRow(context.Background(), `
		SELECT id, orcamento_publico_id, empresa_id, empresa_nome, responsavel, evento_nome,
		       data_evento::text, COALESCE(hora_chegada, ''), local_id, local_nome, qtd_pessoas, km_evento, valor_total, preco_ingresso, status, observacoes
		  FROM propostas
		 WHERE id = $1`, id).Scan(
		&p.ID, &p.OrcamentoPublico, &p.EmpresaID, &p.EmpresaNome, &p.Responsavel, &p.EventoNome,
		&p.DataEvento, &p.HoraChegada, &p.LocalID, &p.LocalNome, &p.QtdPessoas, &p.KMEvento, &p.ValorTotal, &p.PrecoIngresso, &p.Status, &p.Observacoes,
	)
	if err != nil {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: "Proposta não encontrada"})
		return
	}
	if strings.EqualFold(p.Status, "Convertida") {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Proposta já foi convertida"})
		return
	}

	if !(strings.EqualFold(p.Status, statusFinalizada) || strings.EqualFold(p.Status, statusEnviada)) {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "A proposta precisa estar Finalizada ou Enviada para conversão"})
		return
	}

	modalidade := "A definir"
	if p.OrcamentoPublico != nil && *p.OrcamentoPublico != "" {
		var mod string
		if err := db.Pool.QueryRow(context.Background(), `SELECT modalidade FROM orcamentos_publicos WHERE id = $1`, *p.OrcamentoPublico).Scan(&mod); err == nil {
			mod = strings.TrimSpace(mod)
			if mod != "" {
				modalidade = mod
			}
		}
	}

	contratoID := fmt.Sprintf("%d-%d", time.Now().Year(), time.Now().UnixMilli())
	descricaoContrato := "[origem:gerador] Proposta convertida para contrato"
	if p.OrcamentoPublico != nil && *p.OrcamentoPublico != "" {
		descricaoContrato = "[origem:gerador] [origem:site] Proposta convertida a partir de solicitação do formulário público"
	}
	statusInicialContrato := "Em Negociação"
	valorPagoInicial := 0.0
	if propostaEhRetroativa(p.Observacoes) {
		descricaoContrato = "[origem:gerador] [origem:retroativo] Evento retroativo convertido a partir do gerador"
		statusInicialContrato = "Finalizado"
		valorPagoInicial = extrairValorPagoRetroativo(p.Observacoes)
	}
	if empresaEhAomenos1kmProposta(p.EmpresaNome) {
		statusInicialContrato = "Confirmado"
	}

	consultorResponsavel := strings.TrimSpace(c.GetString("nome"))
	if consultorResponsavel == "" {
		consultorResponsavel = strings.TrimSpace(c.GetString("login"))
	}
	if consultorResponsavel == "" {
		consultorResponsavel = strings.TrimSpace(p.Responsavel)
	}

	_, err = db.Pool.Exec(context.Background(), `
		INSERT INTO contratos (
			id, empresa_id, empresa_nome, descricao, valor_total, data_evento,
			hora_chegada, local_id, local_nome, modalidade, qtd_contratada, qtd_kit, km,
			status, valor_pago, consultor, possui_kit, tipo_kit,
			nome_evento, observacoes, preco_ingresso
		) VALUES (
			$1, $2, $3, $4, $5, $6,
			$7, $8, $9, $10, $11, $12, $13,
			$14, $15, $16, $17, $18,
			$19, $20, $21
		)`,
		contratoID,
		p.EmpresaID,
		p.EmpresaNome,
		descricaoContrato,
		p.ValorTotal,
		p.DataEvento,
		p.HoraChegada,
		p.LocalID,
		p.LocalNome,
		modalidade,
		p.QtdPessoas,
		0,
		fmt.Sprintf("%.0f", p.KMEvento),
		statusInicialContrato,
		valorPagoInicial,
		consultorResponsavel,
		false,
		"",
		p.EventoNome,
		p.Observacoes,
		p.PrecoIngresso,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	_, _ = db.Pool.Exec(context.Background(), `UPDATE propostas SET status = $2 WHERE id = $1`, p.ID, statusConvertida)
	if p.OrcamentoPublico != nil && *p.OrcamentoPublico != "" {
		_, _ = db.Pool.Exec(context.Background(), `UPDATE orcamentos_publicos SET status = 'Convertido' WHERE id = $1`, *p.OrcamentoPublico)
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Proposta convertida em contrato",
		Data: gin.H{
			"proposta_id": p.ID,
			"contrato_id": contratoID,
		},
	})
}

// AtualizarStatusProposta altera o status de uma proposta (ex: Rascunho -> Finalizada).
func AtualizarStatusProposta(c *gin.Context) {
	id := c.Param("id")
	var input models.PropostaStatusInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	status := strings.TrimSpace(input.Status)
	status = normalizePropostaStatus(status)
	if status == "" {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Status inválido. Use: Rascunho, Finalizada, Enviada ou Convertida"})
		return
	}

	var currentStatus string
	err := db.Pool.QueryRow(context.Background(), `SELECT status FROM propostas WHERE id = $1`, id).Scan(&currentStatus)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: "Proposta não encontrada"})
			return
		}
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	currentStatus = normalizePropostaStatus(currentStatus)
	if currentStatus == "" {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Status atual da proposta é inválido"})
		return
	}

	if !canTransitionPropostaStatus(currentStatus, status) {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: fmt.Sprintf("Transição de status inválida: %s -> %s", currentStatus, status)})
		return
	}

	if currentStatus == status {
		c.JSON(http.StatusOK, models.APIResponse{Success: true, Message: "Status mantido"})
		return
	}

	cmd, err := db.Pool.Exec(context.Background(), `
		UPDATE propostas
		   SET status = $2,
		       atualizado_em = NOW()
		 WHERE id = $1`, id, status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	if cmd.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: "Proposta não encontrada"})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Message: "Status atualizado"})
}

// DeletarProposta remove proposta e seus itens.
func DeletarProposta(c *gin.Context) {
	id := c.Param("id")
	authUser := getAuthzUser(c)
	if !authUser.IsAdmin() {
		rejectForbidden(c, "Somente administradores podem excluir propostas")
		return
	}

	tx, err := db.Pool.Begin(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	defer tx.Rollback(c.Request.Context())

	if _, err := tx.Exec(c.Request.Context(), `DELETE FROM proposta_itens WHERE proposta_id = $1`, id); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	// Desvincula notificações para não violar FK em notificacoes.proposta_id.
	if _, err := tx.Exec(c.Request.Context(), `UPDATE notificacoes SET proposta_id = NULL WHERE proposta_id = $1`, id); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	cmd, err := tx.Exec(c.Request.Context(), `DELETE FROM propostas WHERE id = $1`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	if cmd.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: "Proposta não encontrada"})
		return
	}

	if err := tx.Commit(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Message: "Proposta removida"})
}
