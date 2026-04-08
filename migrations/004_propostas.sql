-- =================================================================
-- AOMENOS1KM — Propostas de Orçamento (Fase 2)
-- =================================================================

CREATE TABLE IF NOT EXISTS propostas (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    orcamento_publico_id UUID REFERENCES orcamentos_publicos(id),
    empresa_id           UUID REFERENCES empresas(id),
    empresa_nome         VARCHAR(255) NOT NULL,
    responsavel          VARCHAR(255),
    email                VARCHAR(255),
    telefone             VARCHAR(30),
    evento_nome          VARCHAR(255) NOT NULL,
    data_evento          DATE,
    local_id             UUID REFERENCES locais(id),
    local_nome           VARCHAR(255),
    cidade_evento        VARCHAR(100),
    qtd_pessoas          INTEGER NOT NULL DEFAULT 0,
    km_evento            DECIMAL(10,2) NOT NULL DEFAULT 0,
    margem_percent       DECIMAL(6,2) NOT NULL DEFAULT 0,
    subtotal_itens       DECIMAL(12,2) NOT NULL DEFAULT 0,
    taxa_local           DECIMAL(12,2) NOT NULL DEFAULT 0,
    valor_margem         DECIMAL(12,2) NOT NULL DEFAULT 0,
    valor_total          DECIMAL(12,2) NOT NULL DEFAULT 0,
    observacoes          TEXT,
    status               VARCHAR(30) NOT NULL DEFAULT 'Rascunho', -- Rascunho | Proposta Enviada | Convertida
    criado_em            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_propostas_empresa_id ON propostas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_propostas_status ON propostas(status);
CREATE INDEX IF NOT EXISTS idx_propostas_data_evento ON propostas(data_evento);

CREATE TABLE IF NOT EXISTS proposta_itens (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    proposta_id    UUID NOT NULL REFERENCES propostas(id) ON DELETE CASCADE,
    insumo_id      UUID REFERENCES insumos(id),
    nome           VARCHAR(255) NOT NULL,
    descricao      TEXT,
    quantidade     DECIMAL(10,2) NOT NULL DEFAULT 0,
    valor_unitario DECIMAL(12,2) NOT NULL DEFAULT 0,
    valor_total    DECIMAL(12,2) NOT NULL DEFAULT 0,
    ordem          INTEGER NOT NULL DEFAULT 1,
    criado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposta_itens_proposta_id ON proposta_itens(proposta_id);

DROP TRIGGER IF EXISTS set_timestamp ON propostas;
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON propostas
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
