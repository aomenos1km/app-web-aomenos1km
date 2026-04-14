package models

import "time"

// Participante representa um inscrito em um evento
type Participante struct {
	ID                      string    `json:"id" db:"id"`
	ContratoID              string    `json:"contrato_id" db:"contrato_id"`
	Nome                    string    `json:"nome" db:"nome"`
	Whatsapp                string    `json:"whatsapp" db:"whatsapp"`
	Email                   string    `json:"email" db:"email"`
	TamanhoCamiseta         string    `json:"tamanho_camiseta" db:"tamanho_camiseta"`
	Modalidade              string    `json:"modalidade" db:"modalidade"`
	DataInscricao           time.Time `json:"data_inscricao" db:"data_inscricao"`
	CPF                     string    `json:"cpf" db:"cpf"`
	Nascimento              *string   `json:"nascimento" db:"nascimento"`
	Cidade                  string    `json:"cidade" db:"cidade"`
	ModalidadeDistancia     string    `json:"modalidade_distancia" db:"modalidade_distancia"`
	TempoPratica            string    `json:"tempo_pratica" db:"tempo_pratica"`
	TemAssessoria           string    `json:"tem_assessoria" db:"tem_assessoria"`
	Objetivo                string    `json:"objetivo" db:"objetivo"`
	AptoFisico              bool      `json:"apto_fisico" db:"apto_fisico"`
	TermoResponsabilidade   bool      `json:"termo_responsabilidade" db:"termo_responsabilidade"`
	UsoImagem               bool      `json:"uso_imagem" db:"uso_imagem"`
	InteresseAssessoria     bool      `json:"interesse_assessoria" db:"interesse_assessoria"`
	FormatoInteresse        string    `json:"formato_interesse" db:"formato_interesse"`
	ComoConheceu            string    `json:"como_conheceu" db:"como_conheceu"`
	Observacoes             string    `json:"observacoes" db:"observacoes"`
	UF                      string    `json:"uf" db:"uf"`
	ComprovanteURL          string    `json:"comprovante_url" db:"comprovante_url"`
	StatusPagamento         string    `json:"status_pagamento" db:"status_pagamento"`
	NumeroKit               *int      `json:"numero_kit" db:"numero_kit"`
	GeneroIdentidade        *string   `json:"genero_identidade" db:"genero_identidade"`
	InscricaoRelacionamento *string   `json:"inscricao_relacionamento" db:"inscricao_relacionamento"`
	InscricaoTitularID      *string   `json:"inscricao_titular_id" db:"inscricao_titular_id"`
	CriadoEm                time.Time `json:"criado_em" db:"criado_em"`
	AtualizadoEm            time.Time `json:"atualizado_em" db:"atualizado_em"`
}

type DependenteInput struct {
	Nome            string `json:"nome" binding:"required"`
	CPF             string `json:"cpf" binding:"required"`
	Nascimento      string `json:"nascimento"`
	Relacionamento  string `json:"relacionamento" binding:"required"`
	TamanhoCamiseta string `json:"tamanho_camiseta"`
}

// ParticipanteInput payload para criar participante via check-in
type ParticipanteInput struct {
	ContratoID              string            `json:"contrato_id" binding:"required"`
	Nome                    string            `json:"nome" binding:"required"`
	Whatsapp                string            `json:"whatsapp" binding:"required"`
	Email                   string            `json:"email"`
	TamanhoCamiseta         string            `json:"tamanho_camiseta"`
	Modalidade              string            `json:"modalidade"`
	CPF                     string            `json:"cpf" binding:"required"`
	Nascimento              string            `json:"nascimento"`
	Cidade                  string            `json:"cidade"`
	ModalidadeDistancia     string            `json:"modalidade_distancia"`
	TempoPratica            string            `json:"tempo_pratica"`
	TemAssessoria           string            `json:"tem_assessoria"`
	Objetivo                string            `json:"objetivo"`
	AptoFisico              bool              `json:"apto_fisico"`
	TermoResponsabilidade   bool              `json:"termo_responsabilidade"`
	UsoImagem               bool              `json:"uso_imagem"`
	InteresseAssessoria     bool              `json:"interesse_assessoria"`
	FormatoInteresse        string            `json:"formato_interesse"`
	ComoConheceu            string            `json:"como_conheceu"`
	Observacoes             string            `json:"observacoes"`
	UF                      string            `json:"uf"`
	ComprovanteURL          string            `json:"comprovante_url"`
	GeneroIdentidade        string            `json:"genero_identidade"`
	InscricaoRelacionamento string            `json:"inscricao_relacionamento"`
	InscricaoTitularID      string            `json:"inscricao_titular_id"`
	Dependentes             []DependenteInput `json:"dependentes"`
}

// ParticipanteEdicao payload para editar participante pelo admin
type ParticipanteEdicao struct {
	Nome                    string `json:"nome"`
	CPF                     string `json:"cpf"`
	Nascimento              string `json:"nascimento"`
	Whatsapp                string `json:"whatsapp"`
	Email                   string `json:"email"`
	Cidade                  string `json:"cidade"`
	UF                      string `json:"uf"`
	TamanhoCamiseta         string `json:"tamanho_camiseta"`
	Modalidade              string `json:"modalidade"`
	ModalidadeDistancia     string `json:"modalidade_distancia"`
	TempoPratica            string `json:"tempo_pratica"`
	TemAssessoria           string `json:"tem_assessoria"`
	Objetivo                string `json:"objetivo"`
	AptoFisico              bool   `json:"apto_fisico"`
	TermoResponsabilidade   bool   `json:"termo_responsabilidade"`
	UsoImagem               bool   `json:"uso_imagem"`
	InteresseAssessoria     bool   `json:"interesse_assessoria"`
	FormatoInteresse        string `json:"formato_interesse"`
	ComoConheceu            string `json:"como_conheceu"`
	Observacoes             string `json:"observacoes"`
	NumeroKit               *int   `json:"numero_kit"`
	StatusPagamento         string `json:"status_pagamento"`
	ComprovanteURL          string `json:"comprovante_url"`
	GeneroIdentidade        string `json:"genero_identidade"`
	InscricaoRelacionamento string `json:"inscricao_relacionamento"`
	InscricaoTitularID      string `json:"inscricao_titular_id"`
}
