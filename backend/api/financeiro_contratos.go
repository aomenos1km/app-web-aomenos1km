package api

import (
	"context"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/aomenos1km/app-web/db"
	"github.com/aomenos1km/app-web/models"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

type ParcelaContrato struct {
	ID                      string  `json:"id"`
	ContratoID              string  `json:"contrato_id"`
	ContratoNomeEvento      string  `json:"contrato_nome_evento"`
	ContratoEmpresaNome     string  `json:"contrato_empresa_nome"`
	ContratoConsultor       string  `json:"contrato_consultor"`
	BaixadoPorNome          string  `json:"baixado_por_nome"`
	NumeroParcela           int     `json:"numero_parcela"`
	ValorPrevisto           float64 `json:"valor_previsto"`
	ValorRecebido           float64 `json:"valor_recebido"`
	Vencimento              string  `json:"vencimento"`
	DataPagamento           string  `json:"data_pagamento"`
	FormaPagamentoEsperada  string  `json:"forma_pagamento_esperada"`
	FormaPagamentoRealizada string  `json:"forma_pagamento_realizada"`
	Status                  string  `json:"status"`
	Observacoes             string  `json:"observacoes"`
	CriadoEm                string  `json:"criado_em"`
	AtualizadoEm            string  `json:"atualizado_em"`
}

type ParcelaContratoInput struct {
	NumeroParcela          int     `json:"numero_parcela" binding:"required"`
	ValorPrevisto          float64 `json:"valor_previsto" binding:"required"`
	Vencimento             string  `json:"vencimento" binding:"required"`
	FormaPagamentoEsperada string  `json:"forma_pagamento_esperada"`
	Observacoes            string  `json:"observacoes"`
}

type SalvarParcelasContratoInput struct {
	Parcelas []ParcelaContratoInput `json:"parcelas" binding:"required"`
}

type BaixaParcelaInput struct {
	ValorRecebido           float64 `json:"valor_recebido"`
	DataPagamento           string  `json:"data_pagamento"`
	FormaPagamentoRealizada string  `json:"forma_pagamento_realizada"`
	Observacoes             string  `json:"observacoes"`
}

type FinanceiroResumoSerie struct {
	Key        string  `json:"key"`
	Label      string  `json:"label"`
	Contratado float64 `json:"contratado"`
	Recebido   float64 `json:"recebido"`
}

type FinanceiroResumoResponse struct {
	Contratado         float64                 `json:"contratado"`
	Recebido           float64                 `json:"recebido"`
	Saldo              float64                 `json:"saldo"`
	PercentualRecebido float64                 `json:"percentual_recebido"`
	TotalContratos     int                     `json:"total_contratos"`
	Series             []FinanceiroResumoSerie `json:"series"`
}

type contratoFinanceiroBase struct {
	ID         string
	ValorTotal float64
	DataEvento *time.Time
	Retroativo bool
	Consultor  string
	Status     string
}

func parseDateISO(value string) (*time.Time, error) {
	v := strings.TrimSpace(value)
	if v == "" {
		return nil, nil
	}
	t, err := time.Parse("2006-01-02", v)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func recalcContratoValorPago(ctx context.Context, contratoID string) error {
	var total float64
	err := db.Pool.QueryRow(ctx, `
		SELECT COALESCE(SUM(valor_recebido), 0)
		FROM contrato_parcelas
		WHERE contrato_id = $1
		  AND LOWER(status) = 'recebido'
	`, contratoID).Scan(&total)
	if err != nil {
		return err
	}

	_, err = db.Pool.Exec(ctx, `UPDATE contratos SET valor_pago = $1, atualizado_em = NOW() WHERE id = $2`, total, contratoID)
	return err
}

func ListarParcelasFinanceiro(c *gin.Context) {
	authUser := getAuthzUser(c)
	ctx := c.Request.Context()

	contratoID := strings.TrimSpace(c.Query("contrato_id"))
	status := strings.TrimSpace(c.Query("status"))
	consultor := strings.TrimSpace(c.Query("consultor"))
	if !authUser.IsAdmin() {
		consultor = authUser.Nome
	}

	query := `
		SELECT cp.id::text,
		       cp.contrato_id::text,
		       COALESCE(c.nome_evento, ''),
		       COALESCE(c.empresa_nome, ''),
		       COALESCE(c.consultor, ''),
		       COALESCE(ub.nome, ''),
		       cp.numero_parcela,
		       COALESCE(cp.valor_previsto, 0),
		       COALESCE(cp.valor_recebido, 0),
		       cp.vencimento::text,
		       COALESCE(cp.data_pagamento::text, ''),
		       COALESCE(cp.forma_pagamento_esperada, ''),
		       COALESCE(cp.forma_pagamento_realizada, ''),
		       COALESCE(cp.status, ''),
		       COALESCE(cp.observacoes, ''),
		       cp.criado_em::text,
		       cp.atualizado_em::text
		FROM contrato_parcelas cp
		JOIN contratos c ON c.id = cp.contrato_id
		LEFT JOIN usuarios ub ON ub.id = cp.baixado_por_user_id
		WHERE 1=1`
	args := []interface{}{}
	argIdx := 1

	if contratoID != "" {
		query += fmt.Sprintf(" AND cp.contrato_id = $%d", argIdx)
		args = append(args, contratoID)
		argIdx++
	}
	if status != "" {
		query += fmt.Sprintf(" AND LOWER(cp.status) = LOWER($%d)", argIdx)
		args = append(args, status)
		argIdx++
	}
	if consultor != "" {
		query += fmt.Sprintf(" AND c.consultor ILIKE $%d", argIdx)
		args = append(args, "%"+consultor+"%")
		argIdx++
	}

	query += " ORDER BY cp.vencimento ASC, cp.numero_parcela ASC"

	rows, err := db.Pool.Query(ctx, query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	defer rows.Close()

	result := []ParcelaContrato{}
	for rows.Next() {
		var p ParcelaContrato
		if err := rows.Scan(
			&p.ID,
			&p.ContratoID,
			&p.ContratoNomeEvento,
			&p.ContratoEmpresaNome,
			&p.ContratoConsultor,
			&p.BaixadoPorNome,
			&p.NumeroParcela,
			&p.ValorPrevisto,
			&p.ValorRecebido,
			&p.Vencimento,
			&p.DataPagamento,
			&p.FormaPagamentoEsperada,
			&p.FormaPagamentoRealizada,
			&p.Status,
			&p.Observacoes,
			&p.CriadoEm,
			&p.AtualizadoEm,
		); err == nil {
			result = append(result, p)
		}
	}

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: result})
}

func ListarParcelasContrato(c *gin.Context) {
	contratoID := strings.TrimSpace(c.Param("id"))
	authUser := getAuthzUser(c)
	ctx := c.Request.Context()

	if !authUser.IsAdmin() {
		canAccess, err := canAccessContrato(ctx, authUser, contratoID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
			return
		}
		if !canAccess {
			rejectForbidden(c, "Você não tem permissão para acessar este contrato")
			return
		}
	}

	c.Request.URL.RawQuery = "contrato_id=" + contratoID
	ListarParcelasFinanceiro(c)
}

func SalvarParcelasContrato(c *gin.Context) {
	contratoID := strings.TrimSpace(c.Param("id"))
	authUser := getAuthzUser(c)
	ctx := c.Request.Context()

	if !authUser.IsAdmin() {
		canAccess, err := canAccessContrato(ctx, authUser, contratoID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
			return
		}
		if !canAccess {
			rejectForbidden(c, "Você não tem permissão para editar este contrato")
			return
		}
	}

	var input SalvarParcelasContratoInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	if len(input.Parcelas) == 0 {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Informe ao menos uma parcela"})
		return
	}

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `
		DELETE FROM contrato_parcelas
		WHERE contrato_id = $1
		  AND LOWER(status) <> 'recebido'
	`, contratoID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	for _, parc := range input.Parcelas {
		if parc.NumeroParcela < 1 {
			c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Número da parcela inválido"})
			return
		}
		if parc.ValorPrevisto <= 0 {
			c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Valor da parcela deve ser maior que zero"})
			return
		}
		vencimento, err := parseDateISO(parc.Vencimento)
		if err != nil || vencimento == nil {
			c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Vencimento inválido (use YYYY-MM-DD)"})
			return
		}

		_, err = tx.Exec(ctx, `
			INSERT INTO contrato_parcelas (
				contrato_id, numero_parcela, valor_previsto, vencimento,
				forma_pagamento_esperada, observacoes, status, criado_por_user_id
			) VALUES (
				$1, $2, $3, $4, $5, $6, 'Pendente', NULLIF($7, '')::uuid
			)
			ON CONFLICT (contrato_id, numero_parcela) DO UPDATE
			SET valor_previsto = EXCLUDED.valor_previsto,
			    vencimento = EXCLUDED.vencimento,
			    forma_pagamento_esperada = EXCLUDED.forma_pagamento_esperada,
			    observacoes = EXCLUDED.observacoes,
			    atualizado_em = NOW()
			WHERE LOWER(contrato_parcelas.status) <> 'recebido'
		`, contratoID, parc.NumeroParcela, parc.ValorPrevisto, *vencimento,
			strings.TrimSpace(parc.FormaPagamentoEsperada), strings.TrimSpace(parc.Observacoes), authUser.ID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
			return
		}
	}

	if err := tx.Commit(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	_ = recalcContratoValorPago(ctx, contratoID)
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Message: "Plano de parcelas salvo com sucesso"})
}

func ExcluirParcelasContrato(c *gin.Context) {
	contratoID := strings.TrimSpace(c.Param("id"))
	authUser := getAuthzUser(c)
	ctx := c.Request.Context()

	if !authUser.IsAdmin() {
		rejectForbidden(c, "Apenas administradores podem excluir planos de parcelas")
		return
	}

	result, err := db.Pool.Exec(ctx, `
		DELETE FROM contrato_parcelas
		WHERE contrato_id = $1
		  AND LOWER(status) <> 'recebido'
	`, contratoID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	deleted := result.RowsAffected()
	_ = recalcContratoValorPago(ctx, contratoID)
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Message: fmt.Sprintf("%d parcela(s) excluída(s)", deleted)})
}

func DarBaixaParcela(c *gin.Context) {
	parcelaID := strings.TrimSpace(c.Param("id"))
	authUser := getAuthzUser(c)
	ctx := c.Request.Context()

	if !authUser.IsAdmin() {
		rejectForbidden(c, "Apenas administradores podem dar baixa/editar pagamentos")
		return
	}

	if strings.TrimSpace(authUser.ID) == "" && strings.TrimSpace(authUser.Login) != "" {
		var resolvedID string
		if err := db.Pool.QueryRow(ctx, `SELECT id::text FROM usuarios WHERE login = $1 LIMIT 1`, authUser.Login).Scan(&resolvedID); err == nil {
			authUser.ID = strings.TrimSpace(resolvedID)
		}
	}
	if strings.TrimSpace(authUser.ID) == "" && strings.TrimSpace(authUser.Nome) != "" {
		var resolvedID string
		if err := db.Pool.QueryRow(ctx, `
			SELECT id::text
			FROM usuarios
			WHERE LOWER(TRIM(nome)) = LOWER(TRIM($1))
			ORDER BY criado_em ASC
			LIMIT 1
		`, authUser.Nome).Scan(&resolvedID); err == nil {
			authUser.ID = strings.TrimSpace(resolvedID)
		}
	}

	var input BaixaParcelaInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	var contratoID string
	var valorPrevisto float64
	err := db.Pool.QueryRow(ctx, `
		SELECT contrato_id::text, COALESCE(valor_previsto, 0)
		FROM contrato_parcelas
		WHERE id = $1
	`, parcelaID).Scan(&contratoID, &valorPrevisto)
	if err != nil {
		if err == pgx.ErrNoRows {
			c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: "Parcela não encontrada"})
			return
		}
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	dataPgto, err := parseDateISO(input.DataPagamento)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Data de pagamento inválida (use YYYY-MM-DD)"})
		return
	}
	if dataPgto == nil {
		now := time.Now()
		dataPgto = &now
	}

	valorRecebido := input.ValorRecebido
	if valorRecebido <= 0 {
		valorRecebido = valorPrevisto
	}

	_, err = db.Pool.Exec(ctx, `
		UPDATE contrato_parcelas
		SET status = 'Recebido',
		    valor_recebido = $2,
		    data_pagamento = $3,
		    forma_pagamento_realizada = $4,
		    observacoes = CASE WHEN COALESCE($5, '') = '' THEN observacoes ELSE $5 END,
		    baixado_por_user_id = COALESCE(NULLIF($6, '')::uuid, baixado_por_user_id),
		    atualizado_em = NOW()
		WHERE id = $1
	`, parcelaID, valorRecebido, *dataPgto, strings.TrimSpace(input.FormaPagamentoRealizada), strings.TrimSpace(input.Observacoes), authUser.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	_ = recalcContratoValorPago(ctx, contratoID)
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Message: "Parcela baixada com sucesso"})
}

func carregarContratosFinanceiroBase(ctx context.Context, authUser authzUser) (map[string]contratoFinanceiroBase, error) {
	query := `
		SELECT c.id::text,
		       COALESCE(c.valor_total, 0),
		       c.data_evento,
		       (LOWER(COALESCE(c.descricao, '') || ' ' || COALESCE(c.observacoes, '')) LIKE '%[origem:retroativo]%') AS retroativo,
		       COALESCE(c.consultor, ''),
		       COALESCE(c.status, '')
		FROM contratos c
		WHERE LOWER(COALESCE(c.status, '')) NOT IN ('cancelado', 'expirado')`
	args := []interface{}{}
	if !authUser.IsAdmin() {
		query += " AND c.consultor ILIKE $1"
		args = append(args, "%"+authUser.Nome+"%")
	}

	rows, err := db.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := map[string]contratoFinanceiroBase{}
	for rows.Next() {
		var item contratoFinanceiroBase
		if err := rows.Scan(&item.ID, &item.ValorTotal, &item.DataEvento, &item.Retroativo, &item.Consultor, &item.Status); err == nil {
			result[item.ID] = item
		}
	}
	return result, nil
}

func monthLabelsByPeriod(periodo string, now time.Time) []time.Time {
	labels := []time.Time{}
	push := func(d time.Time) {
		labels = append(labels, time.Date(d.Year(), d.Month(), 1, 0, 0, 0, 0, time.UTC))
	}

	switch periodo {
	case "3m":
		for i := 2; i >= 0; i-- {
			push(now.AddDate(0, -i, 0))
		}
	case "ano":
		for m := 1; m <= int(now.Month()); m++ {
			push(time.Date(now.Year(), time.Month(m), 1, 0, 0, 0, 0, time.UTC))
		}
	case "12m":
		for i := 11; i >= 0; i-- {
			push(now.AddDate(0, -i, 0))
		}
	default:
		push(now)
	}

	return labels
}

func isDateInsidePeriod(ref *time.Time, periodo string, now time.Time) bool {
	if ref == nil {
		return false
	}
	r := time.Date(ref.Year(), ref.Month(), ref.Day(), 0, 0, 0, 0, time.UTC)
	n := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)

	switch periodo {
	case "mes":
		return r.Year() == n.Year() && r.Month() == n.Month()
	case "3m":
		start := time.Date(n.Year(), n.Month(), 1, 0, 0, 0, 0, time.UTC).AddDate(0, -2, 0)
		return !r.Before(start) && !r.After(n)
	case "ano":
		start := time.Date(n.Year(), 1, 1, 0, 0, 0, 0, time.UTC)
		return !r.Before(start) && !r.After(n)
	case "12m":
		start := time.Date(n.Year(), n.Month(), 1, 0, 0, 0, 0, time.UTC).AddDate(0, -11, 0)
		return !r.Before(start) && !r.After(n)
	default:
		return r.Year() == n.Year() && r.Month() == n.Month()
	}
}

func contratoPassaFiltroTipo(ct contratoFinanceiroBase, tipo string) bool {
	switch strings.ToLower(strings.TrimSpace(tipo)) {
	case "retroativos":
		return ct.Retroativo
	case "comerciais":
		return !ct.Retroativo
	default:
		return true
	}
}

func monthKey(t time.Time) string {
	return fmt.Sprintf("%04d-%02d", t.Year(), int(t.Month()))
}

func monthLabel(t time.Time) string {
	meses := []string{"jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"}
	m := int(t.Month())
	if m < 1 || m > 12 {
		m = 1
	}
	return fmt.Sprintf("%s/%02d", meses[m-1], t.Year()%100)
}

func BuscarResumoFinanceiroContratos(c *gin.Context) {
	authUser := getAuthzUser(c)
	ctx := c.Request.Context()
	periodo := strings.TrimSpace(c.DefaultQuery("periodo", "mes"))
	tipo := strings.TrimSpace(c.DefaultQuery("tipo", "comerciais"))
	now := time.Now()

	baseContratos, err := carregarContratosFinanceiroBase(ctx, authUser)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	labels := monthLabelsByPeriod(periodo, now)
	bucket := map[string]*FinanceiroResumoSerie{}
	for _, d := range labels {
		k := monthKey(d)
		bucket[k] = &FinanceiroResumoSerie{Key: k, Label: monthLabel(d)}
	}

	contratado := 0.0
	totalContratos := 0
	for _, ct := range baseContratos {
		if !contratoPassaFiltroTipo(ct, tipo) {
			continue
		}
		if !isDateInsidePeriod(ct.DataEvento, periodo, now) {
			continue
		}
		totalContratos++
		contratado += ct.ValorTotal
		if ct.DataEvento != nil {
			k := monthKey(time.Date(ct.DataEvento.Year(), ct.DataEvento.Month(), 1, 0, 0, 0, 0, time.UTC))
			if b, ok := bucket[k]; ok {
				b.Contratado += ct.ValorTotal
			}
		}
	}

	recebido := 0.0
	// 1) Recebimentos por parcelas (corporativo e outros fluxos manuais)
	rowsParcelas, err := db.Pool.Query(ctx, `
		SELECT contrato_id::text,
		       COALESCE(valor_recebido, 0),
		       data_pagamento
		FROM contrato_parcelas
		WHERE LOWER(status) = 'recebido'
	`)
	if err == nil {
		defer rowsParcelas.Close()
		for rowsParcelas.Next() {
			var contratoID string
			var valor float64
			var dataPgto *time.Time
			if err := rowsParcelas.Scan(&contratoID, &valor, &dataPgto); err != nil {
				continue
			}
			ct, ok := baseContratos[contratoID]
			if !ok || !contratoPassaFiltroTipo(ct, tipo) || !isDateInsidePeriod(dataPgto, periodo, now) {
				continue
			}
			recebido += valor
			if dataPgto != nil {
				k := monthKey(time.Date(dataPgto.Year(), dataPgto.Month(), 1, 0, 0, 0, 0, time.UTC))
				if b, ok := bucket[k]; ok {
					b.Recebido += valor
				}
			}
		}
	}

	// 2) Recebimentos por ingresso confirmado (gateway)
	rowsIngressos, err := db.Pool.Query(ctx, `
		SELECT p.contrato_id::text,
		       COALESCE(c.preco_ingresso, 0),
		       COALESCE(p.atualizado_em, p.criado_em)
		FROM participantes p
		JOIN contratos c ON c.id = p.contrato_id
		WHERE UPPER(COALESCE(p.status_pagamento, '')) IN ('CONFIRMADO', 'CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH')
		  AND COALESCE(c.preco_ingresso, 0) > 0
	`)
	if err == nil {
		defer rowsIngressos.Close()
		for rowsIngressos.Next() {
			var contratoID string
			var valor float64
			var dataRef time.Time
			if err := rowsIngressos.Scan(&contratoID, &valor, &dataRef); err != nil {
				continue
			}
			ct, ok := baseContratos[contratoID]
			if !ok || !contratoPassaFiltroTipo(ct, tipo) {
				continue
			}
			d := dataRef
			if !isDateInsidePeriod(&d, periodo, now) {
				continue
			}
			recebido += valor
			k := monthKey(time.Date(d.Year(), d.Month(), 1, 0, 0, 0, 0, time.UTC))
			if b, ok := bucket[k]; ok {
				b.Recebido += valor
			}
		}
	}

	saldo := contratado - recebido
	if saldo < 0 {
		saldo = 0
	}
	percentual := 0.0
	if contratado > 0 {
		percentual = (recebido / contratado) * 100
	}

	series := []FinanceiroResumoSerie{}
	keys := make([]string, 0, len(bucket))
	for k := range bucket {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		series = append(series, *bucket[k])
	}

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: FinanceiroResumoResponse{
		Contratado:         contratado,
		Recebido:           recebido,
		Saldo:              saldo,
		PercentualRecebido: percentual,
		TotalContratos:     totalContratos,
		Series:             series,
	}})
}
