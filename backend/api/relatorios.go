package api

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/aomenos1km/app-web/db"
	"github.com/aomenos1km/app-web/models"
	"github.com/gin-gonic/gin"
)

// GetDashboard retorna as estatísticas do painel principal
func GetDashboard(c *gin.Context) {
	ctx := context.Background()
	stats := models.DashboardStats{}
	now := time.Now()

	mesSelecionado := int(now.Month())
	anoSelecionado := now.Year()

	if mesParam := c.Query("mes"); mesParam != "" {
		if parsedMes, err := strconv.Atoi(mesParam); err == nil && parsedMes >= 1 && parsedMes <= 12 {
			mesSelecionado = parsedMes
		}
	}
	if anoParam := c.Query("ano"); anoParam != "" {
		if parsedAno, err := strconv.Atoi(anoParam); err == nil && parsedAno >= 2000 && parsedAno <= 2100 {
			anoSelecionado = parsedAno
		}
	}

	// Total de eventos ativos (não cancelados/finalizados/expirados)
	_ = db.Pool.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM contratos
		WHERE lower(status) NOT IN ('cancelado', 'finalizado', 'expirado')
	`).Scan(&stats.TotalEventosAtivos)

	// Eventos do período selecionado
	_ = db.Pool.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM contratos
		WHERE EXTRACT(MONTH FROM data_evento) = $1
		  AND EXTRACT(YEAR FROM data_evento) = $2
		  AND lower(status) NOT IN ('cancelado', 'expirado')
	`, mesSelecionado, anoSelecionado).Scan(&stats.TotalEventosMes)

	// Participantes registrados no período selecionado
	_ = db.Pool.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM participantes
		WHERE EXTRACT(MONTH FROM criado_em) = $1
		  AND EXTRACT(YEAR FROM criado_em) = $2
	`, mesSelecionado, anoSelecionado).Scan(&stats.TotalParticipantesMes)

	// Receita do período selecionado (apenas contratos confirmados)
	_ = db.Pool.QueryRow(ctx, `
		SELECT COALESCE(SUM(valor_total), 0)
		FROM contratos
		WHERE lower(status) = 'confirmado'
		  AND EXTRACT(MONTH FROM data_evento) = $1
		  AND EXTRACT(YEAR FROM data_evento) = $2
	`, mesSelecionado, anoSelecionado).Scan(&stats.ReceitaMes)

	// Receita total (apenas contratos confirmados)
	_ = db.Pool.QueryRow(ctx, `
		SELECT COALESCE(SUM(valor_total), 0)
		FROM contratos
		WHERE lower(status) = 'confirmado'
	`).Scan(&stats.ReceitaTotal)

	// Ocupação média global (participantes / qtd_contratada em contratos confirmados)
	_ = db.Pool.QueryRow(ctx, `
		SELECT COALESCE(
			AVG(
				CASE
					WHEN c.qtd_contratada > 0
					THEN (sub.total_part::float / c.qtd_contratada::float) * 100
					ELSE 0
				END
			),
		0)
		FROM contratos c
		LEFT JOIN (
			SELECT contrato_id, COUNT(*) AS total_part
			FROM participantes
			GROUP BY contrato_id
		) sub ON sub.contrato_id = c.id
		WHERE lower(c.status) = 'confirmado'
	`).Scan(&stats.OcupacaoMedia)

	// Próximos eventos (próximos 5)
	rows, _ := db.Pool.Query(ctx, `
		SELECT c.id, c.nome_evento, c.empresa_nome, c.data_evento::text, c.local_nome,
		       c.status, c.qtd_contratada, COUNT(p.id) AS inscritos
		FROM contratos c
		LEFT JOIN participantes p ON p.contrato_id = c.id
		WHERE c.data_evento >= CURRENT_DATE
		  AND lower(c.status) NOT IN ('cancelado', 'expirado', 'finalizado')
		GROUP BY c.id
		ORDER BY c.data_evento ASC
		LIMIT 5
	`)
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var r models.ContratoResumo
			_ = rows.Scan(&r.ID, &r.NomeEvento, &r.EmpresaNome, &r.DataEvento,
				&r.LocalNome, &r.Status, &r.QtdTotal, &r.QtdInscritos)
			stats.ProximosEventos = append(stats.ProximosEventos, r)
		}
	}
	if stats.ProximosEventos == nil {
		stats.ProximosEventos = []models.ContratoResumo{}
	}

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: stats})
}

// GetMetaMensal retorna a meta do mês e o atingimento real vs meta
func GetMetaMensal(c *gin.Context) {
	ctx := context.Background()
	now := time.Now()

	mesSelecionado := int(now.Month())
	anoSelecionado := now.Year()

	if mesParam := c.Query("mes"); mesParam != "" {
		if parsedMes, err := strconv.Atoi(mesParam); err == nil && parsedMes >= 1 && parsedMes <= 12 {
			mesSelecionado = parsedMes
		}
	}
	if anoParam := c.Query("ano"); anoParam != "" {
		if parsedAno, err := strconv.Atoi(anoParam); err == nil && parsedAno >= 2000 && parsedAno <= 2100 {
			anoSelecionado = parsedAno
		}
	}

	result := map[string]interface{}{}

	// Busca meta do período
	var metaVendas float64
	_ = db.Pool.QueryRow(ctx, `
		SELECT COALESCE(meta_vendas, 0)
		FROM metas_mensais
		WHERE mes = $1 AND ano = $2 AND ativo = true
	`, mesSelecionado, anoSelecionado).Scan(&metaVendas)

	// Busca receita realizada no período
	var receitaRealizada float64
	_ = db.Pool.QueryRow(ctx, `
		SELECT COALESCE(SUM(valor_total), 0)
		FROM contratos
		WHERE lower(status) = 'confirmado'
		  AND EXTRACT(MONTH FROM data_evento) = $1
		  AND EXTRACT(YEAR FROM data_evento) = $2
	`, mesSelecionado, anoSelecionado).Scan(&receitaRealizada)

	// Calcula percentual de atingimento
	percentualAtingimento := 0.0
	if metaVendas > 0 {
		percentualAtingimento = (receitaRealizada / metaVendas) * 100
	}

	result["meta_vendas"] = metaVendas
	result["receita_realizada"] = receitaRealizada
	result["percentual_atingimento"] = percentualAtingimento
	result["status"] = "vermelho" // <50%
	if percentualAtingimento >= 50 && percentualAtingimento < 90 {
		result["status"] = "amarelo"
	} else if percentualAtingimento >= 90 {
		result["status"] = "verde"
	}

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: result})
}

// SalvarMetaMensal atualiza a meta mensal (somente Admin)
func SalvarMetaMensal(c *gin.Context) {
	ctx := context.Background()
	mes := c.Param("mes")
	ano := c.Param("ano")

	mesInt, err := strconv.Atoi(mes)
	if err != nil || mesInt < 1 || mesInt > 12 {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Mês inválido"})
		return
	}

	anoInt, err := strconv.Atoi(ano)
	if err != nil || anoInt < 2000 || anoInt > 2100 {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Ano inválido"})
		return
	}

	var payload struct {
		MetaVendas    float64 `json:"meta_vendas"`
		MetaContratos int     `json:"meta_contratos"`
		Descricao     string  `json:"descricao"`
	}

	if err := c.BindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Dados inválidos"})
		return
	}

	// Tenta fazer UPDATE; se não existir, faz INSERT
	_, err = db.Pool.Exec(ctx, `
		UPDATE metas_mensais
		SET meta_vendas = $1, meta_contratos = $2, descricao = $3, ativo = true, atualizado_em = NOW()
		WHERE mes = $4 AND ano = $5
	`, payload.MetaVendas, payload.MetaContratos, payload.Descricao, mesInt, anoInt)

	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Erro ao atualizar meta"})
		return
	}

	// Se nenhuma linha foi afetada, insere
	var rowsAffected int64
	_ = db.Pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM metas_mensais WHERE mes = $1 AND ano = $2
	`, mesInt, anoInt).Scan(&rowsAffected)

	if rowsAffected == 0 {
		_, err = db.Pool.Exec(ctx, `
			INSERT INTO metas_mensais (mes, ano, meta_vendas, meta_km, meta_contratos, descricao, ativo)
			VALUES ($1, $2, $3, $4, $5, $6, true)
		`, mesInt, anoInt, payload.MetaVendas, 0, payload.MetaContratos, payload.Descricao)

		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Erro ao criar meta"})
			return
		}
	}

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: map[string]interface{}{
		"mes":            mesInt,
		"ano":            anoInt,
		"meta_vendas":    payload.MetaVendas,
		"meta_contratos": payload.MetaContratos,
		"descricao":      payload.Descricao,
	}})
}

// ListarMetasMensais retorna todas as metas de um período
func ListarMetasMensais(c *gin.Context) {
	ctx := context.Background()
	now := time.Now()

	anoParam := c.Query("ano")
	if anoParam == "" {
		anoParam = strconv.Itoa(now.Year())
	}

	anoInt, err := strconv.Atoi(anoParam)
	if err != nil || anoInt < 2000 || anoInt > 2100 {
		anoInt = now.Year()
	}

	rows, _ := db.Pool.Query(ctx, `
		SELECT mes, ano, meta_vendas, meta_km, meta_contratos, descricao, ativo, atualizado_em
		FROM metas_mensais
		WHERE ano = $1
		ORDER BY mes ASC
	`, anoInt)

	var metas []map[string]interface{}
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var mes, ano, metaContratos int
			var metaVendas, metaKM float64
			var descricao string
			var ativo bool
			var atualizadoEm time.Time

			_ = rows.Scan(&mes, &ano, &metaVendas, &metaKM, &metaContratos, &descricao, &ativo, &atualizadoEm)
			metas = append(metas, map[string]interface{}{
				"mes":            mes,
				"ano":            ano,
				"meta_vendas":    metaVendas,
				"meta_km":        metaKM,
				"meta_contratos": metaContratos,
				"descricao":      descricao,
				"ativo":          ativo,
				"atualizado_em":  atualizadoEm,
			})
		}
	}
	if metas == nil {
		metas = []map[string]interface{}{}
	}

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: metas})
}

// GetTendencia6Meses retorna dados dos últimos 6 meses
func GetTendencia6Meses(c *gin.Context) {
	ctx := context.Background()

	rows, _ := db.Pool.Query(ctx, `
		WITH ultimos_6_meses AS (
			SELECT GENERATE_SERIES(
				CURRENT_DATE - INTERVAL '5 months',
				CURRENT_DATE,
				INTERVAL '1 month'
			)::date AS mes_inicio
		)
		SELECT
			EXTRACT(MONTH FROM mes_inicio)::int AS mes,
			EXTRACT(YEAR FROM mes_inicio)::int AS ano,
			TO_CHAR(mes_inicio, 'MMM')::text AS mes_nome,
			COALESCE(SUM(c.valor_total), 0)::float AS vendas,
			COUNT(DISTINCT c.id)::int AS contratos
		FROM ultimos_6_meses u6m
		LEFT JOIN contratos c ON
			EXTRACT(MONTH FROM c.data_evento) = EXTRACT(MONTH FROM u6m.mes_inicio)
			AND EXTRACT(YEAR FROM c.data_evento) = EXTRACT(YEAR FROM u6m.mes_inicio)
			AND lower(c.status) = 'confirmado'
		GROUP BY EXTRACT(MONTH FROM mes_inicio), EXTRACT(YEAR FROM mes_inicio), mes_nome
		ORDER BY ano DESC, mes DESC
	`)

	var tendencia []map[string]interface{}
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var mes, ano, contratos int
			var mesNome string
			var vendas float64
			_ = rows.Scan(&mes, &ano, &mesNome, &vendas, &contratos)
			tendencia = append(tendencia, map[string]interface{}{
				"mes":       mes,
				"ano":       ano,
				"mes_nome":  mesNome,
				"vendas":    vendas,
				"contratos": contratos,
			})
		}
	}
	if tendencia == nil {
		tendencia = []map[string]interface{}{}
	}

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: tendencia})
}

// GetRankingConsultores retorna top consultores por vendas e comissões
func GetRankingConsultores(c *gin.Context) {
	ctx := context.Background()
	now := time.Now()

	mesSelecionado := int(now.Month())
	anoSelecionado := now.Year()

	if mesParam := c.Query("mes"); mesParam != "" {
		if parsedMes, err := strconv.Atoi(mesParam); err == nil && parsedMes >= 1 && parsedMes <= 12 {
			mesSelecionado = parsedMes
		}
	}
	if anoParam := c.Query("ano"); anoParam != "" {
		if parsedAno, err := strconv.Atoi(anoParam); err == nil && parsedAno >= 2000 && parsedAno <= 2100 {
			anoSelecionado = parsedAno
		}
	}

	rows, _ := db.Pool.Query(ctx, `
		SELECT
			u.nome,
			COUNT(DISTINCT ce.id)::int AS total_eventos,
			COALESCE(SUM(ce.valor_total), 0)::float AS total_vendas,
			COALESCE(SUM(CASE WHEN lower(coms.comissao_status) = 'pago' THEN coms.valor_comissao ELSE 0 END), 0)::float AS comissao_paga,
			COALESCE(SUM(CASE WHEN lower(coms.comissao_status) != 'pago' THEN coms.valor_comissao ELSE 0 END), 0)::float AS comissao_pendente
		FROM usuarios u
		LEFT JOIN comissoes coms ON coms.consultor = u.nome
			AND EXTRACT(MONTH FROM coms.criado_em) = $1
			AND EXTRACT(YEAR FROM coms.criado_em) = $2
		LEFT JOIN contratos ce ON ce.id = coms.contrato_id
			AND EXTRACT(MONTH FROM ce.data_evento) = $1
			AND EXTRACT(YEAR FROM ce.data_evento) = $2
			AND lower(ce.status) = 'confirmado'
		WHERE lower(u.perfil) = 'consultor' AND u.ativo = true
		GROUP BY u.nome
		HAVING COUNT(DISTINCT ce.id) > 0 OR SUM(coms.valor_comissao) > 0
		ORDER BY total_vendas DESC, comissao_paga DESC
		LIMIT 10
	`, mesSelecionado, anoSelecionado)

	var ranking []map[string]interface{}
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var nome string
			var totalEventos, totalVendas, comissaoPaga, comissaoPendente float64
			_ = rows.Scan(&nome, &totalEventos, &totalVendas, &comissaoPaga, &comissaoPendente)
			ranking = append(ranking, map[string]interface{}{
				"consultor":         nome,
				"total_eventos":     int(totalEventos),
				"total_vendas":      totalVendas,
				"comissao_paga":     comissaoPaga,
				"comissao_pendente": comissaoPendente,
			})
		}
	}
	if ranking == nil {
		ranking = []map[string]interface{}{}
	}

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: ranking})
}

// GetRankingEventos retorna eventos ordenados por taxa de conversão
func GetRankingEventos(c *gin.Context) {
	ctx := context.Background()
	now := time.Now()

	mesSelecionado := int(now.Month())
	anoSelecionado := now.Year()

	if mesParam := c.Query("mes"); mesParam != "" {
		if parsedMes, err := strconv.Atoi(mesParam); err == nil && parsedMes >= 1 && parsedMes <= 12 {
			mesSelecionado = parsedMes
		}
	}
	if anoParam := c.Query("ano"); anoParam != "" {
		if parsedAno, err := strconv.Atoi(anoParam); err == nil && parsedAno >= 2000 && parsedAno <= 2100 {
			anoSelecionado = parsedAno
		}
	}

	rows, _ := db.Pool.Query(ctx, `
		SELECT
			c.id,
			c.nome_evento,
			c.empresa_nome,
			c.local_nome,
			c.data_evento,
			COUNT(p.id)::int AS total_inscritos,
			c.qtd_contratada,
			CASE
				WHEN c.qtd_contratada > 0
				THEN ROUND((COUNT(p.id)::float / c.qtd_contratada::float) * 100, 2)::float
				ELSE 0
			END AS taxa_ocupacao,
			CASE
				WHEN lower(c.status) = 'confirmado'
				THEN 100.0
				ELSE 0.0
			END AS taxa_conversao
		FROM contratos c
		LEFT JOIN participantes p ON p.contrato_id = c.id
		WHERE EXTRACT(MONTH FROM c.data_evento) = $1
		  AND EXTRACT(YEAR FROM c.data_evento) = $2
		  AND lower(c.status) NOT IN ('cancelado', 'expirado')
		GROUP BY c.id, c.nome_evento, c.empresa_nome, c.local_nome, c.data_evento, c.qtd_contratada, c.status
		ORDER BY taxa_conversao DESC, taxa_ocupacao DESC
		LIMIT 10
	`, mesSelecionado, anoSelecionado)

	var ranking []map[string]interface{}
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var id, nomeEvento, empresaNome, localNome, dataEvento string
			var totalInscritos, qtdContratada int
			var taxaOcupacao, taxaConversao float64
			_ = rows.Scan(&id, &nomeEvento, &empresaNome, &localNome, &dataEvento, &totalInscritos, &qtdContratada, &taxaOcupacao, &taxaConversao)
			ranking = append(ranking, map[string]interface{}{
				"id":              id,
				"nome_evento":     nomeEvento,
				"empresa_nome":    empresaNome,
				"local_nome":      localNome,
				"data_evento":     dataEvento,
				"total_inscritos": totalInscritos,
				"qtd_contratada":  qtdContratada,
				"taxa_ocupacao":   taxaOcupacao,
				"taxa_conversao":  taxaConversao,
			})
		}
	}
	if ranking == nil {
		ranking = []map[string]interface{}{}
	}

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: ranking})
}

// GetPerformanceOrcamentosVendas retorna Orçamentos criados vs Vendas fechadas por consultor
func GetPerformanceOrcamentosVendas(c *gin.Context) {
	ctx := context.Background()
	now := time.Now()

	mesSelecionado := int(now.Month())
	anoSelecionado := now.Year()

	if mesParam := c.Query("mes"); mesParam != "" {
		if parsedMes, err := strconv.Atoi(mesParam); err == nil && parsedMes >= 1 && parsedMes <= 12 {
			mesSelecionado = parsedMes
		}
	}
	if anoParam := c.Query("ano"); anoParam != "" {
		if parsedAno, err := strconv.Atoi(anoParam); err == nil && parsedAno >= 2000 && parsedAno <= 2100 {
			anoSelecionado = parsedAno
		}
	}

	rows, _ := db.Pool.Query(ctx, `
		SELECT
			u.nome,
			COALESCE(SUM(CASE WHEN lower(p.status) IN ('novo pedido', 'proposta', 'analise') THEN 1 ELSE 0 END), 0)::int AS orcamentos_criados,
			COALESCE(SUM(CASE WHEN lower(c.status) = 'confirmado' THEN 1 ELSE 0 END), 0)::int AS vendas_fechadas
		FROM usuarios u
		LEFT JOIN propostas p ON p.consultor = u.nome
			AND EXTRACT(MONTH FROM p.data_criacao) = $1
			AND EXTRACT(YEAR FROM p.data_criacao) = $2
		LEFT JOIN contratos c ON c.id = p.contrato_id
			AND EXTRACT(MONTH FROM c.data_evento) = $1
			AND EXTRACT(YEAR FROM c.data_evento) = $2
		WHERE u.ativo = true
		GROUP BY u.nome
		ORDER BY vendas_fechadas DESC, orcamentos_criados DESC
		LIMIT 10
	`, mesSelecionado, anoSelecionado)

	var performance []map[string]interface{}
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var nome string
			var orcamentos, vendas int
			_ = rows.Scan(&nome, &orcamentos, &vendas)

			taxaConversao := 0.0
			if orcamentos > 0 {
				taxaConversao = (float64(vendas) / float64(orcamentos)) * 100
			}

			performance = append(performance, map[string]interface{}{
				"consultor":          nome,
				"orcamentos_criados": orcamentos,
				"vendas_fechadas":    vendas,
				"taxa_conversao":     taxaConversao,
			})
		}
	}
	if performance == nil {
		performance = []map[string]interface{}{}
	}

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: performance})
}

// StorageAssinatura retorna uma assinatura Cloudinary para upload direto pelo frontend
func StorageAssinatura(c *gin.Context) {
	// Chama o serviço de assinatura do Cloudinary
	sig, err := GerarAssinaturaCloudinary()
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: sig})
}
