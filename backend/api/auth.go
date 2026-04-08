package api

import (
	"context"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/aomenos1km/app-web/db"
	"github.com/aomenos1km/app-web/models"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

var perfisValidos = map[string]bool{
	"Admin":        true,
	"Consultor":    true,
	"Visualizador": true,
}

func garantirCamposUsuarios() error {
	_, err := db.Pool.Exec(context.Background(), `
		ALTER TABLE usuarios
		ADD COLUMN IF NOT EXISTS email VARCHAR(255),
		ADD COLUMN IF NOT EXISTS comissao_percent DECIMAL(5,2) NOT NULL DEFAULT 0
	`)
	return err
}

// Login autentica o usuário e retorna um JWT
func Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "Dados inválidos: " + err.Error(),
		})
		return
	}

	// Busca o usuário no banco
	var user models.Usuario
	err := db.Pool.QueryRow(context.Background(),
		`SELECT id, nome, login, senha_hash, perfil, ativo 
		 FROM usuarios WHERE login = $1`,
		req.Login,
	).Scan(&user.ID, &user.Nome, &user.Login, &user.SenhaHash, &user.Perfil, &user.Ativo)

	if err != nil {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Error:   "Usuário ou senha incorretos",
		})
		return
	}

	if !user.Ativo {
		c.JSON(http.StatusForbidden, models.APIResponse{
			Success: false,
			Error:   "Usuário inativo. Contate o administrador.",
		})
		return
	}

	// Verifica a senha
	if err := bcrypt.CompareHashAndPassword([]byte(user.SenhaHash), []byte(req.Senha)); err != nil {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Error:   "Usuário ou senha incorretos",
		})
		return
	}

	// Gera o JWT
	expiresAt := time.Now().Add(24 * time.Hour)
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": user.ID,
		"login":   user.Login,
		"perfil":  user.Perfil,
		"nome":    user.Nome,
		"exp":     expiresAt.Unix(),
	})

	tokenStr, err := token.SignedString([]byte(os.Getenv("JWT_SECRET")))
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error:   "Erro ao gerar token",
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data: models.LoginResponse{
			Token:  tokenStr,
			Perfil: user.Perfil,
			Nome:   user.Nome,
			ID:     user.ID,
		},
	})
}

// Me retorna os dados do usuário logado
func Me(c *gin.Context) {
	userID, _ := c.Get("user_id")
	var user models.Usuario
	err := db.Pool.QueryRow(context.Background(),
		`SELECT id, nome, login, perfil, ativo, criado_em FROM usuarios WHERE id = $1`,
		userID,
	).Scan(&user.ID, &user.Nome, &user.Login, &user.Perfil, &user.Ativo, &user.CriadoEm)

	if err != nil {
		c.JSON(http.StatusNotFound, models.APIResponse{
			Success: false,
			Error:   "Usuário não encontrado",
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: user})
}

// ListarUsuarios lista todos os usuários (Admin vê tudo; Consultor vê apenas Consultores sem dados sensíveis)
func ListarUsuarios(c *gin.Context) {
	if err := garantirCamposUsuarios(); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	userPerfil, _ := c.Get("perfil")
	userPerfilStr := userPerfil.(string)

	query := `SELECT id, nome, login, COALESCE(email, ''), perfil, ativo, COALESCE(comissao_percent, 0), criado_em
	          FROM usuarios
	          ORDER BY CASE WHEN perfil = 'Admin' THEN 0 ELSE 1 END, nome`

	// Se é Consultor, filtrar apenas Consultores
	if userPerfilStr == "Consultor" {
		query = `SELECT id, nome, login, COALESCE(email, ''), perfil, ativo, COALESCE(comissao_percent, 0), criado_em
		         FROM usuarios
		         WHERE perfil != 'Admin'
		         ORDER BY nome`
	}

	rows, err := db.Pool.Query(context.Background(), query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}
	defer rows.Close()

	var usuarios []models.Usuario
	userID, _ := c.Get("user_id")
	userIDStr := userID.(string)

	for rows.Next() {
		var u models.Usuario
		if err := rows.Scan(&u.ID, &u.Nome, &u.Login, &u.Email, &u.Perfil, &u.Ativo, &u.ComissaoPercent, &u.CriadoEm); err != nil {
			continue
		}

		// Se é Consultor e não é a própria conta, mascarar dados sensíveis
		if userPerfilStr == "Consultor" && u.ID != userIDStr {
			u.Login = ""
			u.Email = ""
			u.ComissaoPercent = 0
		}

		usuarios = append(usuarios, u)
	}

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: usuarios})
}

// CriarUsuario cria um novo usuário (Admin only)
func CriarUsuario(c *gin.Context) {
	if err := garantirCamposUsuarios(); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	var req struct {
		Nome            string   `json:"nome" binding:"required"`
		Login           string   `json:"login" binding:"required"`
		Senha           string   `json:"senha" binding:"required,min=6"`
		Email           string   `json:"email"`
		Perfil          string   `json:"perfil"`
		Ativo           *bool    `json:"ativo"`
		ComissaoPercent *float64 `json:"comissao_percent"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Dados inválidos: " + err.Error()})
		return
	}

	req.Nome = strings.TrimSpace(req.Nome)
	req.Login = strings.TrimSpace(req.Login)
	req.Email = strings.TrimSpace(req.Email)
	if req.Nome == "" || req.Login == "" {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Nome e login são obrigatórios"})
		return
	}

	if req.Perfil == "" {
		req.Perfil = "Consultor"
	}
	if !perfisValidos[req.Perfil] {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Perfil inválido"})
		return
	}

	ativo := true
	if req.Ativo != nil {
		ativo = *req.Ativo
	}

	comissao := 0.0
	if req.ComissaoPercent != nil {
		comissao = *req.ComissaoPercent
	}
	if comissao < 0 || comissao > 100 {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Comissão deve estar entre 0 e 100"})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Senha), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Erro ao criptografar senha"})
		return
	}

	var created models.Usuario
	err = db.Pool.QueryRow(context.Background(),
		`INSERT INTO usuarios (nome, login, senha_hash, email, perfil, ativo, comissao_percent)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 RETURNING id, nome, login, COALESCE(email, ''), perfil, ativo, COALESCE(comissao_percent, 0), criado_em`,
		req.Nome, req.Login, string(hash), req.Email, req.Perfil, ativo, comissao,
	).Scan(&created.ID, &created.Nome, &created.Login, &created.Email, &created.Perfil, &created.Ativo, &created.ComissaoPercent, &created.CriadoEm)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "usuarios_login_key") {
			c.JSON(http.StatusConflict, models.APIResponse{Success: false, Error: "Login já está em uso"})
			return
		}
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	c.JSON(http.StatusCreated, models.APIResponse{Success: true, Data: created})
}

// AtualizarUsuario atualiza dados de um usuário (Admin qualquer um; Consultor apenas a si próprio)
func AtualizarUsuario(c *gin.Context) {
	if err := garantirCamposUsuarios(); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "ID do usuário inválido"})
		return
	}

	// Validar permissão: Consultor só pode editar a si prórpio
	userID, _ := c.Get("user_id")
	userIDStr := userID.(string)
	userPerfil, _ := c.Get("perfil")
	userPerfilStr := userPerfil.(string)

	if userPerfilStr == "Consultor" && id != userIDStr {
		c.JSON(http.StatusForbidden, models.APIResponse{Success: false, Error: "Consultores só podem editar sua própria conta"})
		return
	}

	var req struct {
		Nome            string  `json:"nome" binding:"required"`
		Login           string  `json:"login" binding:"required"`
		Senha           string  `json:"senha"`
		Email           string  `json:"email"`
		Perfil          string  `json:"perfil" binding:"required"`
		Ativo           bool    `json:"ativo"`
		ComissaoPercent float64 `json:"comissao_percent"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Dados inválidos: " + err.Error()})
		return
	}

	req.Nome = strings.TrimSpace(req.Nome)
	req.Login = strings.TrimSpace(req.Login)
	req.Email = strings.TrimSpace(req.Email)
	req.Senha = strings.TrimSpace(req.Senha)
	if req.Nome == "" || req.Login == "" {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Nome e login são obrigatórios"})
		return
	}
	if !perfisValidos[req.Perfil] {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Perfil inválido"})
		return
	}
	if req.ComissaoPercent < 0 || req.ComissaoPercent > 100 {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Comissão deve estar entre 0 e 100"})
		return
	}

	if req.Senha != "" && len(req.Senha) < 6 {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Nova senha deve ter ao menos 6 caracteres"})
		return
	}

	if req.Senha != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(req.Senha), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Erro ao criptografar senha"})
			return
		}

		_, err = db.Pool.Exec(context.Background(),
			`UPDATE usuarios
			 SET nome = $1, login = $2, email = $3, perfil = $4, ativo = $5, comissao_percent = $6, senha_hash = $7, atualizado_em = NOW()
			 WHERE id = $8`,
			req.Nome, req.Login, req.Email, req.Perfil, req.Ativo, req.ComissaoPercent, string(hash), id,
		)
		if err != nil {
			if strings.Contains(strings.ToLower(err.Error()), "usuarios_login_key") {
				c.JSON(http.StatusConflict, models.APIResponse{Success: false, Error: "Login já está em uso"})
				return
			}
			c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
			return
		}
	} else {
		_, err := db.Pool.Exec(context.Background(),
			`UPDATE usuarios
			 SET nome = $1, login = $2, email = $3, perfil = $4, ativo = $5, comissao_percent = $6, atualizado_em = NOW()
			 WHERE id = $7`,
			req.Nome, req.Login, req.Email, req.Perfil, req.Ativo, req.ComissaoPercent, id,
		)
		if err != nil {
			if strings.Contains(strings.ToLower(err.Error()), "usuarios_login_key") {
				c.JSON(http.StatusConflict, models.APIResponse{Success: false, Error: "Login já está em uso"})
				return
			}
			c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
			return
		}
	}

	var updated models.Usuario
	err := db.Pool.QueryRow(context.Background(),
		`SELECT id, nome, login, COALESCE(email, ''), perfil, ativo, COALESCE(comissao_percent, 0), criado_em
		 FROM usuarios
		 WHERE id = $1`, id,
	).Scan(&updated.ID, &updated.Nome, &updated.Login, &updated.Email, &updated.Perfil, &updated.Ativo, &updated.ComissaoPercent, &updated.CriadoEm)
	if err != nil {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: "Usuário não encontrado"})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: updated})
}

// DeletarUsuario remove um usuário (Admin qualquer um; Consultor apenas a si próprio)
func DeletarUsuario(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "ID do usuário inválido"})
		return
	}

	requestUserID, _ := c.Get("user_id")
	requestUserIDStr, _ := requestUserID.(string)
	if strings.TrimSpace(requestUserIDStr) == id {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Você não pode excluir sua própria conta"})
		return
	}

	// Validar permissão: Consultor só pode deletar a si próprio (já está impedido acima, então não chega aqui)
	userPerfil, _ := c.Get("perfil")
	userPerfilStr, _ := userPerfil.(string)
	if userPerfilStr == "Consultor" {
		c.JSON(http.StatusForbidden, models.APIResponse{Success: false, Error: "Consultores só podem deletar sua própria conta"})
		return
	}

	result, err := db.Pool.Exec(context.Background(), `DELETE FROM usuarios WHERE id = $1`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	if result.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: "Usuário não encontrado"})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Message: "Usuário removido com sucesso"})
}

// AlterarSenha permite o próprio usuário alterar sua senha
func AlterarSenha(c *gin.Context) {
	userID, _ := c.Get("user_id")

	var req struct {
		SenhaAtual string `json:"senha_atual" binding:"required"`
		NovaSenha  string `json:"nova_senha" binding:"required,min=6"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	var senhaHash string
	err := db.Pool.QueryRow(context.Background(),
		`SELECT senha_hash FROM usuarios WHERE id = $1`, userID,
	).Scan(&senhaHash)
	if err != nil {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: "Usuário não encontrado"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(senhaHash), []byte(req.SenhaAtual)); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Senha atual incorreta"})
		return
	}

	novoHash, err := bcrypt.GenerateFromPassword([]byte(req.NovaSenha), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Erro ao criptografar senha"})
		return
	}

	_, err = db.Pool.Exec(context.Background(),
		`UPDATE usuarios SET senha_hash = $1 WHERE id = $2`, string(novoHash), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Message: "Senha alterada com sucesso"})
}
