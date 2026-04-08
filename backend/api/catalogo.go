package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/aomenos1km/app-web/db"
	"github.com/aomenos1km/app-web/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ListarEmpresas lista todas as empresas com filtro opcional de status e tipo
func ListarEmpresas(c *gin.Context) {
	status := c.Query("status")
	tipo := c.Query("tipo")

	query := `SELECT empresas.id,
	                 COALESCE(TO_CHAR(empresas.data_cadastro, 'YYYY-MM-DD'), ''),
	                 COALESCE(empresas.documento, ''),
	                 COALESCE(empresas.razao_social, ''),
	                 COALESCE(empresas.nome_fantasia, ''),
	                 COALESCE(empresas.responsavel, ''),
	                 COALESCE(empresas.telefone, ''),
	                 COALESCE(empresas.email, ''),
	                 COALESCE(empresas.cidade, ''),
	                 COALESCE(empresas.uf, ''),
	                 COALESCE(empresas.tipo_pessoa, 'PJ'),
	                 COALESCE(empresas.status, 'Lead'),
	                 COALESCE(TO_CHAR(pend.data_prevista, 'YYYY-MM-DD'), ''),
	                 (pend.id IS NOT NULL),
	                 (pend.id IS NOT NULL AND pend.data_prevista <= CURRENT_DATE),
	                 COALESCE(ult.texto, ''),
	                 COALESCE(ult.usuario_nome, ''),
	                 COALESCE(TO_CHAR(ult.criado_em, 'YYYY-MM-DD HH24:MI'), ''),
	                 COALESCE(pend.responsavel_nome, '')
	          FROM empresas
	          LEFT JOIN LATERAL (
	             SELECT i.texto, i.usuario_nome, i.criado_em
	             FROM empresas_crm_interacoes i
	             WHERE i.empresa_id = empresas.id
	             ORDER BY i.criado_em DESC
	             LIMIT 1
	          ) ult ON true
	          LEFT JOIN LATERAL (
	             SELECT p.id, p.data_prevista, p.responsavel_nome
	             FROM empresas_crm_pendencias p
	             WHERE p.empresa_id = empresas.id
	               AND p.status = 'Aberta'
	             ORDER BY p.data_prevista ASC, p.criado_em DESC
	             LIMIT 1
	          ) pend ON true
	          WHERE 1=1`
	args := []interface{}{}
	idx := 1

	if status != "" {
		query += " AND empresas.status = $" + itoa(idx)
		args = append(args, status)
		idx++
	}
	if tipo != "" {
		query += " AND empresas.tipo_pessoa = $" + itoa(idx)
		args = append(args, tipo)
		idx++
	}
	query += " ORDER BY empresas.razao_social ASC"

	rows, err := db.Pool.Query(context.Background(), query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	defer rows.Close()

	var lista []models.Empresa
	for rows.Next() {
		var e models.Empresa
		var dataCadastro string
		var crmProximoContato string
		var crmUltimaInteracao string
		if err := rows.Scan(&e.ID, &dataCadastro, &e.Documento, &e.RazaoSocial, &e.NomeFantasia,
			&e.Responsavel, &e.Telefone, &e.Email, &e.Cidade, &e.UF, &e.TipoPessoa, &e.Status,
			&crmProximoContato, &e.CRMTemRetorno, &e.CRMPendente, &e.CRMUltimoTexto, &e.CRMUltimoUsuario, &crmUltimaInteracao, &e.CRMResponsavelNome); err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
			return
		}
		if dataCadastro != "" {
			e.DataCadastro = &dataCadastro
		}
		if crmProximoContato != "" {
			e.CRMProximoContato = &crmProximoContato
		}
		if crmUltimaInteracao != "" {
			e.CRMUltimaInteracao = &crmUltimaInteracao
		}
		lista = append(lista, e)
	}
	if err := rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	if lista == nil {
		lista = []models.Empresa{}
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: lista})
}

// BuscarEmpresa retorna uma empresa pelo ID
func BuscarEmpresa(c *gin.Context) {
	id := c.Param("id")
	var e models.Empresa
	var dataCadastro string
	err := db.Pool.QueryRow(context.Background(), `
		SELECT id,
		       COALESCE(TO_CHAR(data_cadastro, 'YYYY-MM-DD'), ''),
		       COALESCE(documento, ''),
		       COALESCE(razao_social, ''),
		       COALESCE(nome_fantasia, ''),
		       COALESCE(responsavel, ''),
		       COALESCE(telefone, ''),
		       COALESCE(email, ''),
		       COALESCE(endereco, ''),
		       COALESCE(logradouro, ''),
		       COALESCE(numero, ''),
		       COALESCE(complemento, ''),
		       COALESCE(bairro, ''),
		       COALESCE(cidade, ''),
		       COALESCE(uf, ''),
		       COALESCE(cep, ''),
		       COALESCE(tipo_pessoa, 'PJ'),
		       COALESCE(status, 'Lead'),
		       COALESCE(observacoes, ''),
		       criado_em
		FROM empresas WHERE id = $1
	`, id).Scan(&e.ID, &dataCadastro, &e.Documento, &e.RazaoSocial, &e.NomeFantasia, &e.Responsavel,
		&e.Telefone, &e.Email, &e.Endereco, &e.Logradouro, &e.Numero, &e.Complemento, &e.Bairro,
		&e.Cidade, &e.UF, &e.CEP, &e.TipoPessoa, &e.Status, &e.Observacoes, &e.CriadoEm)
	if err != nil {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: "Empresa não encontrada"})
		return
	}
	if dataCadastro != "" {
		e.DataCadastro = &dataCadastro
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: e})
}

// CriarEmpresa cria uma empresa
func CriarEmpresa(c *gin.Context) {
	authUser := getAuthzUser(c)
	if !authUser.IsAdmin() {
		rejectForbidden(c, "Somente administradores podem criar empresas")
		return
	}

	var input models.EmpresaInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	var id string
	err := db.Pool.QueryRow(context.Background(), `
		INSERT INTO empresas (documento, razao_social, nome_fantasia, responsavel, telefone,
		                      email, logradouro, numero, complemento, bairro, cidade, uf, cep,
		                      tipo_pessoa, status, observacoes)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
		RETURNING id`,
		input.Documento, input.RazaoSocial, input.NomeFantasia, input.Responsavel, input.Telefone,
		input.Email, input.Logradouro, input.Numero, input.Complemento, input.Bairro, input.Cidade,
		input.UF, input.CEP, orDefault(input.TipoPessoa, "PJ"), orDefault(input.Status, "Ativo"),
		input.Observacoes,
	).Scan(&id)

	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	c.JSON(http.StatusCreated, models.APIResponse{Success: true, Data: gin.H{"id": id}})
}

// AtualizarEmpresa atualiza uma empresa
func AtualizarEmpresa(c *gin.Context) {
	authUser := getAuthzUser(c)
	if !authUser.IsAdmin() {
		rejectForbidden(c, "Somente administradores podem editar empresas")
		return
	}

	id := c.Param("id")
	var input models.EmpresaInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	result, err := db.Pool.Exec(context.Background(), `
		UPDATE empresas SET documento=$1, razao_social=$2, nome_fantasia=$3, responsavel=$4,
		       telefone=$5, email=$6, logradouro=$7, numero=$8, complemento=$9, bairro=$10,
		       cidade=$11, uf=$12, cep=$13, tipo_pessoa=$14, status=$15, observacoes=$16
		WHERE id = $17`,
		input.Documento, input.RazaoSocial, input.NomeFantasia, input.Responsavel, input.Telefone,
		input.Email, input.Logradouro, input.Numero, input.Complemento, input.Bairro, input.Cidade,
		input.UF, input.CEP, input.TipoPessoa, input.Status, input.Observacoes, id)

	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	if result.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: "Empresa não encontrada"})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Message: "Empresa atualizada"})
}

// DeletarEmpresa remove uma empresa
func DeletarEmpresa(c *gin.Context) {
	authUser := getAuthzUser(c)
	if !authUser.IsAdmin() {
		rejectForbidden(c, "Somente administradores podem remover empresas")
		return
	}

	id := c.Param("id")
	result, err := db.Pool.Exec(context.Background(), `DELETE FROM empresas WHERE id = $1`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	if result.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: "Empresa não encontrada"})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Message: "Empresa removida"})
}

// ListarEmpresaCRMInteracoes lista o historico de CRM da empresa
func ListarEmpresaCRMInteracoes(c *gin.Context) {
	empresaID := c.Param("id")
	ctx := context.Background()
	authUser := getAuthzUser(c)
	canAccess, err := crmCanAccessEmpresa(ctx, authUser, empresaID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	if !canAccess {
		rejectForbidden(c, "Você não tem acesso ao histórico de CRM desta empresa")
		return
	}

	rows, err := db.Pool.Query(ctx, `
		SELECT id,
		       empresa_id,
		       usuario_id,
		       COALESCE(usuario_nome, ''),
		       COALESCE(texto, ''),
		       COALESCE(TO_CHAR(proximo_contato, 'YYYY-MM-DD'), ''),
		       COALESCE(tipo_interacao, 'Anotacao'),
		       COALESCE(canal, 'WhatsApp'),
		       COALESCE(resultado, 'Sem Retorno'),
		       criado_em
		FROM empresas_crm_interacoes
		WHERE empresa_id = $1
		ORDER BY criado_em DESC`, empresaID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	defer rows.Close()

	lista := make([]models.EmpresaCRMInteracao, 0)
	for rows.Next() {
		var i models.EmpresaCRMInteracao
		var proximoContato string
		if err := rows.Scan(&i.ID, &i.EmpresaID, &i.UsuarioID, &i.Usuario, &i.Texto, &proximoContato, &i.TipoInteracao, &i.Canal, &i.Resultado, &i.CriadoEm); err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
			return
		}
		if proximoContato != "" {
			i.ProximoContato = &proximoContato
		}
		i.Data = i.CriadoEm.Format("02/01/2006")
		i.Hora = i.CriadoEm.Format("15:04")
		lista = append(lista, i)
	}

	if err := rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: lista})
}

// CriarEmpresaCRMInteracao registra uma nova anotacao no CRM da empresa
func CriarEmpresaCRMInteracao(c *gin.Context) {
	empresaID := c.Param("id")
	var input models.EmpresaCRMInteracaoInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	authUser := getAuthzUser(c)
	ctx := context.Background()

	texto := strings.TrimSpace(input.Texto)
	if texto == "" {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "texto é obrigatório"})
		return
	}

	var proximoContato interface{} = nil
	if strings.TrimSpace(input.ProximoContato) != "" {
		if _, err := time.Parse("2006-01-02", input.ProximoContato); err != nil {
			c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "proximo_contato deve estar no formato YYYY-MM-DD"})
			return
		}
		proximoContato = input.ProximoContato
	}

	tipoInteracao := orDefaultText(strings.TrimSpace(input.TipoInteracao), "Anotacao")
	canal := orDefaultText(strings.TrimSpace(input.Canal), "WhatsApp")
	resultado := orDefaultText(strings.TrimSpace(input.Resultado), "Sem Retorno")
	prioridade := normalizeCRMPrioridade(input.Prioridade)

	usuarioID, usuario := crmUserContext(c)
	responsavelUserID := usuarioID
	if strings.TrimSpace(input.ResponsavelUserID) != "" {
		responsavelUserID = &input.ResponsavelUserID
	}
	responsavelNome := strings.TrimSpace(input.ResponsavelNome)

	if !authUser.IsAdmin() {
		if authUser.ID == "" {
			rejectForbidden(c, "Usuário sem identificação para aplicar permissões de CRM")
			return
		}
		if responsavelUserID != nil && strings.TrimSpace(*responsavelUserID) != authUser.ID {
			rejectForbidden(c, "Consultores não podem atribuir pendências para outro responsável")
			return
		}

		canAccess, err := crmCanAccessEmpresa(ctx, authUser, empresaID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
			return
		}
		if !canAccess && strings.TrimSpace(input.ProximoContato) == "" {
			rejectForbidden(c, "Você só pode registrar interação em empresas sob sua responsabilidade")
			return
		}

		responsavelUserID = &authUser.ID
		responsavelNome = authUser.Nome
		if strings.TrimSpace(responsavelNome) == "" {
			responsavelNome = usuario
		}
	}

	if responsavelNome == "" && responsavelUserID != nil {
		responsavelNome = crmLookupUserName(ctx, *responsavelUserID)
	}
	if responsavelNome == "" {
		responsavelNome = usuario
	}

	var interacao models.EmpresaCRMInteracao
	var proximoContatoOut string
	err := db.Pool.QueryRow(ctx, `
		INSERT INTO empresas_crm_interacoes (empresa_id, usuario_id, usuario_nome, texto, proximo_contato, tipo_interacao, canal, resultado)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, empresa_id, usuario_id, usuario_nome, texto, COALESCE(TO_CHAR(proximo_contato, 'YYYY-MM-DD'), ''), tipo_interacao, canal, resultado, criado_em`,
		empresaID, usuarioID, usuario, texto, proximoContato, tipoInteracao, canal, resultado,
	).Scan(&interacao.ID, &interacao.EmpresaID, &interacao.UsuarioID, &interacao.Usuario, &interacao.Texto, &proximoContatoOut, &interacao.TipoInteracao, &interacao.Canal, &interacao.Resultado, &interacao.CriadoEm)

	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "violates foreign key") {
			c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: "Empresa não encontrada"})
			return
		}
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	if proximoContatoOut != "" {
		interacao.ProximoContato = &proximoContatoOut
	}

	if strings.TrimSpace(proximoContatoOut) != "" {
		if err := closeOpenCRMPendencias(ctx, empresaID, "Reagendada", usuarioID, usuario); err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
			return
		}
		if err := createCRMPendencia(ctx, empresaID, interacao.ID, responsavelUserID, responsavelNome, texto, proximoContatoOut, prioridade); err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
			return
		}
	} else if resultado == "Contato Realizado" || resultado == "Sem Interesse" || resultado == "Convertido" {
		if err := closeOpenCRMPendencias(ctx, empresaID, "Concluida", usuarioID, usuario); err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
			return
		}
	}

	interacao.Data = interacao.CriadoEm.Format("02/01/2006")
	interacao.Hora = interacao.CriadoEm.Format("15:04")

	c.JSON(http.StatusCreated, models.APIResponse{Success: true, Data: interacao})
}

type cnpjConsultaData struct {
	Nome       string `json:"nome"`
	Fantasia   string `json:"fantasia"`
	Email      string `json:"email"`
	Telefone   string `json:"telefone"`
	Logradouro string `json:"logradouro"`
	Numero     string `json:"numero"`
	Bairro     string `json:"bairro"`
	Municipio  string `json:"municipio"`
	UF         string `json:"uf"`
	CEP        string `json:"cep"`
}

type brasilAPICNPJResponse struct {
	RazaoSocial  string `json:"razao_social"`
	NomeFantasia string `json:"nome_fantasia"`
	Email        string `json:"email"`
	DDDTelefone1 string `json:"ddd_telefone_1"`
	Logradouro   string `json:"logradouro"`
	Numero       string `json:"numero"`
	Bairro       string `json:"bairro"`
	Municipio    string `json:"municipio"`
	UF           string `json:"uf"`
	CEP          string `json:"cep"`
}

type minhaReceitaCNPJResponse struct {
	RazaoSocial  string `json:"razao_social"`
	NomeFantasia string `json:"nome_fantasia"`
	Email        string `json:"email"`
	Telefone     string `json:"telefone"`
	Logradouro   string `json:"logradouro"`
	Numero       string `json:"numero"`
	Bairro       string `json:"bairro"`
	Municipio    string `json:"municipio"`
	UF           string `json:"uf"`
	CEP          string `json:"cep"`
}

type receitaWSCNPJResponse struct {
	Status     string `json:"status"`
	Message    string `json:"message"`
	Nome       string `json:"nome"`
	Fantasia   string `json:"fantasia"`
	Email      string `json:"email"`
	Telefone   string `json:"telefone"`
	Logradouro string `json:"logradouro"`
	Numero     string `json:"numero"`
	Bairro     string `json:"bairro"`
	Municipio  string `json:"municipio"`
	UF         string `json:"uf"`
	CEP        string `json:"cep"`
}

// ConsultarCNPJ busca dados da empresa por CNPJ (BrasilAPI com fallback ReceitaWS)
func ConsultarCNPJ(c *gin.Context) {
	cnpj := strings.NewReplacer(".", "", "/", "", "-", "", " ", "").Replace(c.Query("cnpj"))
	if len(cnpj) != 14 {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "CNPJ inválido. Informe 14 dígitos."})
		return
	}

	dados, err := consultarCNPJBrasilAPI(cnpj)
	if err != nil {
		dados, err = consultarCNPJReceitaWS(cnpj)
	}
	if err != nil {
		dados, err = consultarCNPJMinhaReceita(cnpj)
	}
	if err == nil && precisaComplementarDadosCNPJ(dados) {
		if dadosFallback, fallbackErr := consultarCNPJReceitaWS(cnpj); fallbackErr == nil {
			dados = mesclarDadosCNPJ(dados, dadosFallback)
		} else if dadosFallback, fallbackErr := consultarCNPJMinhaReceita(cnpj); fallbackErr == nil {
			dados = mesclarDadosCNPJ(dados, dadosFallback)
		}
	}
	if err != nil {
		c.JSON(http.StatusBadGateway, models.APIResponse{Success: false, Error: "Não foi possível consultar o CNPJ agora. Tente novamente em instantes."})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: dados})
}

func consultarCNPJBrasilAPI(cnpj string) (cnpjConsultaData, error) {
	url := fmt.Sprintf("https://brasilapi.com.br/api/cnpj/v1/%s", cnpj)
	client := &http.Client{Timeout: 10 * time.Second}

	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return cnpjConsultaData{}, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "Aomenos1km/1.0 (+https://localhost)")

	resp, err := client.Do(req)
	if err != nil {
		return cnpjConsultaData{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return cnpjConsultaData{}, fmt.Errorf("status %d", resp.StatusCode)
	}

	var body brasilAPICNPJResponse
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return cnpjConsultaData{}, err
	}

	return cnpjConsultaData{
		Nome:       body.RazaoSocial,
		Fantasia:   body.NomeFantasia,
		Email:      body.Email,
		Telefone:   body.DDDTelefone1,
		Logradouro: body.Logradouro,
		Numero:     body.Numero,
		Bairro:     body.Bairro,
		Municipio:  body.Municipio,
		UF:         body.UF,
		CEP:        body.CEP,
	}, nil
}

func consultarCNPJReceitaWS(cnpj string) (cnpjConsultaData, error) {
	url := fmt.Sprintf("https://www.receitaws.com.br/v1/cnpj/%s", cnpj)
	client := &http.Client{Timeout: 10 * time.Second}

	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return cnpjConsultaData{}, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; Aomenos1km/1.0)")

	resp, err := client.Do(req)
	if err != nil {
		return cnpjConsultaData{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return cnpjConsultaData{}, fmt.Errorf("status %d", resp.StatusCode)
	}

	var body receitaWSCNPJResponse
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return cnpjConsultaData{}, err
	}
	if strings.EqualFold(body.Status, "ERROR") {
		return cnpjConsultaData{}, fmt.Errorf(body.Message)
	}

	return cnpjConsultaData{
		Nome:       body.Nome,
		Fantasia:   body.Fantasia,
		Email:      body.Email,
		Telefone:   strings.Split(body.Telefone, "/")[0],
		Logradouro: body.Logradouro,
		Numero:     body.Numero,
		Bairro:     body.Bairro,
		Municipio:  body.Municipio,
		UF:         body.UF,
		CEP:        body.CEP,
	}, nil
}

func consultarCNPJMinhaReceita(cnpj string) (cnpjConsultaData, error) {
	url := fmt.Sprintf("https://minhareceita.org/%s", cnpj)
	client := &http.Client{Timeout: 10 * time.Second}

	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return cnpjConsultaData{}, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "Aomenos1km/1.0 (+https://localhost)")

	resp, err := client.Do(req)
	if err != nil {
		return cnpjConsultaData{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return cnpjConsultaData{}, fmt.Errorf("status %d", resp.StatusCode)
	}

	var body minhaReceitaCNPJResponse
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return cnpjConsultaData{}, err
	}
	if strings.TrimSpace(body.RazaoSocial) == "" {
		return cnpjConsultaData{}, fmt.Errorf("cnpj não encontrado")
	}

	return cnpjConsultaData{
		Nome:       body.RazaoSocial,
		Fantasia:   body.NomeFantasia,
		Email:      body.Email,
		Telefone:   strings.Split(body.Telefone, "/")[0],
		Logradouro: body.Logradouro,
		Numero:     body.Numero,
		Bairro:     body.Bairro,
		Municipio:  body.Municipio,
		UF:         body.UF,
		CEP:        body.CEP,
	}, nil
}

func precisaComplementarDadosCNPJ(d cnpjConsultaData) bool {
	return strings.TrimSpace(d.Email) == "" ||
		strings.TrimSpace(d.Telefone) == "" ||
		strings.TrimSpace(d.Logradouro) == "" ||
		strings.TrimSpace(d.Bairro) == "" ||
		strings.TrimSpace(d.Municipio) == "" ||
		strings.TrimSpace(d.UF) == "" ||
		strings.TrimSpace(d.CEP) == ""
}

func mesclarDadosCNPJ(principal, fallback cnpjConsultaData) cnpjConsultaData {
	if strings.TrimSpace(principal.Nome) == "" {
		principal.Nome = fallback.Nome
	}
	if strings.TrimSpace(principal.Fantasia) == "" {
		principal.Fantasia = fallback.Fantasia
	}
	if strings.TrimSpace(principal.Email) == "" {
		principal.Email = fallback.Email
	}
	if strings.TrimSpace(principal.Telefone) == "" {
		principal.Telefone = fallback.Telefone
	}
	if strings.TrimSpace(principal.Logradouro) == "" {
		principal.Logradouro = fallback.Logradouro
	}
	if strings.TrimSpace(principal.Numero) == "" {
		principal.Numero = fallback.Numero
	}
	if strings.TrimSpace(principal.Bairro) == "" {
		principal.Bairro = fallback.Bairro
	}
	if strings.TrimSpace(principal.Municipio) == "" {
		principal.Municipio = fallback.Municipio
	}
	if strings.TrimSpace(principal.UF) == "" {
		principal.UF = fallback.UF
	}
	if strings.TrimSpace(principal.CEP) == "" {
		principal.CEP = fallback.CEP
	}

	return principal
}

// ─── Insumos ─────────────────────────────────────────────────────────────────

// ListarInsumos lista todos os insumos
func ListarInsumos(c *gin.Context) {
	ctx := c.Request.Context()
	if err := ensureCatalogOwnerColumns(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	rows, err := db.Pool.Query(ctx,
		`SELECT id, nome, categoria, descricao, preco_unitario, unidade, ativo, COALESCE(criado_por_user_id::text, '')
		 FROM insumos WHERE ativo = true ORDER BY categoria, nome`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	defer rows.Close()

	var lista []models.Insumo
	for rows.Next() {
		var i models.Insumo
		var ownerID string
		_ = rows.Scan(&i.ID, &i.Nome, &i.Categoria, &i.Descricao, &i.PrecoUnitario, &i.Unidade, &i.Ativo, &ownerID)
		if strings.TrimSpace(ownerID) != "" {
			i.CriadoPorUser = &ownerID
		}
		lista = append(lista, i)
	}
	if lista == nil {
		lista = []models.Insumo{}
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: lista})
}

// CriarInsumo cria um insumo
func CriarInsumo(c *gin.Context) {
	authUser := getAuthzUser(c)
	ctx := c.Request.Context()
	if err := ensureCatalogOwnerColumns(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	var input models.InsumoInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	var id string
	err := db.Pool.QueryRow(ctx,
		`INSERT INTO insumos (nome, categoria, descricao, preco_unitario, unidade, ativo, criado_por_user_id)
		 VALUES ($1,$2,$3,$4,$5,$6,NULLIF($7, '')::uuid) RETURNING id`,
		input.Nome, input.Categoria, input.Descricao, input.PrecoUnitario,
		orDefault(input.Unidade, "unidade"), input.Ativo, authUser.ID,
	).Scan(&id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	c.JSON(http.StatusCreated, models.APIResponse{Success: true, Data: gin.H{"id": id}})
}

// AtualizarInsumo atualiza um insumo
func AtualizarInsumo(c *gin.Context) {
	id := c.Param("id")
	authUser := getAuthzUser(c)
	ctx := c.Request.Context()
	if err := ensureCatalogOwnerColumns(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	if !authUser.IsAdmin() {
		canManage, err := canManageInsumo(ctx, authUser, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
			return
		}
		if !canManage {
			rejectForbidden(c, "Você só pode editar insumos que você mesmo cadastrou")
			return
		}
	}

	var input models.InsumoInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	result, err := db.Pool.Exec(ctx,
		`UPDATE insumos SET nome=$1, categoria=$2, descricao=$3, preco_unitario=$4, unidade=$5, ativo=$6 WHERE id=$7`,
		input.Nome, input.Categoria, input.Descricao, input.PrecoUnitario, input.Unidade, input.Ativo, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	if result.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: "Insumo não encontrado"})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Message: "Insumo atualizado"})
}

// DeletarInsumo desativa um insumo (soft delete)
func DeletarInsumo(c *gin.Context) {
	id := c.Param("id")
	authUser := getAuthzUser(c)
	ctx := c.Request.Context()
	if err := ensureCatalogOwnerColumns(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	if !authUser.IsAdmin() {
		canManage, err := canManageInsumo(ctx, authUser, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
			return
		}
		if !canManage {
			rejectForbidden(c, "Você só pode remover insumos que você mesmo cadastrou")
			return
		}
	}

	result, err := db.Pool.Exec(ctx,
		`UPDATE insumos SET ativo = false WHERE id = $1`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	if result.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: "Insumo não encontrado"})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Message: "Insumo desativado"})
}

// ─── Locais ──────────────────────────────────────────────────────────────────

// ListarLocais lista todos os locais
func ListarLocais(c *gin.Context) {
	ctx := c.Request.Context()
	if err := ensureCatalogOwnerColumns(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	rows, err := db.Pool.Query(ctx,
		`SELECT id,
		        COALESCE(codigo, ''),
		        nome,
		        COALESCE(tipo, ''),
		        COALESCE(logradouro, ''),
		        COALESCE(numero, ''),
		        COALESCE(complemento, ''),
		        COALESCE(bairro, ''),
		        COALESCE(cidade, ''),
		        COALESCE(uf, ''),
		        COALESCE(cep, ''),
		        COALESCE(tipo_taxa, 'Fixo'),
		        COALESCE(taxa_valor, 0),
		        COALESCE(minimo_pessoas, 150),
		        capacidade_maxima,
		        COALESCE(responsavel, ''),
		        COALESCE(whatsapp, ''),
		        ativo,
		        COALESCE(criado_por_user_id::text, '')
		   FROM locais
		  ORDER BY nome`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	defer rows.Close()

	var lista []models.Local
	for rows.Next() {
		var l models.Local
		var ownerID string
		_ = rows.Scan(
			&l.ID,
			&l.Codigo,
			&l.Nome,
			&l.Tipo,
			&l.Logradouro,
			&l.Numero,
			&l.Complemento,
			&l.Bairro,
			&l.Cidade,
			&l.UF,
			&l.CEP,
			&l.TipoTaxa,
			&l.TaxaValor,
			&l.MinimoPessoas,
			&l.CapacidadeMaxima,
			&l.Responsavel,
			&l.WhatsApp,
			&l.Ativo,
			&ownerID,
		)
		if strings.TrimSpace(ownerID) != "" {
			l.CriadoPorUser = &ownerID
		}
		lista = append(lista, l)
	}
	if lista == nil {
		lista = []models.Local{}
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: lista})
}

// CriarLocal cria um local
func CriarLocal(c *gin.Context) {
	authUser := getAuthzUser(c)
	ctx := c.Request.Context()
	if err := ensureCatalogOwnerColumns(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	var input models.LocalInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	if input.TipoTaxa == "" {
		input.TipoTaxa = "Fixo"
	}
	if input.MinimoPessoas == 0 {
		input.MinimoPessoas = 150
	}
	// Gerar código automaticamente se não fornecido
	if strings.TrimSpace(input.Codigo) == "" {
		input.Codigo = uuid.New().String()
	}
	var id string
	err := db.Pool.QueryRow(ctx,
		`INSERT INTO locais (codigo, nome, tipo, logradouro, numero, complemento, bairro, cidade, uf, cep, tipo_taxa, taxa_valor, minimo_pessoas, capacidade_maxima, responsavel, whatsapp, latitude, longitude, observacoes, ativo, criado_por_user_id)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,NULLIF($21, '')::uuid) RETURNING id`,
		input.Codigo, input.Nome, input.Tipo, input.Logradouro, input.Numero,
		input.Complemento, input.Bairro, input.Cidade, input.UF, input.CEP,
		input.TipoTaxa, input.TaxaValor, input.MinimoPessoas, input.CapacidadeMaxima,
		input.Responsavel, input.WhatsApp,
		input.Latitude, input.Longitude, input.Observacoes, input.Ativo, authUser.ID,
	).Scan(&id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	c.JSON(http.StatusCreated, models.APIResponse{Success: true, Data: gin.H{"id": id}})
}

// AtualizarLocal atualiza um local
func AtualizarLocal(c *gin.Context) {
	id := c.Param("id")
	authUser := getAuthzUser(c)
	ctx := c.Request.Context()
	if err := ensureCatalogOwnerColumns(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	if !authUser.IsAdmin() {
		canManage, err := canManageLocal(ctx, authUser, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
			return
		}
		if !canManage {
			rejectForbidden(c, "Você só pode editar locais que você mesmo cadastrou")
			return
		}
	}

	var input models.LocalInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	if input.TipoTaxa == "" {
		input.TipoTaxa = "Fixo"
	}
	if input.MinimoPessoas == 0 {
		input.MinimoPessoas = 150
	}
	result, err := db.Pool.Exec(ctx,
		`UPDATE locais
		    SET codigo=$1,
		        nome=$2,
		        tipo=$3,
		        logradouro=$4,
		        numero=$5,
		        complemento=$6,
		        bairro=$7,
		        cidade=$8,
		        uf=$9,
		        cep=$10,
		        tipo_taxa=$11,
		        taxa_valor=$12,
		        minimo_pessoas=$13,
		        capacidade_maxima=$14,
		        responsavel=$15,
		        whatsapp=$16,
		        latitude=$17,
		        longitude=$18,
		        observacoes=$19,
		        ativo=$20
		 WHERE id=$21`,
		input.Codigo, input.Nome, input.Tipo, input.Logradouro, input.Numero, input.Complemento,
		input.Bairro, input.Cidade, input.UF, input.CEP,
		input.TipoTaxa, input.TaxaValor, input.MinimoPessoas, input.CapacidadeMaxima,
		input.Responsavel, input.WhatsApp,
		input.Latitude, input.Longitude, input.Observacoes, input.Ativo, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	if result.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: "Local não encontrado"})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Message: "Local atualizado"})
}

// DeletarLocal remove um local
func DeletarLocal(c *gin.Context) {
	id := c.Param("id")
	authUser := getAuthzUser(c)
	ctx := c.Request.Context()
	if err := ensureCatalogOwnerColumns(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	if !authUser.IsAdmin() {
		canManage, err := canManageLocal(ctx, authUser, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
			return
		}
		if !canManage {
			rejectForbidden(c, "Você só pode remover locais que você mesmo cadastrou")
			return
		}
	}

	result, err := db.Pool.Exec(ctx, `DELETE FROM locais WHERE id=$1`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	if result.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: "Local não encontrado"})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Message: "Local removido"})
}

// ─── Notificações ─────────────────────────────────────────────────────────────

// ListarNotificacoes retorna notificações não lidas do usuário logado
func ListarNotificacoes(c *gin.Context) {
	rows, err := db.Pool.Query(context.Background(),
		`SELECT id, titulo, mensagem, tipo, lida, contrato_id, proposta_id,
		        COALESCE(autor_nome, ''), COALESCE(autor_perfil, ''), criado_em
		 FROM notificacoes WHERE lida = false ORDER BY criado_em DESC LIMIT 50`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	defer rows.Close()

	var lista []models.Notificacao
	for rows.Next() {
		var n models.Notificacao
		_ = rows.Scan(&n.ID, &n.Titulo, &n.Mensagem, &n.Tipo, &n.Lida, &n.ContratoID, &n.PropostaID, &n.AutorNome, &n.AutorPerfil, &n.CriadoEm)
		lista = append(lista, n)
	}
	if lista == nil {
		lista = []models.Notificacao{}
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: lista})
}

// MarcarNotificacaoLida marca uma notificação como lida
func MarcarNotificacaoLida(c *gin.Context) {
	id := c.Param("id")
	_, err := db.Pool.Exec(context.Background(), `UPDATE notificacoes SET lida = true WHERE id = $1`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true})
}

// MarcarTodasNotificacoesLidas marca todas as notificações não lidas como lidas
func MarcarTodasNotificacoesLidas(c *gin.Context) {
	_, err := db.Pool.Exec(context.Background(), `UPDATE notificacoes SET lida = true WHERE lida = false`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true})
}

// ─── Orçamentos Públicos ──────────────────────────────────────────────────────

// ReceberOrcamentoPublico salva uma solicitação de orçamento do formulário público
func ReceberOrcamentoPublico(c *gin.Context) {
	var input models.OrcamentoPublicoInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	input.EmpresaNome = strings.TrimSpace(input.EmpresaNome)
	input.Responsavel = strings.TrimSpace(input.Responsavel)
	input.Consultor = strings.TrimSpace(input.Consultor)
	input.LocalNome = strings.TrimSpace(input.LocalNome)
	if input.QtdParticipantes < 30 {
		input.QtdParticipantes = 30
	}
	if input.Consultor == "" {
		input.Consultor = "Site/Instagram"
	}
	if input.EmpresaNome == "" {
		input.EmpresaNome = input.Responsavel
	}
	if input.LocalNome == "" {
		input.LocalNome = "A definir"
	}
	if strings.TrimSpace(input.Modalidade) == "" {
		input.Modalidade = "A definir"
	}
	if strings.TrimSpace(input.KM) == "" {
		input.KM = "0"
	}
	input.CEP = strings.TrimSpace(input.CEP)
	input.Logradouro = strings.TrimSpace(input.Logradouro)
	input.Numero = strings.TrimSpace(input.Numero)
	input.Complemento = strings.TrimSpace(input.Complemento)
	input.Bairro = strings.TrimSpace(input.Bairro)
	input.Cidade = strings.TrimSpace(input.Cidade)
	input.UF = strings.ToUpper(strings.TrimSpace(input.UF))

	if err := upsertEmpresaByOrcamentoPublico(input); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Falha ao cadastrar empresa/cliente automaticamente"})
		return
	}

	var id string
	err := db.Pool.QueryRow(context.Background(), `
		INSERT INTO orcamentos_publicos (empresa_nome, responsavel, email, telefone, data_interesse,
		                                 local_nome, cidade, modalidade, qtd_participantes, km, possui_kit, mensagem)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
		input.EmpresaNome, input.Responsavel, input.Email, input.Telefone, input.DataInteresse,
		input.LocalNome, input.Cidade, input.Modalidade, input.QtdParticipantes, input.KM, input.PossuiKit, input.Mensagem,
	).Scan(&id)

	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	contratoID := fmt.Sprintf("%d-%d", time.Now().Year(), time.Now().UnixMilli())
	observacoes := strings.TrimSpace(input.Mensagem)
	if observacoes == "" {
		observacoes = "Solicitação recebida no formulário público"
	}
	observacoes = fmt.Sprintf("%s | Tipo: %s | CNPJ: %s | CPF: %s | Contato: %s | Email: %s",
		observacoes,
		orDefaultText(input.TipoPessoa, "pj"),
		input.CNPJ,
		input.CPF,
		input.Telefone,
		input.Email,
	)

	nomeEvento := fmt.Sprintf("Pedido %s", input.EmpresaNome)
	valorContrato := input.ValorEstimado
	if valorContrato < 0 {
		valorContrato = 0
	}
	_, err = db.Pool.Exec(context.Background(), `
		INSERT INTO contratos (
			id, empresa_nome, descricao, valor_total, data_evento,
			local_nome, modalidade, qtd_contratada, qtd_kit, km,
			status, valor_pago, consultor, possui_kit, tipo_kit,
			nome_evento, observacoes
		) VALUES (
			$1, $2, $3, $4, $5,
			$6, $7, $8, $9, $10,
			$11, $12, $13, $14, $15,
			$16, $17
		)`,
		contratoID,
		input.EmpresaNome,
		"[origem:site] Solicitação de orçamento público",
		valorContrato,
		input.DataInteresse,
		input.LocalNome,
		input.Modalidade,
		input.QtdParticipantes,
		0,
		input.KM,
		"Novo Pedido",
		0,
		input.Consultor,
		false,
		"",
		nomeEvento,
		observacoes,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	_, _ = criarNotificacao(
		context.Background(),
		"Orçamento Recebido",
		input.EmpresaNome,
		"orcamento",
		&contratoID,
		nil,
		"Formulário Público",
		"Externo",
	)

	// Notifica admin
	go func() {
		adminNum := getEnv("WHATSAPP_ADMIN_NUMBER", "")
		if adminNum != "" {
			msg := "📋 *Novo Orçamento Recebido!*\n" +
				"Empresa: " + input.EmpresaNome + "\n" +
				"Responsável: " + input.Responsavel + "\n" +
				"Whatsapp: " + input.Telefone
			_ = enviarWhatsApp(adminNum, msg)
		}
	}()

	c.JSON(http.StatusCreated, models.APIResponse{
		Success: true,
		Message: "Solicitação de orçamento recebida com sucesso! Entraremos em contato em breve.",
		Data:    gin.H{"id": id},
	})
}

func sanitizeDocumento(v string) string {
	v = strings.TrimSpace(v)
	return strings.NewReplacer(".", "", "/", "", "-", "", " ", "").Replace(v)
}

func upsertEmpresaByOrcamentoPublico(input models.OrcamentoPublicoInput) error {
	doc := sanitizeDocumento(input.CNPJ)
	tipoPessoa := "PJ"
	nome := strings.TrimSpace(input.EmpresaNome)
	if strings.EqualFold(strings.TrimSpace(input.TipoPessoa), "pf") {
		tipoPessoa = "PF"
		doc = sanitizeDocumento(input.CPF)
		if strings.TrimSpace(input.Responsavel) != "" {
			nome = strings.TrimSpace(input.Responsavel)
		}
	}
	if nome == "" {
		nome = "Cliente do Formulário"
	}

	if doc == "" {
		return nil
	}

	var empresaID string
	err := db.Pool.QueryRow(context.Background(), `SELECT id FROM empresas WHERE documento = $1 LIMIT 1`, doc).Scan(&empresaID)
	if err == nil {
		_, err = db.Pool.Exec(context.Background(), `
			UPDATE empresas
			   SET razao_social = CASE WHEN COALESCE(NULLIF(razao_social, ''), '') = '' THEN $2 ELSE razao_social END,
			       responsavel = CASE WHEN COALESCE(NULLIF(responsavel, ''), '') = '' THEN $3 ELSE responsavel END,
			       telefone = CASE WHEN COALESCE(NULLIF(telefone, ''), '') = '' THEN $4 ELSE telefone END,
			       email = CASE WHEN COALESCE(NULLIF(email, ''), '') = '' THEN $5 ELSE email END,
			       logradouro = CASE WHEN COALESCE(NULLIF(logradouro, ''), '') = '' THEN $6 ELSE logradouro END,
			       numero = CASE WHEN COALESCE(NULLIF(numero, ''), '') = '' THEN $7 ELSE numero END,
			       complemento = CASE WHEN COALESCE(NULLIF(complemento, ''), '') = '' THEN $8 ELSE complemento END,
			       bairro = CASE WHEN COALESCE(NULLIF(bairro, ''), '') = '' THEN $9 ELSE bairro END,
			       cidade = CASE WHEN COALESCE(NULLIF(cidade, ''), '') = '' THEN $10 ELSE cidade END,
			       uf = CASE WHEN COALESCE(NULLIF(uf, ''), '') = '' THEN $11 ELSE uf END,
			       cep = CASE WHEN COALESCE(NULLIF(cep, ''), '') = '' THEN $12 ELSE cep END,
			       tipo_pessoa = CASE WHEN COALESCE(NULLIF(tipo_pessoa, ''), '') = '' THEN $13 ELSE tipo_pessoa END,
			       status = CASE WHEN status = 'Inativo' THEN 'Lead' ELSE status END,
			       atualizado_em = NOW()
			 WHERE id = $1`,
			empresaID,
			nome,
			strings.TrimSpace(input.Responsavel),
			strings.TrimSpace(input.Telefone),
			strings.TrimSpace(input.Email),
			strings.TrimSpace(input.Logradouro),
			strings.TrimSpace(input.Numero),
			strings.TrimSpace(input.Complemento),
			strings.TrimSpace(input.Bairro),
			strings.TrimSpace(input.Cidade),
			strings.ToUpper(strings.TrimSpace(input.UF)),
			strings.TrimSpace(input.CEP),
			tipoPessoa,
		)
		return err
	}

	_, err = db.Pool.Exec(context.Background(), `
		INSERT INTO empresas (
			data_cadastro, documento, razao_social, nome_fantasia, responsavel,
			telefone, email, logradouro, numero, complemento, bairro, cidade,
			uf, cep, tipo_pessoa, status, observacoes
		) VALUES (
			CURRENT_DATE, $1, $2, $3, $4,
			$5, $6, $7, $8, $9, $10, $11,
			$12, $13, $14, 'Lead', $15
		)`,
		doc,
		nome,
		nome,
		strings.TrimSpace(input.Responsavel),
		strings.TrimSpace(input.Telefone),
		strings.TrimSpace(input.Email),
		strings.TrimSpace(input.Logradouro),
		strings.TrimSpace(input.Numero),
		strings.TrimSpace(input.Complemento),
		strings.TrimSpace(input.Bairro),
		strings.TrimSpace(input.Cidade),
		strings.ToUpper(strings.TrimSpace(input.UF)),
		strings.TrimSpace(input.CEP),
		tipoPessoa,
		"Cadastro automático via formulário público",
	)
	return err
}

// ListarConsultoresPublico expõe uma lista simples de consultores ativos para o formulário público.
func ListarConsultoresPublico(c *gin.Context) {
	rows, err := db.Pool.Query(context.Background(), `
		SELECT nome
		  FROM usuarios
		 WHERE ativo = true
		   AND perfil IN ('Consultor', 'Admin')
		 ORDER BY nome ASC`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	defer rows.Close()

	lista := []string{"Site/Instagram"}
	for rows.Next() {
		var nome string
		if err := rows.Scan(&nome); err == nil {
			nome = strings.TrimSpace(nome)
			if nome != "" {
				lista = append(lista, nome)
			}
		}
	}

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: lista})
}

// ListarOrcamentosPublicos lista solicitações de orçamento (admin)
func ListarOrcamentosPublicos(c *gin.Context) {
	rows, err := db.Pool.Query(context.Background(),
		`SELECT id,
		        COALESCE(empresa_nome, ''),
		        COALESCE(responsavel, ''),
		        COALESCE(email, ''),
		        COALESCE(telefone, ''),
		        COALESCE(TO_CHAR(data_interesse, 'YYYY-MM-DD'), ''),
		        COALESCE(local_nome, ''),
		        COALESCE(cidade, ''),
		        COALESCE(NULLIF(BTRIM(modalidade), ''), 'A definir'),
		        COALESCE(qtd_participantes, 0),
		        COALESCE(km, ''),
		        COALESCE(possui_kit, false),
		        COALESCE(mensagem, ''),
		        COALESCE(status, 'Novo'),
		        criado_em
		 FROM orcamentos_publicos ORDER BY criado_em DESC`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	defer rows.Close()

	var lista []models.OrcamentoPublico
	for rows.Next() {
		var o models.OrcamentoPublico
		var dataInteresse string
		if err := rows.Scan(&o.ID, &o.EmpresaNome, &o.Responsavel, &o.Email, &o.Telefone, &dataInteresse,
			&o.LocalNome, &o.Cidade, &o.Modalidade, &o.QtdParticipantes, &o.KM, &o.PossuiKit, &o.Mensagem, &o.Status, &o.CriadoEm); err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
			return
		}
		if dataInteresse != "" {
			o.DataInteresse = &dataInteresse
		}
		lista = append(lista, o)
	}
	if err := rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	if lista == nil {
		lista = []models.OrcamentoPublico{}
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: lista})
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

func ensureCatalogOwnerColumns(ctx context.Context) error {
	if _, err := db.Pool.Exec(ctx, `
		ALTER TABLE insumos
		ADD COLUMN IF NOT EXISTS criado_por_user_id UUID REFERENCES usuarios(id) ON DELETE SET NULL
	`); err != nil {
		return err
	}

	if _, err := db.Pool.Exec(ctx, `
		ALTER TABLE locais
		ADD COLUMN IF NOT EXISTS criado_por_user_id UUID REFERENCES usuarios(id) ON DELETE SET NULL
	`); err != nil {
		return err
	}

	if _, err := db.Pool.Exec(ctx, `CREATE INDEX IF NOT EXISTS idx_insumos_criado_por_user_id ON insumos(criado_por_user_id)`); err != nil {
		return err
	}
	if _, err := db.Pool.Exec(ctx, `CREATE INDEX IF NOT EXISTS idx_locais_criado_por_user_id ON locais(criado_por_user_id)`); err != nil {
		return err
	}

	return nil
}

// ListarPedidosPendentes retorna orçamentos públicos com status='Novo' para o dropdown do Gerador
func ListarPedidosPendentes(c *gin.Context) {
	rows, err := db.Pool.Query(context.Background(),
		`SELECT id,
		        COALESCE(empresa_nome, ''),
		        COALESCE(responsavel, ''),
		        COALESCE(email, ''),
		        COALESCE(telefone, ''),
		        COALESCE(TO_CHAR(data_interesse, 'YYYY-MM-DD'), ''),
		        COALESCE(local_nome, ''),
		        COALESCE(cidade, ''),
		        COALESCE(NULLIF(BTRIM(modalidade), ''), 'A definir'),
		        COALESCE(qtd_participantes, 0),
		        COALESCE(km, ''),
		        COALESCE(possui_kit, false),
		        COALESCE(mensagem, ''),
		        COALESCE(status, 'Novo'),
		        criado_em
		 FROM orcamentos_publicos
		 WHERE status = 'Novo'
		 ORDER BY criado_em DESC`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	defer rows.Close()

	var lista []models.OrcamentoPublico
	for rows.Next() {
		var o models.OrcamentoPublico
		var dataInteresse string
		if err := rows.Scan(&o.ID, &o.EmpresaNome, &o.Responsavel, &o.Email, &o.Telefone, &dataInteresse,
			&o.LocalNome, &o.Cidade, &o.Modalidade, &o.QtdParticipantes, &o.KM, &o.PossuiKit, &o.Mensagem, &o.Status, &o.CriadoEm); err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
			return
		}
		if dataInteresse != "" {
			o.DataInteresse = &dataInteresse
		}
		lista = append(lista, o)
	}
	if err := rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	if lista == nil {
		lista = []models.OrcamentoPublico{}
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: lista})
}

// itoa converte int para string (evita import strconv em todo lugar)
func itoa(n int) string {
	return fmt.Sprintf("%d", n)
}

func getEnv(key, fallback string) string {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	return v
}

func orDefaultText(value string, fallback string) string {
	v := strings.TrimSpace(value)
	if v == "" {
		return fallback
	}
	return v
}
