package api

import (
	"context"
	"net/http"
	"net/mail"
	"strings"
	"time"

	"github.com/aomenos1km/app-web/db"
	"github.com/aomenos1km/app-web/models"
	"github.com/gin-gonic/gin"
)

type InscricaoTransmissaoInput struct {
	Email  string `json:"email" binding:"required"`
	Origem string `json:"origem"`
}

type InscricaoTransmissao struct {
	ID         string    `json:"id"`
	Email      string    `json:"email"`
	Origem     string    `json:"origem"`
	Ativo      bool      `json:"ativo"`
	InscritoEm time.Time `json:"inscrito_em"`
}

func ensureListaTransmissao(ctx context.Context) error {
	_, err := db.Pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS lista_transmissao (
			id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
			email         VARCHAR(255) NOT NULL UNIQUE,
			origem        VARCHAR(80) NOT NULL DEFAULT 'landing',
			ip            VARCHAR(64),
			user_agent    TEXT,
			ativo         BOOLEAN NOT NULL DEFAULT true,
			inscrito_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)
	if err != nil {
		return err
	}

	_, err = db.Pool.Exec(ctx, `
		CREATE INDEX IF NOT EXISTS idx_lista_transmissao_inscrito_em
		ON lista_transmissao(inscrito_em DESC)
	`)
	return err
}

func normalizarEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func validarEmail(email string) bool {
	if len(email) < 5 || len(email) > 255 {
		return false
	}
	_, err := mail.ParseAddress(email)
	return err == nil
}

// InscreverListaTransmissao recebe inscrições públicas da landing page.
func InscreverListaTransmissao(c *gin.Context) {
	var req InscricaoTransmissaoInput
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Dados inválidos"})
		return
	}

	email := normalizarEmail(req.Email)
	if !validarEmail(email) {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Informe um e-mail válido"})
		return
	}

	if err := ensureListaTransmissao(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Erro ao preparar lista de transmissão"})
		return
	}

	origem := strings.TrimSpace(req.Origem)
	if origem == "" {
		origem = "landing"
	}
	if len(origem) > 80 {
		origem = origem[:80]
	}

	userAgent := strings.TrimSpace(c.GetHeader("User-Agent"))
	if len(userAgent) > 1000 {
		userAgent = userAgent[:1000]
	}

	ip := strings.TrimSpace(c.ClientIP())
	if len(ip) > 64 {
		ip = ip[:64]
	}

	_, err := db.Pool.Exec(c.Request.Context(), `
		INSERT INTO lista_transmissao (email, origem, ip, user_agent, ativo, atualizado_em)
		VALUES ($1, $2, $3, $4, true, NOW())
		ON CONFLICT (email)
		DO UPDATE SET
			origem = EXCLUDED.origem,
			ip = EXCLUDED.ip,
			user_agent = EXCLUDED.user_agent,
			ativo = true,
			atualizado_em = NOW()
	`, email, origem, ip, userAgent)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Não foi possível registrar sua inscrição"})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Message: "Inscrição realizada com sucesso"})
}

// ListarInscricoesTransmissao retorna as inscrições para o painel interno.
func ListarInscricoesTransmissao(c *gin.Context) {
	perfil, _ := c.Get("perfil")
	if perfil != "Admin" {
		c.JSON(http.StatusForbidden, models.APIResponse{Success: false, Error: "Acesso restrito a administradores"})
		return
	}

	if err := ensureListaTransmissao(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Erro ao preparar lista de transmissão"})
		return
	}

	rows, err := db.Pool.Query(c.Request.Context(), `
		SELECT id, email, origem, ativo, inscrito_em
		FROM lista_transmissao
		ORDER BY inscrito_em DESC
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Erro ao listar inscrições"})
		return
	}
	defer rows.Close()

	lista := make([]InscricaoTransmissao, 0)
	for rows.Next() {
		var item InscricaoTransmissao
		if err := rows.Scan(&item.ID, &item.Email, &item.Origem, &item.Ativo, &item.InscritoEm); err != nil {
			continue
		}
		lista = append(lista, item)
	}

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: lista})
}
