package api

import (
	"context"
	"net/http"
	"strings"

	"github.com/aomenos1km/app-web/db"
	"github.com/aomenos1km/app-web/models"
	"github.com/gin-gonic/gin"
)

type authzUser struct {
	ID     string
	Nome   string
	Perfil string
}

func getAuthzUser(c *gin.Context) authzUser {
	u := authzUser{}
	if raw, ok := c.Get("user_id"); ok {
		if v, ok := raw.(string); ok {
			u.ID = strings.TrimSpace(v)
		}
	}
	if raw, ok := c.Get("nome"); ok {
		if v, ok := raw.(string); ok {
			u.Nome = strings.TrimSpace(v)
		}
	}
	if raw, ok := c.Get("perfil"); ok {
		if v, ok := raw.(string); ok {
			u.Perfil = strings.TrimSpace(v)
		}
	}
	return u
}

func (u authzUser) IsAdmin() bool {
	return strings.EqualFold(u.Perfil, "Admin")
}

func (u authzUser) IsConsultor() bool {
	return strings.EqualFold(u.Perfil, "Consultor")
}

func rejectForbidden(c *gin.Context, msg string) {
	c.JSON(http.StatusForbidden, models.APIResponse{Success: false, Error: msg})
}

func crmCanAccessEmpresa(ctx context.Context, user authzUser, empresaID string) (bool, error) {
	if user.IsAdmin() {
		return true, nil
	}
	if strings.TrimSpace(user.ID) == "" || strings.TrimSpace(empresaID) == "" {
		return false, nil
	}

	var exists bool
	err := db.Pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM empresas_crm_pendencias p
			WHERE p.empresa_id = $1
			  AND p.responsavel_user_id = $2
			  AND p.status = 'Aberta'
		)
		OR EXISTS (
			SELECT 1
			FROM empresas_crm_interacoes i
			WHERE i.empresa_id = $1
			  AND i.usuario_id = $2
		)
	`, empresaID, user.ID).Scan(&exists)

	if err != nil {
		return false, err
	}
	return exists, nil
}

func crmCanManagePendencia(ctx context.Context, user authzUser, pendenciaID string) (bool, error) {
	if user.IsAdmin() {
		return true, nil
	}
	if strings.TrimSpace(user.ID) == "" || strings.TrimSpace(pendenciaID) == "" {
		return false, nil
	}

	var exists bool
	err := db.Pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM empresas_crm_pendencias p
			WHERE p.id = $1
			  AND p.responsavel_user_id = $2
		)
	`, pendenciaID, user.ID).Scan(&exists)
	if err != nil {
		return false, err
	}
	return exists, nil
}

func namesMatch(a, b string) bool {
	return strings.EqualFold(strings.TrimSpace(a), strings.TrimSpace(b))
}

func canAccessContrato(ctx context.Context, user authzUser, contratoID string) (bool, error) {
	if user.IsAdmin() {
		return true, nil
	}
	if strings.TrimSpace(contratoID) == "" || strings.TrimSpace(user.Nome) == "" {
		return false, nil
	}

	var consultor string
	err := db.Pool.QueryRow(ctx, `
		SELECT COALESCE(consultor, '')
		FROM contratos
		WHERE id = $1
	`, contratoID).Scan(&consultor)
	if err != nil {
		return false, err
	}

	return namesMatch(consultor, user.Nome), nil
}

func canAccessParticipante(ctx context.Context, user authzUser, participanteID string) (bool, error) {
	if user.IsAdmin() {
		return true, nil
	}
	if strings.TrimSpace(participanteID) == "" || strings.TrimSpace(user.Nome) == "" {
		return false, nil
	}

	var consultor string
	err := db.Pool.QueryRow(ctx, `
		SELECT COALESCE(c.consultor, '')
		FROM participantes p
		JOIN contratos c ON c.id = p.contrato_id
		WHERE p.id = $1
	`, participanteID).Scan(&consultor)
	if err != nil {
		return false, err
	}

	return namesMatch(consultor, user.Nome), nil
}

func canAccessProposta(ctx context.Context, user authzUser, propostaID string) (bool, error) {
	if user.IsAdmin() {
		return true, nil
	}
	if strings.TrimSpace(propostaID) == "" || strings.TrimSpace(user.Nome) == "" {
		return false, nil
	}

	var responsavel string
	err := db.Pool.QueryRow(ctx, `
		SELECT COALESCE(responsavel, '')
		FROM propostas
		WHERE id = $1
	`, propostaID).Scan(&responsavel)
	if err != nil {
		return false, err
	}

	return namesMatch(responsavel, user.Nome), nil
}

func canManageInsumo(ctx context.Context, user authzUser, insumoID string) (bool, error) {
	if user.IsAdmin() {
		return true, nil
	}
	if strings.TrimSpace(insumoID) == "" || strings.TrimSpace(user.ID) == "" {
		return false, nil
	}

	var ownerID string
	err := db.Pool.QueryRow(ctx, `
		SELECT COALESCE(criado_por_user_id::text, '')
		FROM insumos
		WHERE id = $1
	`, insumoID).Scan(&ownerID)
	if err != nil {
		return false, err
	}

	return strings.TrimSpace(ownerID) != "" && strings.TrimSpace(ownerID) == user.ID, nil
}

func canManageLocal(ctx context.Context, user authzUser, localID string) (bool, error) {
	if user.IsAdmin() {
		return true, nil
	}
	if strings.TrimSpace(localID) == "" || strings.TrimSpace(user.ID) == "" {
		return false, nil
	}

	var ownerID string
	err := db.Pool.QueryRow(ctx, `
		SELECT COALESCE(criado_por_user_id::text, '')
		FROM locais
		WHERE id = $1
	`, localID).Scan(&ownerID)
	if err != nil {
		return false, err
	}

	return strings.TrimSpace(ownerID) != "" && strings.TrimSpace(ownerID) == user.ID, nil
}
