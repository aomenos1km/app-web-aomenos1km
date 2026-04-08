package api

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/aomenos1km/app-web/db"
	"github.com/aomenos1km/app-web/models"
	"github.com/gin-gonic/gin"
)

func getContextString(c *gin.Context, key string) string {
	v, ok := c.Get(key)
	if !ok {
		return ""
	}
	s, ok := v.(string)
	if !ok {
		return ""
	}
	return strings.TrimSpace(s)
}

func garantirCamposComissaoContratos() error {
	_, err := db.Pool.Exec(context.Background(), `
		ALTER TABLE contratos
		ADD COLUMN IF NOT EXISTS comissao_status VARCHAR(20) NOT NULL DEFAULT 'Pendente',
		ADD COLUMN IF NOT EXISTS comissao_data_pagamento TIMESTAMP NULL,
		ADD COLUMN IF NOT EXISTS comissao_pago_por VARCHAR(255) NULL,
		ADD COLUMN IF NOT EXISTS comissao_observacao TEXT NULL
	`)
	if err != nil {
		return err
	}
	_, err = db.Pool.Exec(context.Background(), `
		UPDATE contratos
		   SET comissao_status = 'Pendente'
		 WHERE comissao_status IS NULL OR TRIM(comissao_status) = ''
	`)
	return err
}

func statusElegivelComissao(status string) bool {
	s := strings.TrimSpace(strings.ToLower(status))
	return s == strings.ToLower(contratoStatusAguardandoPgto) ||
		s == strings.ToLower(contratoStatusConfirmado) ||
		s == strings.ToLower(contratoStatusFinalizado)
}

// ListarExtratoComissoes retorna comissões por contrato, com filtros por mês/ano/consultor.
func ListarExtratoComissoes(c *gin.Context) {
	if err := garantirCamposComissaoContratos(); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	perfil := getContextString(c, "perfil")
	usuarioNome := getContextString(c, "nome")
	isAdmin := perfil == "Admin"

	ano := strings.TrimSpace(c.Query("ano"))
	mes := strings.TrimSpace(c.Query("mes"))
	consultor := strings.TrimSpace(c.Query("consultor"))

	anoInt := 0
	mesInt := 0
	if ano != "" {
		parsedAno, err := strconv.Atoi(ano)
		if err != nil || len(ano) != 4 {
			c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Ano inválido"})
			return
		}
		anoInt = parsedAno
	}
	if mes != "" {
		parsedMes, err := strconv.Atoi(mes)
		if err != nil || parsedMes < 1 || parsedMes > 12 {
			c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Mês inválido"})
			return
		}
		mesInt = parsedMes
	}

	query := `
		SELECT
			c.id,
			COALESCE(c.empresa_nome, ''),
			COALESCE(c.nome_evento, ''),
			c.data_evento::text,
			COALESCE(c.consultor, ''),
			COALESCE(c.status, ''),
			COALESCE(c.valor_total, 0),
			COALESCE(u.comissao_percent, 0),
			COALESCE(NULLIF(TRIM(c.comissao_status), ''), 'Pendente'),
			c.comissao_data_pagamento::text,
			c.comissao_pago_por,
			c.comissao_observacao
		FROM contratos c
		LEFT JOIN usuarios u ON LOWER(TRIM(u.nome)) = LOWER(TRIM(c.consultor))
		WHERE 1=1
	`

	args := make([]interface{}, 0)
	argIdx := 1

	if ano != "" {
		query += " AND EXTRACT(YEAR FROM c.data_evento) = $" + strconv.Itoa(argIdx)
		args = append(args, anoInt)
		argIdx++
	}
	if mes != "" {
		query += " AND EXTRACT(MONTH FROM c.data_evento) = $" + strconv.Itoa(argIdx)
		args = append(args, mesInt)
		argIdx++
	}

	if isAdmin {
		if consultor != "" {
			query += " AND c.consultor ILIKE $" + strconv.Itoa(argIdx)
			args = append(args, "%"+consultor+"%")
			argIdx++
		}
	} else {
		query += " AND LOWER(TRIM(c.consultor)) = LOWER(TRIM($" + strconv.Itoa(argIdx) + "))"
		args = append(args, usuarioNome)
		argIdx++
	}

	query += " ORDER BY c.data_evento DESC NULLS LAST, c.criado_em DESC"

	rows, err := db.Pool.Query(context.Background(), query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	defer rows.Close()

	itens := make([]models.ComissaoExtratoItem, 0)
	resumo := models.ComissaoResumo{}
	for rows.Next() {
		var item models.ComissaoExtratoItem
		var statusContrato string
		if err := rows.Scan(
			&item.ContratoID,
			&item.EmpresaNome,
			&item.NomeEvento,
			&item.DataEvento,
			&item.Consultor,
			&statusContrato,
			&item.ValorVenda,
			&item.ComissaoPercent,
			&item.ComissaoStatus,
			&item.ComissaoDataPagamento,
			&item.ComissaoPagoPor,
			&item.ComissaoObservacao,
		); err != nil {
			continue
		}

		item.StatusContrato = normalizeContratoStatus(statusContrato)
		if !statusElegivelComissao(item.StatusContrato) {
			continue
		}
		item.ValorComissao = item.ValorVenda * (item.ComissaoPercent / 100)

		resumo.TotalRegistros++
		if strings.EqualFold(item.ComissaoStatus, "Pago") {
			resumo.TotalPago += item.ValorComissao
			resumo.QuantidadePagos++
		} else {
			resumo.TotalPendente += item.ValorComissao
			resumo.QuantidadePendentes++
		}
		if strings.EqualFold(strings.TrimSpace(item.Consultor), strings.TrimSpace(usuarioNome)) {
			resumo.TotalMinhaComissao += item.ValorComissao
		}
		itens = append(itens, item)
	}

	resp := models.ComissaoExtratoResponse{Itens: itens, Resumo: resumo}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: resp})
}

// MarcarComissaoPaga registra baixa manual da comissão (somente Administrador).
func MarcarComissaoPaga(c *gin.Context) {
	if err := garantirCamposComissaoContratos(); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	if getContextString(c, "perfil") != "Admin" {
		c.JSON(http.StatusForbidden, models.APIResponse{Success: false, Error: "Apenas administradores podem dar baixa em comissões"})
		return
	}

	id := c.Param("id")
	if strings.TrimSpace(id) == "" {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "ID inválido"})
		return
	}

	var payload models.ComissaoPagamentoInput
	_ = c.ShouldBindJSON(&payload)
	obs := strings.TrimSpace(payload.Observacao)
	if len(obs) > 400 {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Observação deve ter no máximo 400 caracteres"})
		return
	}

	pagoPor := getContextString(c, "nome")
	agora := time.Now()

	cmd := `
		UPDATE contratos
		   SET comissao_status = 'Pago',
		       comissao_data_pagamento = $2,
		       comissao_pago_por = $3,
		       comissao_observacao = $4,
		       atualizado_em = NOW()
		 WHERE id = $1
	`
	res, err := db.Pool.Exec(context.Background(), cmd, id, agora, pagoPor, obs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	if res.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: "Contrato não encontrado"})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: gin.H{"id": id, "status": "Pago"}})
}
