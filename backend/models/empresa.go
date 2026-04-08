package models

import "time"

// Empresa representa um cliente (PJ ou PF) do sistema
type Empresa struct {
	ID                 string    `json:"id" db:"id"`
	DataCadastro       *string   `json:"data_cadastro" db:"data_cadastro"`
	Documento          string    `json:"documento" db:"documento"`
	RazaoSocial        string    `json:"razao_social" db:"razao_social"`
	NomeFantasia       string    `json:"nome_fantasia" db:"nome_fantasia"`
	Responsavel        string    `json:"responsavel" db:"responsavel"`
	Telefone           string    `json:"telefone" db:"telefone"`
	Email              string    `json:"email" db:"email"`
	Endereco           string    `json:"endereco" db:"endereco"`
	Logradouro         string    `json:"logradouro" db:"logradouro"`
	Numero             string    `json:"numero" db:"numero"`
	Complemento        string    `json:"complemento" db:"complemento"`
	Bairro             string    `json:"bairro" db:"bairro"`
	Cidade             string    `json:"cidade" db:"cidade"`
	UF                 string    `json:"uf" db:"uf"`
	CEP                string    `json:"cep" db:"cep"`
	TipoPessoa         string    `json:"tipo_pessoa" db:"tipo_pessoa"` // PJ | PF
	Status             string    `json:"status" db:"status"`           // Ativo | Lead | Inativo
	Observacoes        string    `json:"observacoes" db:"observacoes"`
	CRMProximoContato  *string   `json:"crm_proximo_contato,omitempty"`
	CRMTemRetorno      bool      `json:"crm_tem_retorno"`
	CRMPendente        bool      `json:"crm_pendente"`
	CRMUltimoTexto     string    `json:"crm_ultimo_texto,omitempty"`
	CRMUltimoUsuario   string    `json:"crm_ultimo_usuario,omitempty"`
	CRMUltimaInteracao *string   `json:"crm_ultima_interacao,omitempty"`
	CRMResponsavelNome string    `json:"crm_responsavel_nome,omitempty"`
	CriadoEm           time.Time `json:"criado_em" db:"criado_em"`
	AtualizadoEm       time.Time `json:"atualizado_em" db:"atualizado_em"`
}

// EmpresaInput payload para criar/editar empresa
type EmpresaInput struct {
	Documento    string `json:"documento"`
	RazaoSocial  string `json:"razao_social" binding:"required"`
	NomeFantasia string `json:"nome_fantasia"`
	Responsavel  string `json:"responsavel"`
	Telefone     string `json:"telefone"`
	Email        string `json:"email"`
	Logradouro   string `json:"logradouro"`
	Numero       string `json:"numero"`
	Complemento  string `json:"complemento"`
	Bairro       string `json:"bairro"`
	Cidade       string `json:"cidade"`
	UF           string `json:"uf"`
	CEP          string `json:"cep"`
	TipoPessoa   string `json:"tipo_pessoa"`
	Status       string `json:"status"`
	Observacoes  string `json:"observacoes"`
}

// EmpresaCRMInteracao representa uma anotacao no relacionamento com a empresa
type EmpresaCRMInteracao struct {
	ID             string    `json:"id" db:"id"`
	EmpresaID      string    `json:"empresa_id" db:"empresa_id"`
	UsuarioID      *string   `json:"usuario_id,omitempty" db:"usuario_id"`
	Usuario        string    `json:"usuario" db:"usuario_nome"`
	Texto          string    `json:"texto" db:"texto"`
	ProximoContato *string   `json:"proximo_contato,omitempty" db:"proximo_contato"`
	TipoInteracao  string    `json:"tipo_interacao" db:"tipo_interacao"`
	Canal          string    `json:"canal" db:"canal"`
	Resultado      string    `json:"resultado" db:"resultado"`
	Data           string    `json:"data"`
	Hora           string    `json:"hora"`
	CriadoEm       time.Time `json:"criado_em" db:"criado_em"`
}

// EmpresaCRMInteracaoInput payload para registrar nova interacao de CRM
type EmpresaCRMInteracaoInput struct {
	Texto             string `json:"texto" binding:"required"`
	ProximoContato    string `json:"proximo_contato"`
	TipoInteracao     string `json:"tipo_interacao"`
	Canal             string `json:"canal"`
	Resultado         string `json:"resultado"`
	Prioridade        string `json:"prioridade"`
	ResponsavelUserID string `json:"responsavel_user_id"`
	ResponsavelNome   string `json:"responsavel_nome"`
}
