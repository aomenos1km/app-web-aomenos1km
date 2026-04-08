package api

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/aomenos1km/app-web/db"
	"github.com/aomenos1km/app-web/models"
	"github.com/gin-gonic/gin"
)

var crmStatusValidos = map[string]bool{
	"Aberta":     true,
	"Concluida":  true,
	"Reagendada": true,
	"Cancelada":  true,
}

var crmPrioridadesValidas = map[string]bool{
	"Normal":  true,
	"Alta":    true,
	"Urgente": true,
}

func crmUserContext(c *gin.Context) (*string, string) {
	var userID *string
	if raw, ok := c.Get("user_id"); ok {
		if value, ok := raw.(string); ok && strings.TrimSpace(value) != "" {
			userID = &value
		}
	}

	userName := "Consultor"
	if raw, ok := c.Get("nome"); ok {
		if value, ok := raw.(string); ok && strings.TrimSpace(value) != "" {
			userName = strings.TrimSpace(value)
		}
	}

	return userID, userName
}

func closeOpenCRMPendencias(ctx context.Context, empresaID string, status string, userID *string, userName string) error {
	_, err := db.Pool.Exec(ctx, `
		UPDATE empresas_crm_pendencias
		SET status = $2,
		    concluida_em = NOW(),
		    concluida_por_user_id = $3,
		    concluida_por_nome = $4,
		    atualizado_em = NOW()
		WHERE empresa_id = $1
		  AND status = 'Aberta'`,
		empresaID, status, userID, userName,
	)
	return err
}

func createCRMPendencia(ctx context.Context, empresaID string, interacaoID string, responsavelUserID *string, responsavelNome string, descricao string, dataPrevista string, prioridade string) error {
	prioridade = normalizeCRMPrioridade(prioridade)
	_, err := db.Pool.Exec(ctx, `
		INSERT INTO empresas_crm_pendencias (
			empresa_id,
			interacao_origem_id,
			responsavel_user_id,
			responsavel_nome,
			descricao,
			status,
			prioridade,
			data_prevista
		)
		VALUES ($1, $2, $3, $4, $5, 'Aberta', $6, $7)`,
		empresaID, interacaoID, responsavelUserID, responsavelNome, descricao, prioridade, dataPrevista,
	)
	return err
}

func normalizeCRMStatus(status string) string {
	status = strings.TrimSpace(status)
	if crmStatusValidos[status] {
		return status
	}
	return "Aberta"
}

func normalizeCRMPrioridade(prioridade string) string {
	prioridade = strings.TrimSpace(prioridade)
	if crmPrioridadesValidas[prioridade] {
		return prioridade
	}
	return "Normal"
}

func crmLookupUserName(ctx context.Context, userID string) string {
	if strings.TrimSpace(userID) == "" {
		return ""
	}
	var nome string
	if err := db.Pool.QueryRow(ctx, `SELECT COALESCE(nome, '') FROM usuarios WHERE id = $1`, userID).Scan(&nome); err != nil {
		return ""
	}
	return strings.TrimSpace(nome)
}

// ListarCRMPainel retorna a fila operacional do CRM e seus indicadores
func ListarCRMPainel(c *gin.Context) {
	ctx := context.Background()
	authUser := getAuthzUser(c)
	q := strings.TrimSpace(c.Query("q"))
	bucket := strings.TrimSpace(c.Query("bucket"))
	statusFiltro := strings.TrimSpace(c.Query("status"))
	prioridadeFiltro := strings.TrimSpace(c.Query("prioridade"))
	consultorID := strings.TrimSpace(c.Query("consultor_id"))
	onlyMine := strings.EqualFold(c.Query("only_mine"), "true")
	userID, _ := crmUserContext(c)

	if !authUser.IsAdmin() {
		if authUser.ID == "" {
			rejectForbidden(c, "Usuário sem identificação para aplicar permissões de CRM")
			return
		}
		onlyMine = true
		consultorID = authUser.ID
	}

	summaryWhere := []string{"status = 'Aberta'"}
	summaryArgs := []interface{}{}
	summaryArgPos := 1

	where := []string{"p.status = 'Aberta'"}
	args := []interface{}{}
	argPos := 1

	if q != "" {
		where = append(where, "(LOWER(e.razao_social) LIKE LOWER($"+itoa(argPos)+") OR LOWER(COALESCE(e.nome_fantasia, '')) LIKE LOWER($"+itoa(argPos)+") OR LOWER(COALESCE(e.responsavel, '')) LIKE LOWER($"+itoa(argPos)+") OR LOWER(COALESCE(e.email, '')) LIKE LOWER($"+itoa(argPos)+"))")
		args = append(args, "%"+q+"%")
		argPos++
	}

	if consultorID != "" {
		where = append(where, "p.responsavel_user_id = $"+itoa(argPos))
		args = append(args, consultorID)
		argPos++

		summaryWhere = append(summaryWhere, "responsavel_user_id = $"+itoa(summaryArgPos))
		summaryArgs = append(summaryArgs, consultorID)
		summaryArgPos++
	} else if onlyMine && userID != nil {
		where = append(where, "p.responsavel_user_id = $"+itoa(argPos))
		args = append(args, *userID)
		argPos++

		summaryWhere = append(summaryWhere, "responsavel_user_id = $"+itoa(summaryArgPos))
		summaryArgs = append(summaryArgs, *userID)
		summaryArgPos++
	}

	if statusFiltro != "" && !strings.EqualFold(statusFiltro, "todas") {
		statusFiltro = normalizeCRMStatus(statusFiltro)
		where = append(where, "p.status = $"+itoa(argPos))
		args = append(args, statusFiltro)
		argPos++
	}

	if prioridadeFiltro != "" && !strings.EqualFold(prioridadeFiltro, "todas") {
		prioridadeFiltro = normalizeCRMPrioridade(prioridadeFiltro)
		where = append(where, "p.prioridade = $"+itoa(argPos))
		args = append(args, prioridadeFiltro)
		argPos++
	}

	if bucket != "" {
		switch bucket {
		case "atrasadas":
			where = append(where, "p.data_prevista < CURRENT_DATE")
		case "hoje":
			where = append(where, "p.data_prevista = CURRENT_DATE")
		case "semana":
			where = append(where, "p.data_prevista BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 day'")
		}
	}

	whereSQL := strings.Join(where, " AND ")

	var resumo models.EmpresaCRMPainelResumo
	err := db.Pool.QueryRow(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE status = 'Aberta') AS pendencias_abertas,
			COUNT(*) FILTER (WHERE status = 'Aberta' AND data_prevista = CURRENT_DATE) AS pendencias_hoje,
			COUNT(*) FILTER (WHERE status = 'Aberta' AND data_prevista < CURRENT_DATE) AS pendencias_atraso,
			COUNT(*) FILTER (WHERE status = 'Aberta' AND data_prevista BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 day') AS pendencias_semana
		FROM empresas_crm_pendencias
		WHERE `+strings.Join(summaryWhere, " AND "), summaryArgs...).Scan(&resumo.PendenciasAbertas, &resumo.PendenciasHoje, &resumo.PendenciasAtraso, &resumo.PendenciasSemana)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	metricasArgs := []interface{}{}
	metricasWhere := []string{"i.criado_em >= NOW() - INTERVAL '30 day'"}
	metricasArgPos := 1
	if consultorID != "" {
		metricasWhere = append(metricasWhere, "i.usuario_id = $"+itoa(metricasArgPos))
		metricasArgs = append(metricasArgs, consultorID)
		metricasArgPos++
	} else if onlyMine && userID != nil {
		metricasWhere = append(metricasWhere, "i.usuario_id = $"+itoa(metricasArgPos))
		metricasArgs = append(metricasArgs, *userID)
		metricasArgPos++
	}

	var metricas models.EmpresaCRMMetricas
	err = db.Pool.QueryRow(ctx, `
		SELECT
			COUNT(*) AS interacoes_30d,
			COUNT(*) FILTER (WHERE i.resultado = 'Contato Realizado') AS contatos_realizados_30d,
			COUNT(*) FILTER (WHERE i.resultado = 'Sem Retorno') AS sem_retorno_30d,
			COUNT(*) FILTER (WHERE i.resultado = 'Convertido') AS convertidos_30d,
			COALESCE(
				ROUND(
					(COUNT(*) FILTER (WHERE i.resultado = 'Convertido')::numeric / NULLIF(COUNT(*) FILTER (WHERE i.resultado = 'Contato Realizado')::numeric, 0)) * 100,
				2
				),
			0
			) AS taxa_conversao_30d
		FROM empresas_crm_interacoes i
		WHERE `+strings.Join(metricasWhere, " AND "), metricasArgs...).Scan(
		&metricas.Interacoes30d,
		&metricas.ContatosRealizados30d,
		&metricas.SemRetorno30d,
		&metricas.Convertidos30d,
		&metricas.TaxaConversao30d,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	query := `
		SELECT
			p.id,
			e.id,
			COALESCE(e.razao_social, ''),
			COALESCE(e.nome_fantasia, ''),
			COALESCE(e.responsavel, ''),
			COALESCE(e.telefone, ''),
			COALESCE(e.email, ''),
			COALESCE(e.cidade, ''),
			COALESCE(e.uf, ''),
			TO_CHAR(p.data_prevista, 'YYYY-MM-DD'),
			COALESCE(p.responsavel_nome, ''),
			COALESCE(p.descricao, ''),
			COALESCE(p.prioridade, 'Normal'),
			COALESCE(p.status, 'Aberta'),
			GREATEST(CURRENT_DATE - p.data_prevista, 0)::INT,
			COALESCE(ult.texto, ''),
			COALESCE(ult.usuario_nome, ''),
			COALESCE(TO_CHAR(ult.criado_em, 'YYYY-MM-DD HH24:MI'), ''),
			COALESCE(ult.resultado, ''),
			COALESCE(ult.canal, ''),
			COALESCE(ult.tipo_interacao, '')
		FROM empresas_crm_pendencias p
		JOIN empresas e ON e.id = p.empresa_id
		LEFT JOIN LATERAL (
			SELECT texto, usuario_nome, criado_em, resultado, canal, tipo_interacao
			FROM empresas_crm_interacoes i
			WHERE i.empresa_id = e.id
			ORDER BY i.criado_em DESC
			LIMIT 1
		) ult ON TRUE
		WHERE ` + whereSQL + `
		ORDER BY p.data_prevista ASC, e.razao_social ASC`

	rows, err := db.Pool.Query(ctx, query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	defer rows.Close()

	itens := make([]models.EmpresaCRMPainelItem, 0)
	for rows.Next() {
		var item models.EmpresaCRMPainelItem
		var ultimoCriadoEm string
		if err := rows.Scan(
			&item.PendenciaID,
			&item.EmpresaID,
			&item.EmpresaNome,
			&item.EmpresaFantasia,
			&item.ResponsavelContato,
			&item.Telefone,
			&item.Email,
			&item.Cidade,
			&item.UF,
			&item.DataPrevista,
			&item.ResponsavelCRM,
			&item.DescricaoPendencia,
			&item.Prioridade,
			&item.Status,
			&item.AtrasoDias,
			&item.UltimoTexto,
			&item.UltimoUsuario,
			&ultimoCriadoEm,
			&item.UltimoResultado,
			&item.UltimoCanal,
			&item.UltimoTipoInteracao,
		); err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
			return
		}
		if ultimoCriadoEm != "" {
			item.UltimoCriadoEm = &ultimoCriadoEm
		}
		switch {
		case item.Status == "Concluida":
			item.Situacao = "Concluída"
		case item.Status == "Reagendada":
			item.Situacao = "Reagendada"
		case item.Status == "Cancelada":
			item.Situacao = "Cancelada"
		case item.AtrasoDias > 0:
			item.Situacao = "Atrasada"
		case item.DataPrevista == time.Now().Format("2006-01-02"):
			item.Situacao = "Hoje"
		default:
			item.Situacao = "Agendada"
		}
		itens = append(itens, item)
	}

	if err := rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: models.EmpresaCRMPainelResponse{Resumo: resumo, Metricas: metricas, Pendencias: itens}})
}

// AtualizarCRMPendencia atualiza rapidamente uma pendencia do CRM
func AtualizarCRMPendencia(c *gin.Context) {
	pendenciaID := c.Param("id")
	authUser := getAuthzUser(c)
	var input models.EmpresaCRMPendenciaUpdateInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	ctx := context.Background()
	if !authUser.IsAdmin() {
		if authUser.ID == "" {
			rejectForbidden(c, "Usuário sem identificação para aplicar permissões de CRM")
			return
		}
		canManage, err := crmCanManagePendencia(ctx, authUser, pendenciaID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
			return
		}
		if !canManage {
			rejectForbidden(c, "Você só pode atualizar pendências sob sua responsabilidade")
			return
		}
	}

	_, userName := crmUserContext(c)

	prioridade := normalizeCRMPrioridade(input.Prioridade)
	status := strings.TrimSpace(input.Status)
	if status == "" {
		status = "Aberta"
	}
	if !crmStatusValidos[status] {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "status inválido"})
		return
	}

	responsavelUserID := strings.TrimSpace(input.ResponsavelUserID)
	responsavelNome := strings.TrimSpace(input.ResponsavelNome)
	var responsavelUserIDForSQL interface{} = nil
	if !authUser.IsAdmin() {
		if responsavelUserID != "" && responsavelUserID != authUser.ID {
			rejectForbidden(c, "Consultores não podem reatribuir pendências para outro responsável")
			return
		}
		responsavelUserID = ""
		responsavelNome = ""
	}
	if responsavelUserID != "" {
		responsavelUserIDForSQL = responsavelUserID
		if responsavelNome == "" {
			responsavelNome = crmLookupUserName(ctx, responsavelUserID)
		}
	}
	if responsavelNome == "" {
		responsavelNome = userName
	}

	var dataPrevista interface{} = nil
	if strings.TrimSpace(input.DataPrevista) != "" {
		if _, err := time.Parse("2006-01-02", input.DataPrevista); err != nil {
			c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "data_prevista deve estar no formato YYYY-MM-DD"})
			return
		}
		dataPrevista = input.DataPrevista
	}

	var pendencia models.EmpresaCRMPendencia
	var responsavelUserIDResult *string
	err := db.Pool.QueryRow(ctx, `
		UPDATE empresas_crm_pendencias
		SET status = $2,
		    prioridade = COALESCE(NULLIF($3, ''), prioridade),
		    data_prevista = COALESCE($4::date, data_prevista),
		    responsavel_user_id = CASE WHEN $5::text IS NOT NULL THEN $5::uuid ELSE responsavel_user_id END,
		    responsavel_nome = COALESCE(NULLIF($6, ''), responsavel_nome),
		    atualizado_em = NOW()
		WHERE id = $1
		RETURNING id, empresa_id, interacao_origem_id, responsavel_user_id, responsavel_nome, descricao, status, prioridade, TO_CHAR(data_prevista, 'YYYY-MM-DD'), criado_em, atualizado_em`,
		pendenciaID, status, prioridade, dataPrevista, responsavelUserIDForSQL, responsavelNome,
	).Scan(
		&pendencia.ID,
		&pendencia.EmpresaID,
		&pendencia.InteracaoOrigemID,
		&responsavelUserIDResult,
		&pendencia.ResponsavelNome,
		&pendencia.Descricao,
		&pendencia.Status,
		&pendencia.Prioridade,
		&pendencia.DataPrevista,
		&pendencia.CriadoEm,
		&pendencia.AtualizadoEm,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	pendencia.ResponsavelUserID = responsavelUserIDResult
	pendencia.StatusLabel = pendencia.Status

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: pendencia})
}
