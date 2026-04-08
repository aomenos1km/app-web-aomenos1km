-- =================================================================
-- TABELA: lista_transmissao
-- Captação de emails da landing page para avisos de lançamento
-- =================================================================
CREATE TABLE IF NOT EXISTS lista_transmissao (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email         VARCHAR(255) NOT NULL UNIQUE,
    origem        VARCHAR(80) NOT NULL DEFAULT 'landing',
    ip            VARCHAR(64),
    user_agent    TEXT,
    ativo         BOOLEAN NOT NULL DEFAULT true,
    inscrito_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lista_transmissao_inscrito_em ON lista_transmissao(inscrito_em DESC);
