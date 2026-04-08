package models

import "time"

type EmpresaCRMPendencia struct {
	ID                string     `json:"id" db:"id"`
	EmpresaID         string     `json:"empresa_id" db:"empresa_id"`
	InteracaoOrigemID *string    `json:"interacao_origem_id,omitempty" db:"interacao_origem_id"`
	ResponsavelUserID *string    `json:"responsavel_user_id,omitempty" db:"responsavel_user_id"`
	ResponsavelNome   string     `json:"responsavel_nome" db:"responsavel_nome"`
	Descricao         string     `json:"descricao" db:"descricao"`
	Status            string     `json:"status" db:"status"`
	Prioridade        string     `json:"prioridade" db:"prioridade"`
	StatusLabel       string     `json:"status_label,omitempty"`
	DataPrevista      string     `json:"data_prevista" db:"data_prevista"`
	ConcluidaEm       *time.Time `json:"concluida_em,omitempty" db:"concluida_em"`
	ConcluidaPorNome  string     `json:"concluida_por_nome,omitempty" db:"concluida_por_nome"`
	CriadoEm          time.Time  `json:"criado_em" db:"criado_em"`
	AtualizadoEm      time.Time  `json:"atualizado_em" db:"atualizado_em"`
}

type EmpresaCRMPainelResumo struct {
	PendenciasAbertas int `json:"pendencias_abertas"`
	PendenciasHoje    int `json:"pendencias_hoje"`
	PendenciasAtraso  int `json:"pendencias_atraso"`
	PendenciasSemana  int `json:"pendencias_semana"`
}

type EmpresaCRMMetricas struct {
	Interacoes30d         int     `json:"interacoes_30d"`
	ContatosRealizados30d int     `json:"contatos_realizados_30d"`
	SemRetorno30d         int     `json:"sem_retorno_30d"`
	Convertidos30d        int     `json:"convertidos_30d"`
	TaxaConversao30d      float64 `json:"taxa_conversao_30d"`
}

type EmpresaCRMPainelItem struct {
	PendenciaID         string  `json:"pendencia_id"`
	EmpresaID           string  `json:"empresa_id"`
	EmpresaNome         string  `json:"empresa_nome"`
	EmpresaFantasia     string  `json:"empresa_fantasia"`
	ResponsavelContato  string  `json:"responsavel_contato"`
	Telefone            string  `json:"telefone"`
	Email               string  `json:"email"`
	Cidade              string  `json:"cidade"`
	UF                  string  `json:"uf"`
	DataPrevista        string  `json:"data_prevista"`
	ResponsavelCRM      string  `json:"responsavel_crm"`
	DescricaoPendencia  string  `json:"descricao_pendencia"`
	Prioridade          string  `json:"prioridade"`
	Status              string  `json:"status"`
	AtrasoDias          int     `json:"atraso_dias"`
	UltimoTexto         string  `json:"ultimo_texto"`
	UltimoUsuario       string  `json:"ultimo_usuario"`
	UltimoCriadoEm      *string `json:"ultimo_criado_em,omitempty"`
	UltimoResultado     string  `json:"ultimo_resultado"`
	UltimoCanal         string  `json:"ultimo_canal"`
	UltimoTipoInteracao string  `json:"ultimo_tipo_interacao"`
	Situacao            string  `json:"situacao"`
}

type EmpresaCRMPainelResponse struct {
	Resumo     EmpresaCRMPainelResumo `json:"resumo"`
	Metricas   EmpresaCRMMetricas     `json:"metricas"`
	Pendencias []EmpresaCRMPainelItem `json:"pendencias"`
}

type EmpresaCRMPendenciaUpdateInput struct {
	Status            string `json:"status"`
	Prioridade        string `json:"prioridade"`
	DataPrevista      string `json:"data_prevista"`
	ResponsavelUserID string `json:"responsavel_user_id"`
	ResponsavelNome   string `json:"responsavel_nome"`
}
