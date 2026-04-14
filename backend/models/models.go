package models

import "time"

// Insumo representa um produto ou serviço disponível para orçamentos
type Insumo struct {
	ID            string    `json:"id" db:"id"`
	Nome          string    `json:"nome" db:"nome"`
	Categoria     string    `json:"categoria" db:"categoria"`
	Descricao     string    `json:"descricao" db:"descricao"`
	PrecoUnitario float64   `json:"preco_unitario" db:"preco_unitario"`
	Unidade       string    `json:"unidade" db:"unidade"`
	Ativo         bool      `json:"ativo" db:"ativo"`
	CriadoPorUser *string   `json:"criado_por_user_id,omitempty" db:"criado_por_user_id"`
	CriadoEm      time.Time `json:"criado_em" db:"criado_em"`
	AtualizadoEm  time.Time `json:"atualizado_em" db:"atualizado_em"`
}

type InsumoInput struct {
	Nome          string  `json:"nome" binding:"required"`
	Categoria     string  `json:"categoria"`
	Descricao     string  `json:"descricao"`
	PrecoUnitario float64 `json:"preco_unitario"`
	Unidade       string  `json:"unidade"`
	Ativo         bool    `json:"ativo"`
}

// Local representa um parque/local de evento
type Local struct {
	ID               string    `json:"id" db:"id"`
	Codigo           string    `json:"codigo" db:"codigo"`
	Nome             string    `json:"nome" db:"nome"`
	Tipo             string    `json:"tipo" db:"tipo"`
	Logradouro       string    `json:"logradouro" db:"logradouro"`
	Numero           string    `json:"numero" db:"numero"`
	Complemento      string    `json:"complemento" db:"complemento"`
	Bairro           string    `json:"bairro" db:"bairro"`
	Cidade           string    `json:"cidade" db:"cidade"`
	UF               string    `json:"uf" db:"uf"`
	CEP              string    `json:"cep" db:"cep"`
	TipoTaxa         string    `json:"tipo_taxa" db:"tipo_taxa"`
	TaxaValor        float64   `json:"taxa_valor" db:"taxa_valor"`
	MinimoPessoas    int       `json:"minimo_pessoas" db:"minimo_pessoas"`
	CapacidadeMaxima *int      `json:"capacidade_maxima" db:"capacidade_maxima"`
	Responsavel      string    `json:"responsavel" db:"responsavel"`
	WhatsApp         string    `json:"whatsapp" db:"whatsapp"`
	Latitude         *float64  `json:"latitude" db:"latitude"`
	Longitude        *float64  `json:"longitude" db:"longitude"`
	Observacoes      string    `json:"observacoes" db:"observacoes"`
	Ativo            bool      `json:"ativo" db:"ativo"`
	CriadoPorUser    *string   `json:"criado_por_user_id,omitempty" db:"criado_por_user_id"`
	CriadoEm         time.Time `json:"criado_em" db:"criado_em"`
}

type LocalInput struct {
	Codigo           string   `json:"codigo"`
	Nome             string   `json:"nome" binding:"required"`
	Tipo             string   `json:"tipo"`
	Logradouro       string   `json:"logradouro"`
	Numero           string   `json:"numero"`
	Complemento      string   `json:"complemento"`
	Bairro           string   `json:"bairro"`
	Cidade           string   `json:"cidade"`
	UF               string   `json:"uf"`
	CEP              string   `json:"cep"`
	TipoTaxa         string   `json:"tipo_taxa"`
	TaxaValor        float64  `json:"taxa_valor"`
	MinimoPessoas    int      `json:"minimo_pessoas"`
	CapacidadeMaxima *int     `json:"capacidade_maxima"`
	Responsavel      string   `json:"responsavel"`
	WhatsApp         string   `json:"whatsapp"`
	Latitude         *float64 `json:"latitude"`
	Longitude        *float64 `json:"longitude"`
	Observacoes      string   `json:"observacoes"`
	Ativo            bool     `json:"ativo"`
}

// Notificacao representa um alerta interno do sistema
type Notificacao struct {
	ID          string    `json:"id" db:"id"`
	Titulo      string    `json:"titulo" db:"titulo"`
	Mensagem    string    `json:"mensagem" db:"mensagem"`
	Tipo        string    `json:"tipo" db:"tipo"`
	Lida        bool      `json:"lida" db:"lida"`
	UsuarioID   *string   `json:"usuario_id" db:"usuario_id"`
	ContratoID  *string   `json:"contrato_id" db:"contrato_id"`
	PropostaID  *string   `json:"proposta_id" db:"proposta_id"`
	AutorNome   string    `json:"autor_nome" db:"autor_nome"`
	AutorPerfil string    `json:"autor_perfil" db:"autor_perfil"`
	CriadoEm    time.Time `json:"criado_em" db:"criado_em"`
}

// OrcamentoPublico representa uma solicitação de orçamento via formulário público
type OrcamentoPublico struct {
	ID               string    `json:"id" db:"id"`
	EmpresaNome      string    `json:"empresa_nome" db:"empresa_nome"`
	Responsavel      string    `json:"responsavel" db:"responsavel"`
	Email            string    `json:"email" db:"email"`
	Telefone         string    `json:"telefone" db:"telefone"`
	DataInteresse    *string   `json:"data_interesse" db:"data_interesse"`
	LocalNome        string    `json:"local_nome" db:"local_nome"`
	Cidade           string    `json:"cidade" db:"cidade"`
	Modalidade       string    `json:"modalidade" db:"modalidade"`
	QtdParticipantes int       `json:"qtd_participantes" db:"qtd_participantes"`
	KM               string    `json:"km" db:"km"`
	PossuiKit        bool      `json:"possui_kit" db:"possui_kit"`
	Mensagem         string    `json:"mensagem" db:"mensagem"`
	Status           string    `json:"status" db:"status"`
	CriadoEm         time.Time `json:"criado_em" db:"criado_em"`
}

type OrcamentoPublicoInput struct {
	EmpresaNome      string  `json:"empresa_nome" binding:"required"`
	Responsavel      string  `json:"responsavel" binding:"required"`
	Email            string  `json:"email" binding:"required"`
	Telefone         string  `json:"telefone" binding:"required"`
	ValorEstimado    float64 `json:"valor_estimado"`
	CEP              string  `json:"cep"`
	Logradouro       string  `json:"logradouro"`
	Numero           string  `json:"numero"`
	Complemento      string  `json:"complemento"`
	Bairro           string  `json:"bairro"`
	Cidade           string  `json:"cidade"`
	UF               string  `json:"uf"`
	DataInteresse    *string `json:"data_interesse"`
	Modalidade       string  `json:"modalidade"`
	QtdParticipantes int     `json:"qtd_participantes"`
	KM               string  `json:"km"`
	PossuiKit        bool    `json:"possui_kit"`
	Mensagem         string  `json:"mensagem"`
	Consultor        string  `json:"consultor"`
	TipoPessoa       string  `json:"tipo_pessoa"`
	CNPJ             string  `json:"cnpj"`
	CPF              string  `json:"cpf"`
	LocalNome        string  `json:"local_nome"`
}

// Proposta representa um orçamento salvo no painel interno
type Proposta struct {
	ID               string         `json:"id" db:"id"`
	OrcamentoPublico *string        `json:"orcamento_publico_id,omitempty" db:"orcamento_publico_id"`
	EmpresaID        *string        `json:"empresa_id,omitempty" db:"empresa_id"`
	EmpresaNome      string         `json:"empresa_nome" db:"empresa_nome"`
	Responsavel      string         `json:"responsavel" db:"responsavel"`
	Email            string         `json:"email" db:"email"`
	Telefone         string         `json:"telefone" db:"telefone"`
	EventoNome       string         `json:"evento_nome" db:"evento_nome"`
	DataEvento       *string        `json:"data_evento,omitempty" db:"data_evento"`
	HoraChegada      string         `json:"hora_chegada" db:"hora_chegada"`
	LocalID          *string        `json:"local_id,omitempty" db:"local_id"`
	LocalNome        string         `json:"local_nome" db:"local_nome"`
	CidadeEvento     string         `json:"cidade_evento" db:"cidade_evento"`
	QtdPessoas       int            `json:"qtd_pessoas" db:"qtd_pessoas"`
	KMEvento         float64        `json:"km_evento" db:"km_evento"`
	MargemPercent    float64        `json:"margem_percent" db:"margem_percent"`
	SubtotalItens    float64        `json:"subtotal_itens" db:"subtotal_itens"`
	TaxaLocal        float64        `json:"taxa_local" db:"taxa_local"`
	ValorMargem      float64        `json:"valor_margem" db:"valor_margem"`
	ValorTotal       float64        `json:"valor_total" db:"valor_total"`
	PrecoIngresso    *float64       `json:"preco_ingresso,omitempty" db:"preco_ingresso"`
	Observacoes      string         `json:"observacoes" db:"observacoes"`
	Status           string         `json:"status" db:"status"`
	AutorNome        string         `json:"autor_nome" db:"autor_nome"`
	CriadoEm         time.Time      `json:"criado_em" db:"criado_em"`
	AtualizadoEm     time.Time      `json:"atualizado_em" db:"atualizado_em"`
	Itens            []PropostaItem `json:"itens,omitempty"`
}

type PropostaItem struct {
	ID         string    `json:"id" db:"id"`
	PropostaID string    `json:"proposta_id" db:"proposta_id"`
	InsumoID   *string   `json:"insumo_id,omitempty" db:"insumo_id"`
	Nome       string    `json:"nome" db:"nome"`
	Descricao  string    `json:"descricao" db:"descricao"`
	Quantidade float64   `json:"quantidade" db:"quantidade"`
	ValorUnit  float64   `json:"valor_unitario" db:"valor_unitario"`
	ValorTotal float64   `json:"valor_total" db:"valor_total"`
	Ordem      int       `json:"ordem" db:"ordem"`
	CriadoEm   time.Time `json:"criado_em" db:"criado_em"`
}

type PropostaItemInput struct {
	InsumoID   *string `json:"insumo_id"`
	Nome       string  `json:"nome" binding:"required"`
	Descricao  string  `json:"descricao"`
	Quantidade float64 `json:"quantidade"`
	ValorUnit  float64 `json:"valor_unitario"`
}

type PropostaInput struct {
	OrcamentoPublico *string             `json:"orcamento_publico_id"`
	EmpresaID        *string             `json:"empresa_id"`
	EmpresaNome      string              `json:"empresa_nome" binding:"required"`
	Responsavel      string              `json:"responsavel"`
	Email            string              `json:"email"`
	Telefone         string              `json:"telefone"`
	EventoNome       string              `json:"evento_nome" binding:"required"`
	DataEvento       *string             `json:"data_evento"`
	HoraChegada      string              `json:"hora_chegada"`
	LocalID          *string             `json:"local_id"`
	LocalNome        string              `json:"local_nome"`
	CidadeEvento     string              `json:"cidade_evento"`
	QtdPessoas       int                 `json:"qtd_pessoas"`
	KMEvento         float64             `json:"km_evento"`
	MargemPercent    float64             `json:"margem_percent"`
	SubtotalItens    float64             `json:"subtotal_itens"`
	TaxaLocal        float64             `json:"taxa_local"`
	ValorMargem      float64             `json:"valor_margem"`
	ValorTotal       float64             `json:"valor_total"`
	PrecoIngresso    *float64            `json:"preco_ingresso,omitempty"`
	Observacoes      string              `json:"observacoes"`
	Status           string              `json:"status"`
	Itens            []PropostaItemInput `json:"itens" binding:"required"`
}

type PropostaStatusInput struct {
	Status string `json:"status" binding:"required"`
}

// PerfilOrcamento representa um modelo de estrutura de serviços (ex: Econômico, Padrão, VIP)
type PerfilOrcamento struct {
	ID        string    `json:"id" db:"id"`
	Nome      string    `json:"nome" db:"nome"`
	Descricao string    `json:"descricao" db:"descricao"`
	Ativo     bool      `json:"ativo" db:"ativo"`
	CriadoEm  time.Time `json:"criado_em" db:"criado_em"`
}

type PerfilOrcamentoInput struct {
	Nome      string `json:"nome" binding:"required"`
	Descricao string `json:"descricao"`
	Ativo     bool   `json:"ativo"`
}

// RegraOrcamento representa uma regra de cálculo dentro de um perfil
type RegraOrcamento struct {
	ID        string    `json:"id" db:"id"`
	PerfilID  string    `json:"perfil_id" db:"perfil_id"`
	InsumoID  *string   `json:"insumo_id,omitempty" db:"insumo_id"`
	NomeItem  string    `json:"nome_item" db:"nome_item"`
	TipoRegra string    `json:"tipo_regra" db:"tipo_regra"` // Fixo | Por Pessoa | Ratio
	Divisor   float64   `json:"divisor" db:"divisor"`
	Categoria string    `json:"categoria" db:"categoria"`
	CriadoEm  time.Time `json:"criado_em" db:"criado_em"`
}

type RegraOrcamentoInput struct {
	PerfilID  string  `json:"perfil_id" binding:"required"`
	InsumoID  *string `json:"insumo_id"`
	NomeItem  string  `json:"nome_item" binding:"required"`
	TipoRegra string  `json:"tipo_regra" binding:"required"`
	Divisor   float64 `json:"divisor"`
	Categoria string  `json:"categoria"`
}

// ItemCalculado é retornado pelo endpoint de calcular estrutura sugerida
type ItemCalculado struct {
	InsumoID   *string `json:"insumo_id,omitempty"`
	Nome       string  `json:"nome"`
	Categoria  string  `json:"categoria"`
	Quantidade float64 `json:"quantidade"`
	ValorUnit  float64 `json:"valor_unitario"`
}

// DashboardStats representa os dados do painel principal
type DashboardStats struct {
	TotalEventosAtivos    int              `json:"total_eventos_ativos"`
	TotalEventosMes       int              `json:"total_eventos_mes"`
	TotalParticipantesMes int              `json:"total_participantes_mes"`
	ReceitaMes            float64          `json:"receita_mes"`
	ReceitaTotal          float64          `json:"receita_total"`
	OcupacaoMedia         float64          `json:"ocupacao_media"`
	ProximosEventos       []ContratoResumo `json:"proximos_eventos"`
}

// ContratoResumo usado em listas e relatórios
type ContratoResumo struct {
	ID           string  `json:"id"`
	NomeEvento   string  `json:"nome_evento"`
	EmpresaNome  string  `json:"empresa_nome"`
	DataEvento   *string `json:"data_evento"`
	LocalNome    string  `json:"local_nome"`
	Status       string  `json:"status"`
	QtdInscritos int     `json:"qtd_inscritos"`
	QtdTotal     int     `json:"qtd_total"`
}

// APIResponse envelope padrão para respostas
type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
	Message string      `json:"message,omitempty"`
}
