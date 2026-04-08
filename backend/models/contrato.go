package models

import "time"

// Contrato representa um evento/contrato (central do sistema)
type Contrato struct {
	ID            string    `json:"id" db:"id"`
	DataCriacao   *string   `json:"data_criacao" db:"data_criacao"`
	EmpresaID     *string   `json:"empresa_id" db:"empresa_id"`
	EmpresaNome   string    `json:"empresa_nome" db:"empresa_nome"`
	Descricao     string    `json:"descricao" db:"descricao"`
	ValorTotal    float64   `json:"valor_total" db:"valor_total"`
	DataEvento    *string   `json:"data_evento" db:"data_evento"`
	LocalID       *string   `json:"local_id" db:"local_id"`
	LocalNome     string    `json:"local_nome" db:"local_nome"`
	Modalidade    string    `json:"modalidade" db:"modalidade"`
	QtdContratada int       `json:"qtd_contratada" db:"qtd_contratada"`
	QtdKit        int       `json:"qtd_kit" db:"qtd_kit"`
	KM            string    `json:"km" db:"km"`
	Status        string    `json:"status" db:"status"`
	ValorPago     float64   `json:"valor_pago" db:"valor_pago"`
	DataPagamento *string   `json:"data_pagamento" db:"data_pagamento"`
	Consultor     string    `json:"consultor" db:"consultor"`
	PossuiKit     bool      `json:"possui_kit" db:"possui_kit"`
	TipoKit       string    `json:"tipo_kit" db:"tipo_kit"`
	LinkGateway   string    `json:"link_gateway" db:"link_gateway"`
	QRCodePix     string    `json:"qr_code_pix" db:"qr_code_pix"`
	NomeEvento    string    `json:"nome_evento" db:"nome_evento"`
	CapaURL       string    `json:"capa_url" db:"capa_url"`
	Observacoes   string    `json:"observacoes" db:"observacoes"`
	PixCopiaECola string    `json:"pix_copia_cola" db:"pix_copia_cola"`
	PrecoIngresso *float64  `json:"preco_ingresso" db:"preco_ingresso"`
	CriadoEm      time.Time `json:"criado_em" db:"criado_em"`
	AtualizadoEm  time.Time `json:"atualizado_em" db:"atualizado_em"`

	// Campos extras (JOINs ou computados)
	QtdInscritos int `json:"qtd_inscritos,omitempty" db:"qtd_inscritos"`
}

// ContratoInput payload para criar/editar contrato
type ContratoInput struct {
	EmpresaID     *string  `json:"empresa_id"`
	EmpresaNome   string   `json:"empresa_nome" binding:"required"`
	Descricao     string   `json:"descricao"`
	ValorTotal    float64  `json:"valor_total"`
	DataEvento    *string  `json:"data_evento"`
	LocalID       *string  `json:"local_id"`
	LocalNome     string   `json:"local_nome"`
	Modalidade    string   `json:"modalidade"`
	QtdContratada int      `json:"qtd_contratada"`
	QtdKit        int      `json:"qtd_kit"`
	KM            string   `json:"km"`
	Status        string   `json:"status"`
	ValorPago     float64  `json:"valor_pago"`
	DataPagamento *string  `json:"data_pagamento"`
	Consultor     string   `json:"consultor"`
	PossuiKit     bool     `json:"possui_kit"`
	TipoKit       string   `json:"tipo_kit"`
	LinkGateway   string   `json:"link_gateway"`
	QRCodePix     string   `json:"qr_code_pix"`
	NomeEvento    string   `json:"nome_evento"`
	CapaURL       string   `json:"capa_url"`
	Observacoes   string   `json:"observacoes"`
	PixCopiaECola string   `json:"pix_copia_cola"`
	PrecoIngresso *float64 `json:"preco_ingresso"`
}

type ContratoStatusInput struct {
	Status string `json:"status" binding:"required"`
}

// ContratoRetroativoInput payload para cadastrar eventos passados sem passar pelo gerador
type ContratoRetroativoInput struct {
	EmpresaNome         string  `json:"empresa_nome" binding:"required"`
	NomeEvento          string  `json:"nome_evento" binding:"required"`
	DataEvento          string  `json:"data_evento" binding:"required"`
	LocalID             *string `json:"local_id"`
	LocalNome           string  `json:"local_nome"`
	LocalNaoCadastrado  bool    `json:"local_nao_cadastrado"`
	Modalidade          string  `json:"modalidade"`
	QtdContratada       int     `json:"qtd_contratada"`
	ValorTotal          float64 `json:"valor_total"`
	ValorPago           float64 `json:"valor_pago"`
	KM                  string  `json:"km"`
	Consultor           string  `json:"consultor"`
	Observacoes         string  `json:"observacoes"`
}

// ContratoPublico dados mínimos expostos ao formulário público de check-in
type ContratoPublico struct {
	ID              string   `json:"id"`
	EmpresaNome     string   `json:"empresa_nome"`
	NomeEvento      string   `json:"nome_evento"`
	ValorTotal      float64  `json:"valor_total"`
	DataEvento      *string  `json:"data_evento"`
	LocalNome       string   `json:"local_nome"`
	Modalidade      string   `json:"modalidade"`
	LinkGateway     string   `json:"link_gateway"`
	QRCodePix       string   `json:"qr_code_pix"`
	CapaURL         string   `json:"capa_url"`
	PixCopiaECola   string   `json:"pix_copia_cola"`
	PrecoIngresso   *float64 `json:"preco_ingresso"`
	VagasTotal      int      `json:"vagas_total"`
	VagasOcupadas   int      `json:"vagas_ocupadas"`
	PercentualVagas int      `json:"percentual_vagas"`
}
