package models

import "time"

// Usuario representa um usuário do painel administrativo
type Usuario struct {
	ID              string    `json:"id" db:"id"`
	Nome            string    `json:"nome" db:"nome"`
	Login           string    `json:"login" db:"login"`
	Email           string    `json:"email" db:"email"`
	SenhaHash       string    `json:"-" db:"senha_hash"`
	Perfil          string    `json:"perfil" db:"perfil"`
	Ativo           bool      `json:"ativo" db:"ativo"`
	ComissaoPercent float64   `json:"comissao_percent" db:"comissao_percent"`
	CriadoEm        time.Time `json:"criado_em" db:"criado_em"`
	AtualizadoEm    time.Time `json:"atualizado_em" db:"atualizado_em"`
}

// LoginRequest payload de entrada para login
type LoginRequest struct {
	Login string `json:"login" binding:"required"`
	Senha string `json:"senha" binding:"required"`
}

// LoginResponse resposta do endpoint de login
type LoginResponse struct {
	Token  string `json:"token"`
	Perfil string `json:"perfil"`
	Nome   string `json:"nome"`
	ID     string `json:"id"`
}

// Claims para JWT
type Claims struct {
	UserID string `json:"user_id"`
	Login  string `json:"login"`
	Perfil string `json:"perfil"`
	Nome   string `json:"nome"`
}
