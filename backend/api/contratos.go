package api

import (
	"context"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/aomenos1km/app-web/db"
	"github.com/aomenos1km/app-web/models"
	"github.com/gin-gonic/gin"
)

const (
	contratoStatusNovoPedido     = "Novo Pedido"
	contratoStatusEmNegociacao   = "Em Negociação"
	contratoStatusAguardandoPgto = "Aguardando PGTO"
	contratoStatusConfirmado     = "Confirmado"
	contratoStatusCancelado      = "Cancelado"
	contratoStatusExpirado       = "Expirado"
	contratoStatusFinalizado     = "Finalizado"
)

var slugRegex = regexp.MustCompile(`[^a-z0-9]+`)
var slugLeadingNumericPrefixRegex = regexp.MustCompile(`^(?:\d+[.\-/\s]*){2,}`)
var fixLegacyConsultorOnce sync.Once

func cleanCheckinSlugPart(value string) string {
	v := strings.TrimSpace(value)
	v = slugLeadingNumericPrefixRegex.ReplaceAllString(v, "")
	return strings.TrimSpace(v)
}

func slugifyCheckin(value string) string {
	v := strings.ToLower(strings.TrimSpace(value))
	replacer := strings.NewReplacer(
		"á", "a", "à", "a", "â", "a", "ã", "a", "ä", "a",
		"é", "e", "è", "e", "ê", "e", "ë", "e",
		"í", "i", "ì", "i", "î", "i", "ï", "i",
		"ó", "o", "ò", "o", "ô", "o", "õ", "o", "ö", "o",
		"ú", "u", "ù", "u", "û", "u", "ü", "u",
		"ç", "c",
	)
	v = replacer.Replace(v)
	v = slugRegex.ReplaceAllString(v, "-")
	v = strings.Trim(v, "-")
	return v
}

func buildCheckinSlug(empresaNome string, nomeEvento string) string {
	base := cleanCheckinSlugPart(empresaNome)
	evento := cleanCheckinSlugPart(nomeEvento)
	if evento != "" {
		base = strings.TrimSpace(base + " " + evento)
	}
	return slugifyCheckin(base)
}

func buildPreferredCheckinSlug(nomeEvento string, empresaNome string, dataEvento *string, existing []models.ContratoPublico) string {
	eventoBase := slugifyCheckin(cleanCheckinSlugPart(nomeEvento))
	empresaBase := slugifyCheckin(cleanCheckinSlugPart(empresaNome))
	anoEvento := ""
	if dataEvento != nil {
		raw := strings.TrimSpace(*dataEvento)
		if len(raw) >= 4 {
			anoEvento = raw[:4]
		}
	}

	if eventoBase == "" {
		eventoBase = buildCheckinSlug(empresaNome, nomeEvento)
	}

	countEvento := 0
	countEventoEmpresa := 0
	for _, cand := range existing {
		candEvento := slugifyCheckin(cleanCheckinSlugPart(cand.NomeEvento))
		candEmpresa := slugifyCheckin(cleanCheckinSlugPart(cand.EmpresaNome))
		if candEvento == eventoBase {
			countEvento++
		}
		if candEvento == eventoBase && candEmpresa == empresaBase {
			countEventoEmpresa++
		}
	}

	if countEvento <= 1 {
		return eventoBase
	}
	if empresaBase != "" && countEventoEmpresa <= 1 {
		return strings.Trim(strings.Join([]string{eventoBase, empresaBase}, "-"), "-")
	}
	if anoEvento != "" {
		return strings.Trim(strings.Join([]string{eventoBase, anoEvento}, "-"), "-")
	}
	if empresaBase != "" && anoEvento != "" {
		return strings.Trim(strings.Join([]string{eventoBase, empresaBase, anoEvento}, "-"), "-")
	}
	return eventoBase
}

func normalizeSlugCompare(value string) string {
	return strings.ReplaceAll(slugifyCheckin(value), "-", "")
}

func normalizeContratoStatus(raw string) string {
	status := strings.TrimSpace(raw)
	if status == "" {
		return ""
	}

	lower := strings.ToLower(status)
	switch {
	case strings.Contains(lower, "novo") || strings.Contains(lower, "pedido"):
		return contratoStatusNovoPedido
	case strings.Contains(lower, "lead") || strings.Contains(lower, "proposta") || strings.Contains(lower, "negocia") || strings.Contains(lower, "análise") || strings.Contains(lower, "analise"):
		return contratoStatusEmNegociacao
	case strings.Contains(lower, "aguardando") || strings.Contains(lower, "pgto") || strings.Contains(lower, "pagamento") || strings.Contains(lower, "aprovado"):
		return contratoStatusAguardandoPgto
	case strings.Contains(lower, "confirmado") || strings.Contains(lower, "execução") || strings.Contains(lower, "execucao") || strings.Contains(lower, "fechado"):
		return contratoStatusConfirmado
	case strings.Contains(lower, "cancelado"):
		return contratoStatusCancelado
	case strings.Contains(lower, "expirado"):
		return contratoStatusExpirado
	case strings.Contains(lower, "finalizado") || strings.Contains(lower, "concluído") || strings.Contains(lower, "concluido"):
		return contratoStatusFinalizado
	default:
		return status
	}
}

func canTransitionContratoStatus(_ string, next string) bool {
	n := normalizeContratoStatus(next)
	return n == contratoStatusNovoPedido ||
		n == contratoStatusEmNegociacao ||
		n == contratoStatusAguardandoPgto ||
		n == contratoStatusConfirmado ||
		n == contratoStatusCancelado ||
		n == contratoStatusExpirado ||
		n == contratoStatusFinalizado
}

func normalizarStatusContratosNoBanco() {
	_, _ = db.Pool.Exec(context.Background(), `
		UPDATE contratos
		   SET status = CASE
			WHEN status ILIKE '%cancelado%' THEN 'Cancelado'
			WHEN status ILIKE '%expirado%' THEN 'Expirado'
			WHEN status ILIKE '%finalizado%' OR status ILIKE '%conclu%' THEN 'Finalizado'
			WHEN status ILIKE '%confirmado%' OR status ILIKE '%execu%' OR status ILIKE '%fechado%' THEN 'Confirmado'
			WHEN status ILIKE '%aguardando%' OR status ILIKE '%pgto%' OR status ILIKE '%pagamento%' OR status ILIKE '%aprovado%' THEN 'Aguardando PGTO'
			WHEN status ILIKE '%lead%' OR status ILIKE '%proposta%' OR status ILIKE '%negocia%' OR status ILIKE '%analise%' THEN 'Em Negociação'
			WHEN status ILIKE '%novo%' OR status ILIKE '%pedido%' THEN 'Novo Pedido'
			ELSE status
		END
	`)
}

func aplicarRegrasStatusContratos() {
	rows, err := db.Pool.Query(context.Background(), `
		SELECT id, status, data_evento::text
		  FROM contratos
		 WHERE data_evento IS NOT NULL
		   AND status NOT IN ('Cancelado', 'Expirado', 'Finalizado')
	`)
	if err != nil {
		return
	}
	defer rows.Close()

	hoje := time.Now().Truncate(24 * time.Hour)
	for rows.Next() {
		var id string
		var status string
		var dataEvento string
		if err := rows.Scan(&id, &status, &dataEvento); err != nil {
			continue
		}
		dt, err := time.Parse("2006-01-02", dataEvento)
		if err != nil {
			continue
		}
		if !dt.Before(hoje) {
			continue
		}

		current := normalizeContratoStatus(status)
		novo := ""
		switch current {
		case contratoStatusConfirmado:
			novo = contratoStatusFinalizado
		case contratoStatusNovoPedido, contratoStatusEmNegociacao, contratoStatusAguardandoPgto:
			novo = contratoStatusExpirado
		}

		if novo != "" && novo != current {
			_, _ = db.Pool.Exec(context.Background(), `UPDATE contratos SET status = $2, atualizado_em = NOW() WHERE id = $1`, id, novo)
		}
	}
}

func corrigirConsultorContratosGeradorLegado() {
	fixLegacyConsultorOnce.Do(func() {
		_, _ = db.Pool.Exec(context.Background(), `
			WITH autor_por_proposta AS (
				SELECT DISTINCT ON (n.proposta_id)
					n.proposta_id,
					TRIM(n.autor_nome) AS autor_nome
				FROM notificacoes n
				WHERE n.proposta_id IS NOT NULL
				  AND COALESCE(TRIM(n.autor_nome), '') <> ''
				ORDER BY n.proposta_id, n.criado_em DESC
			),
			alvos AS (
				SELECT c.id AS contrato_id, ap.autor_nome AS novo_consultor, p.responsavel AS responsavel_proposta
				FROM contratos c
				JOIN LATERAL (
					SELECT p.id, COALESCE(TRIM(p.responsavel), '') AS responsavel
					FROM propostas p
					WHERE p.status = 'Convertida'
					  AND COALESCE(p.empresa_id::text, '') = COALESCE(c.empresa_id::text, '')
					  AND LOWER(COALESCE(p.empresa_nome, '')) = LOWER(COALESCE(c.empresa_nome, ''))
					  AND LOWER(COALESCE(p.evento_nome, '')) = LOWER(COALESCE(c.nome_evento, ''))
					  AND COALESCE(p.data_evento::date, DATE '1900-01-01') = COALESCE(c.data_evento::date, DATE '1900-01-01')
					ORDER BY ABS(EXTRACT(EPOCH FROM (c.criado_em - p.atualizado_em))) ASC
					LIMIT 1
				) p ON TRUE
				JOIN autor_por_proposta ap ON ap.proposta_id = p.id
				WHERE LOWER(COALESCE(c.descricao, '')) LIKE '%[origem:gerador]%'
				  AND COALESCE(TRIM(c.consultor), '') <> ''
				  AND LOWER(TRIM(c.consultor)) = LOWER(p.responsavel)
				  AND LOWER(TRIM(c.consultor)) <> LOWER(ap.autor_nome)
			)
			UPDATE contratos c
			SET consultor = alvos.novo_consultor,
			    atualizado_em = NOW()
			FROM alvos
			WHERE c.id = alvos.contrato_id
		`)
	})
}

// ListarContratos retorna todos os contratos com filtros opcionais
func ListarContratos(c *gin.Context) {
	corrigirConsultorContratosGeradorLegado()
	normalizarStatusContratosNoBanco()
	aplicarRegrasStatusContratos()
	authUser := getAuthzUser(c)

	status := normalizeContratoStatus(c.Query("status"))
	consultor := c.Query("consultor")
	pipelineOnly := strings.EqualFold(c.Query("pipeline"), "true")
	allowGlobal := strings.EqualFold(c.Query("allow_global"), "true")
	if !authUser.IsAdmin() && !allowGlobal {
		consultor = authUser.Nome
	}

	query := `
		SELECT 
			c.id, c.data_criacao::text, c.empresa_id, COALESCE(c.empresa_nome, ''), COALESCE(c.descricao, ''),
			COALESCE(c.valor_total, 0), c.data_evento::text, c.local_id, COALESCE(c.local_nome, ''), COALESCE(c.modalidade, ''),
			COALESCE(c.qtd_contratada, 0), COALESCE(c.qtd_kit, 0), COALESCE(c.km, ''), COALESCE(c.status, ''), COALESCE(c.valor_pago, 0),
			c.data_pagamento::text, COALESCE(c.consultor, ''), COALESCE(c.possui_kit, false), COALESCE(c.tipo_kit, ''),
			COALESCE(c.link_gateway, ''), COALESCE(c.qr_code_pix, ''), COALESCE(c.nome_evento, ''), COALESCE(c.capa_url, ''),
			COALESCE(c.observacoes, ''), COALESCE(c.pix_copia_cola, ''), c.criado_em, c.atualizado_em,
			COUNT(p.id) AS qtd_inscritos
		FROM contratos c
		LEFT JOIN participantes p ON p.contrato_id = c.id
		WHERE 1=1`

	args := []interface{}{}
	argIdx := 1

	if status != "" {
		query += fmt.Sprintf(" AND c.status = $%d", argIdx)
		args = append(args, status)
		argIdx++
	}
	if consultor != "" {
		query += fmt.Sprintf(" AND c.consultor ILIKE $%d", argIdx)
		args = append(args, "%"+consultor+"%")
		argIdx++
	}
	if pipelineOnly {
		query += " AND c.status IN ('Novo Pedido', 'Em Negociação', 'Aguardando PGTO', 'Confirmado')"
	}

	query += " GROUP BY c.id ORDER BY c.data_evento DESC NULLS LAST"

	rows, err := db.Pool.Query(context.Background(), query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	defer rows.Close()

	var contratos []models.Contrato
	for rows.Next() {
		var ct models.Contrato
		err := rows.Scan(
			&ct.ID, &ct.DataCriacao, &ct.EmpresaID, &ct.EmpresaNome, &ct.Descricao,
			&ct.ValorTotal, &ct.DataEvento, &ct.LocalID, &ct.LocalNome, &ct.Modalidade,
			&ct.QtdContratada, &ct.QtdKit, &ct.KM, &ct.Status, &ct.ValorPago,
			&ct.DataPagamento, &ct.Consultor, &ct.PossuiKit, &ct.TipoKit,
			&ct.LinkGateway, &ct.QRCodePix, &ct.NomeEvento, &ct.CapaURL,
			&ct.Observacoes, &ct.PixCopiaECola, &ct.CriadoEm, &ct.AtualizadoEm,
			&ct.QtdInscritos,
		)
		if err != nil {
			continue
		}
		ct.Status = normalizeContratoStatus(ct.Status)
		contratos = append(contratos, ct)
	}

	if contratos == nil {
		contratos = []models.Contrato{}
	}

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: contratos})
}

// BuscarContrato retorna um contrato pelo ID
func BuscarContrato(c *gin.Context) {
	id := c.Param("id")
	authUser := getAuthzUser(c)
	ctx := c.Request.Context()
	if !authUser.IsAdmin() {
		canAccess, err := canAccessContrato(ctx, authUser, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
			return
		}
		if !canAccess {
			rejectForbidden(c, "Você não tem permissão para acessar este evento")
			return
		}
	}

	var ct models.Contrato
	err := db.Pool.QueryRow(ctx, `
		SELECT 
			c.id, c.data_criacao::text, c.empresa_id, COALESCE(c.empresa_nome, ''), COALESCE(c.descricao, ''),
			COALESCE(c.valor_total, 0), c.data_evento::text, c.local_id, COALESCE(c.local_nome, ''), COALESCE(c.modalidade, ''),
			COALESCE(c.qtd_contratada, 0), COALESCE(c.qtd_kit, 0), COALESCE(c.km, ''), COALESCE(c.status, ''), COALESCE(c.valor_pago, 0),
			c.data_pagamento::text, COALESCE(c.consultor, ''), COALESCE(c.possui_kit, false), COALESCE(c.tipo_kit, ''),
			COALESCE(c.link_gateway, ''), COALESCE(c.qr_code_pix, ''), COALESCE(c.nome_evento, ''), COALESCE(c.capa_url, ''),
			COALESCE(c.observacoes, ''), COALESCE(c.pix_copia_cola, ''), c.criado_em, c.atualizado_em,
			COUNT(p.id) AS qtd_inscritos
		FROM contratos c
		LEFT JOIN participantes p ON p.contrato_id = c.id
		WHERE c.id = $1
		GROUP BY c.id
	`, id).Scan(
		&ct.ID, &ct.DataCriacao, &ct.EmpresaID, &ct.EmpresaNome, &ct.Descricao,
		&ct.ValorTotal, &ct.DataEvento, &ct.LocalID, &ct.LocalNome, &ct.Modalidade,
		&ct.QtdContratada, &ct.QtdKit, &ct.KM, &ct.Status, &ct.ValorPago,
		&ct.DataPagamento, &ct.Consultor, &ct.PossuiKit, &ct.TipoKit,
		&ct.LinkGateway, &ct.QRCodePix, &ct.NomeEvento, &ct.CapaURL,
		&ct.Observacoes, &ct.PixCopiaECola, &ct.CriadoEm, &ct.AtualizadoEm,
		&ct.QtdInscritos,
	)
	if err != nil {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: "Contrato não encontrado"})
		return
	}
	ct.Status = normalizeContratoStatus(ct.Status)

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: ct})
}

// BuscarContratoPublico retorna dados públicos do contrato para o formulário de check-in
func BuscarContratoPublico(c *gin.Context) {
	id := c.Param("id")

	var ct models.ContratoPublico
	var qtdContratada int
	err := db.Pool.QueryRow(context.Background(), `
		SELECT id,
		       COALESCE(empresa_nome, ''),
		       COALESCE(nome_evento, ''),
		       COALESCE(valor_total, 0),
		       data_evento::text,
		       COALESCE(local_nome, ''),
		       COALESCE(modalidade, ''),
		       COALESCE(link_gateway, ''),
		       COALESCE(qr_code_pix, ''),
		       COALESCE(capa_url, ''),
		       COALESCE(pix_copia_cola, ''),
		       preco_ingresso,
		       qtd_contratada
		FROM contratos
		WHERE id = $1 OR REPLACE(id, '''', '') = $1
		LIMIT 1
	`, id).Scan(
		&ct.ID, &ct.EmpresaNome, &ct.NomeEvento, &ct.ValorTotal, &ct.DataEvento,
		&ct.LocalNome, &ct.Modalidade, &ct.LinkGateway, &ct.QRCodePix, &ct.CapaURL, &ct.PixCopiaECola,
		&ct.PrecoIngresso, &qtdContratada,
	)
	if err != nil {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: "Evento não encontrado"})
		return
	}

	// Conta inscritos
	var inscritos int
	_ = db.Pool.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM participantes WHERE contrato_id = $1`, id).Scan(&inscritos)

	ct.VagasTotal = qtdContratada
	ct.VagasOcupadas = inscritos
	if qtdContratada > 0 {
		pct := (inscritos * 100) / qtdContratada
		if pct > 100 {
			pct = 100
		}
		ct.PercentualVagas = pct
	}

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: ct})
}

// BuscarContratoPublicoPorSlug resolve evento público por slug amigável.
func BuscarContratoPublicoPorSlug(c *gin.Context) {
	slug := slugifyCheckin(c.Param("slug"))
	if slug == "" {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Slug inválido"})
		return
	}

	rows, err := db.Pool.Query(context.Background(), `
		SELECT id,
		       COALESCE(empresa_nome, ''),
		       COALESCE(nome_evento, ''),
		       COALESCE(descricao, ''),
		       COALESCE(valor_total, 0),
		       data_evento::text,
		       COALESCE(local_nome, ''),
		       COALESCE(modalidade, ''),
		       COALESCE(link_gateway, ''),
		       COALESCE(qr_code_pix, ''),
		       COALESCE(capa_url, ''),
		       COALESCE(pix_copia_cola, ''),
		       preco_ingresso,
		       COALESCE(qtd_contratada, 0),
		       COALESCE(status, '')
		FROM contratos
		ORDER BY data_evento DESC NULLS LAST, criado_em DESC
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	defer rows.Close()

	var candidatos []models.ContratoPublico
	type contratoMeta struct {
		Qtd       int
		Descricao string
		Status    string
	}
	metas := map[string]contratoMeta{}

	for rows.Next() {
		var cand models.ContratoPublico
		var descricao string
		var candQtd int
		var status string
		if err := rows.Scan(
			&cand.ID, &cand.EmpresaNome, &cand.NomeEvento, &descricao, &cand.ValorTotal, &cand.DataEvento,
			&cand.LocalNome, &cand.Modalidade, &cand.LinkGateway, &cand.QRCodePix, &cand.CapaURL, &cand.PixCopiaECola,
			&cand.PrecoIngresso, &candQtd, &status,
		); err != nil {
			continue
		}
		candidatos = append(candidatos, cand)
		metas[cand.ID] = contratoMeta{Qtd: candQtd, Descricao: descricao, Status: status}
	}

	var ct models.ContratoPublico
	var qtdContratada int
	found := false

	for _, cand := range candidatos {
		meta := metas[cand.ID]
		descricao := meta.Descricao
		candQtd := meta.Qtd
		candSlug := buildCheckinSlug(cand.EmpresaNome, cand.NomeEvento)
		preferredSlug := buildPreferredCheckinSlug(cand.NomeEvento, cand.EmpresaNome, cand.DataEvento, candidatos)
		slugEvento := slugifyCheckin(cand.NomeEvento)
		slugEmpresa := slugifyCheckin(cand.EmpresaNome)
		slugDescricao := slugifyCheckin(descricao)

		normalizedInput := normalizeSlugCompare(slug)
		normalizedCand := normalizeSlugCompare(candSlug)
		normalizedEvento := normalizeSlugCompare(slugEvento)
		normalizedEmpresa := normalizeSlugCompare(slugEmpresa)
		normalizedDescricao := normalizeSlugCompare(slugDescricao)

		if preferredSlug == slug || candSlug == slug || slugEvento == slug || slugEmpresa == slug || slugDescricao == slug || strings.Contains(candSlug, slug) || strings.Contains(slug, candSlug) || strings.Contains(normalizedCand, normalizedInput) || strings.Contains(normalizedInput, normalizedCand) || strings.Contains(normalizedEvento, normalizedInput) || strings.Contains(normalizedInput, normalizedEvento) || strings.Contains(normalizedEmpresa, normalizedInput) || strings.Contains(normalizedInput, normalizedEmpresa) || strings.Contains(normalizedDescricao, normalizedInput) || strings.Contains(normalizedInput, normalizedDescricao) {
			ct = cand
			qtdContratada = candQtd
			found = true
			break
		}
	}

	if !found {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: "Evento não encontrado"})
		return
	}

	var inscritos int
	_ = db.Pool.QueryRow(context.Background(), `SELECT COUNT(*) FROM participantes WHERE contrato_id = $1`, ct.ID).Scan(&inscritos)
	ct.VagasTotal = qtdContratada
	ct.VagasOcupadas = inscritos
	if qtdContratada > 0 {
		pct := (inscritos * 100) / qtdContratada
		if pct > 100 {
			pct = 100
		}
		ct.PercentualVagas = pct
	}

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: ct})
}

// CriarContrato cria um novo contrato
func CriarContrato(c *gin.Context) {
	authUser := getAuthzUser(c)
	var input models.ContratoInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	if !authUser.IsAdmin() {
		input.Consultor = authUser.Nome
	}

	// Gera ID único no formato do sistema original (ano+timestamp)
	id := fmt.Sprintf("%d-%d", time.Now().Year(), time.Now().UnixMilli())

	_, err := db.Pool.Exec(context.Background(), `
		INSERT INTO contratos (
			id, empresa_id, empresa_nome, descricao, valor_total, data_evento,
			local_id, local_nome, modalidade, qtd_contratada, qtd_kit, km,
			status, valor_pago, data_pagamento, consultor, possui_kit, tipo_kit,
			link_gateway, qr_code_pix, nome_evento, capa_url, observacoes, pix_copia_cola
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
			$13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
		)`,
		id, input.EmpresaID, input.EmpresaNome, input.Descricao, input.ValorTotal, input.DataEvento,
		input.LocalID, input.LocalNome, input.Modalidade, input.QtdContratada, input.QtdKit, input.KM,
		orDefault(normalizeContratoStatus(input.Status), contratoStatusNovoPedido), input.ValorPago, input.DataPagamento, input.Consultor,
		input.PossuiKit, input.TipoKit, input.LinkGateway, input.QRCodePix,
		input.NomeEvento, input.CapaURL, input.Observacoes, input.PixCopiaECola,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	c.JSON(http.StatusCreated, models.APIResponse{
		Success: true,
		Message: "Contrato criado com sucesso",
		Data:    gin.H{"id": id},
	})
}

// AtualizarContrato atualiza os dados de um contrato existente
func AtualizarContrato(c *gin.Context) {
	id := c.Param("id")
	authUser := getAuthzUser(c)
	ctx := c.Request.Context()
	if !authUser.IsAdmin() {
		canAccess, err := canAccessContrato(ctx, authUser, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
			return
		}
		if !canAccess {
			rejectForbidden(c, "Você não tem permissão para editar este evento")
			return
		}
	}
	var input models.ContratoInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	if !authUser.IsAdmin() {
		input.Consultor = authUser.Nome
	}

	result, err := db.Pool.Exec(ctx, `
		UPDATE contratos SET
			empresa_id = $1, empresa_nome = $2, descricao = $3, valor_total = $4,
			data_evento = $5, local_id = $6, local_nome = $7, modalidade = $8,
			qtd_contratada = $9, qtd_kit = $10, km = $11, status = $12,
			valor_pago = $13, data_pagamento = $14, consultor = $15,
			possui_kit = $16, tipo_kit = $17, link_gateway = $18,
			qr_code_pix = $19, nome_evento = $20, capa_url = $21,
			observacoes = $22, pix_copia_cola = $23
		WHERE id = $24`,
		input.EmpresaID, input.EmpresaNome, input.Descricao, input.ValorTotal,
		input.DataEvento, input.LocalID, input.LocalNome, input.Modalidade,
		input.QtdContratada, input.QtdKit, input.KM, normalizeContratoStatus(input.Status),
		input.ValorPago, input.DataPagamento, input.Consultor,
		input.PossuiKit, input.TipoKit, input.LinkGateway,
		input.QRCodePix, input.NomeEvento, input.CapaURL,
		input.Observacoes, input.PixCopiaECola,
		id,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	if result.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: "Contrato não encontrado"})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Message: "Contrato atualizado"})
}

// DeletarContrato remove um contrato (e seus participantes via CASCADE)
func DeletarContrato(c *gin.Context) {
	id := c.Param("id")
	authUser := getAuthzUser(c)
	ctx := c.Request.Context()
	if !authUser.IsAdmin() {
		rejectForbidden(c, "Somente administradores podem remover contratos")
		return
	}

	result, err := db.Pool.Exec(ctx,
		`DELETE FROM contratos WHERE id = $1`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	if result.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: "Contrato não encontrado"})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Message: "Contrato removido"})
}

// AtualizarStatusContrato altera somente o status de um contrato (usado no Kanban).
func AtualizarStatusContrato(c *gin.Context) {
	id := c.Param("id")
	authUser := getAuthzUser(c)
	ctx := c.Request.Context()
	if !authUser.IsAdmin() {
		canAccess, err := canAccessContrato(ctx, authUser, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
			return
		}
		if !canAccess {
			rejectForbidden(c, "Você não tem permissão para alterar este evento")
			return
		}
	}
	var input models.ContratoStatusInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	next := normalizeContratoStatus(input.Status)
	if !canTransitionContratoStatus("", next) {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Status inválido para pipeline"})
		return
	}

	result, err := db.Pool.Exec(ctx, `
		UPDATE contratos
		   SET status = $2,
		       atualizado_em = NOW()
		 WHERE id = $1
	`, id, next)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	if result.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: "Contrato não encontrado"})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Message: "Status atualizado", Data: gin.H{"id": id, "status": next}})
}

func orDefault(v, d string) string {
	if v == "" {
		return d
	}
	return v
}
