-- =================================================================
-- CRM de Empresas
-- =================================================================

CREATE TABLE IF NOT EXISTS empresas_crm_interacoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    usuario_nome VARCHAR(255) NOT NULL DEFAULT 'Consultor',
    texto TEXT NOT NULL,
    proximo_contato DATE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_empresas_crm_interacoes_empresa ON empresas_crm_interacoes(empresa_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_empresas_crm_interacoes_proximo_contato ON empresas_crm_interacoes(proximo_contato);
