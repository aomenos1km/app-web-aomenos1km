package api

import (
	"fmt"
	"math"
	"net/http"
	"strings"

	"github.com/aomenos1km/app-web/db"
	"github.com/aomenos1km/app-web/models"
	"github.com/gin-gonic/gin"
)

// ─── Perfis de Orçamento ──────────────────────────────────────────────────────

// ListarPerfis retorna todos os perfis de orçamento ativos
func ListarPerfis(c *gin.Context) {
	rows, err := db.Pool.Query(c,
		`SELECT id, nome, descricao, ativo, criado_em
		 FROM perfis_orcamento
		 ORDER BY nome ASC`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao listar perfis"})
		return
	}
	defer rows.Close()

	perfis := []models.PerfilOrcamento{}
	for rows.Next() {
		var p models.PerfilOrcamento
		if err := rows.Scan(&p.ID, &p.Nome, &p.Descricao, &p.Ativo, &p.CriadoEm); err != nil {
			continue
		}
		perfis = append(perfis, p)
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": perfis})
}

// CriarPerfil cria um novo perfil de orçamento
func CriarPerfil(c *gin.Context) {
	var input models.PerfilOrcamentoInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var id string
	err := db.Pool.QueryRow(c,
		`INSERT INTO perfis_orcamento (nome, descricao, ativo)
		 VALUES ($1, $2, $3)
		 RETURNING id`,
		strings.TrimSpace(input.Nome), input.Descricao, input.Ativo,
	).Scan(&id)
	if err != nil {
		if strings.Contains(err.Error(), "unique") {
			c.JSON(http.StatusConflict, gin.H{"error": "Já existe um perfil com este nome"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao criar perfil"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "data": gin.H{"id": id}})
}

// DeletarPerfil remove um perfil pelo ID (cascade deleta suas regras)
func DeletarPerfil(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID obrigatório"})
		return
	}
	ct, err := db.Pool.Exec(c, `DELETE FROM perfis_orcamento WHERE id = $1`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao deletar perfil"})
		return
	}
	if ct.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Perfil não encontrado"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// ─── Regras de Orçamento ──────────────────────────────────────────────────────

// ListarRegras retorna todas as regras de um perfil específico
func ListarRegras(c *gin.Context) {
	perfilID := c.Param("id")
	rows, err := db.Pool.Query(c,
		`SELECT r.id, r.perfil_id, r.insumo_id, r.nome_item, r.tipo_regra, r.divisor, r.categoria, r.criado_em
		 FROM regras_orcamento r
		 WHERE r.perfil_id = $1
		 ORDER BY r.criado_em ASC`,
		perfilID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao listar regras"})
		return
	}
	defer rows.Close()

	regras := []models.RegraOrcamento{}
	for rows.Next() {
		var r models.RegraOrcamento
		if err := rows.Scan(&r.ID, &r.PerfilID, &r.InsumoID, &r.NomeItem, &r.TipoRegra, &r.Divisor, &r.Categoria, &r.CriadoEm); err != nil {
			continue
		}
		regras = append(regras, r)
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": regras})
}

// SalvarRegra cria uma nova regra para um perfil
func SalvarRegra(c *gin.Context) {
	var input models.RegraOrcamentoInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if input.TipoRegra != "Fixo" && input.TipoRegra != "Por Pessoa" && input.TipoRegra != "Ratio" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tipo_regra deve ser Fixo, Por Pessoa ou Ratio"})
		return
	}

	var id string
	err := db.Pool.QueryRow(c,
		`INSERT INTO regras_orcamento (perfil_id, insumo_id, nome_item, tipo_regra, divisor, categoria)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id`,
		input.PerfilID, input.InsumoID, strings.TrimSpace(input.NomeItem),
		input.TipoRegra, input.Divisor, input.Categoria,
	).Scan(&id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao salvar regra"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "data": gin.H{"id": id}})
}

// DeletarRegra remove uma regra pelo ID
func DeletarRegra(c *gin.Context) {
	id := c.Param("id")
	ct, err := db.Pool.Exec(c, `DELETE FROM regras_orcamento WHERE id = $1`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao deletar regra"})
		return
	}
	if ct.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Regra não encontrada"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// ─── Cálculo de Estrutura ─────────────────────────────────────────────────────

// CalcularEstrutura retorna os itens calculados para um perfil + qtd de pessoas
// GET /api/calcular-estrutura?perfil_id=xxx&qtd=150
func CalcularEstrutura(c *gin.Context) {
	perfilID := c.Query("perfil_id")
	qtdStr := c.Query("qtd")
	if perfilID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "perfil_id é obrigatório"})
		return
	}

	qtd, _ := parseFloat(qtdStr)

	rows, err := db.Pool.Query(c,
		`SELECT r.insumo_id, r.nome_item, r.tipo_regra, r.divisor, r.categoria,
		        COALESCE(i.preco_unitario, 0) AS preco_unitario
		 FROM regras_orcamento r
		 LEFT JOIN insumos i ON i.id = r.insumo_id
		 WHERE r.perfil_id = $1
		 ORDER BY r.criado_em ASC`,
		perfilID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao calcular estrutura"})
		return
	}
	defer rows.Close()

	itens := []models.ItemCalculado{}
	for rows.Next() {
		var insumoID *string
		var nome, tipoRegra, categoria string
		var divisor, precoUnit float64
		if err := rows.Scan(&insumoID, &nome, &tipoRegra, &divisor, &categoria, &precoUnit); err != nil {
			continue
		}

		var quantidade float64
		switch tipoRegra {
		case "Fixo":
			quantidade = divisor
		case "Por Pessoa":
			if divisor > 0 {
				quantidade = math.Ceil(qtd / divisor)
			}
		case "Ratio":
			quantidade = qtd * divisor
		}
		if quantidade < 1 {
			quantidade = 1
		}

		itens = append(itens, models.ItemCalculado{
			InsumoID:   insumoID,
			Nome:       nome,
			Categoria:  categoria,
			Quantidade: quantidade,
			ValorUnit:  precoUnit,
		})
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": itens})
}

// parseFloat converte string em float64 de forma simples
func parseFloat(s string) (float64, error) {
	if s == "" {
		return 0, nil
	}
	var v float64
	_, err := fmt.Sscanf(s, "%f", &v)
	return v, err
}
