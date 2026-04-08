-- =================================================================
-- TABELA: metas_mensais
-- Metas de vendas por mês para rastreamento de performance
-- =================================================================
CREATE TABLE IF NOT EXISTS metas_mensais (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mes         INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
    ano         INTEGER NOT NULL,
    meta_vendas DECIMAL(15,2) NOT NULL DEFAULT 0,
    meta_km     DECIMAL(10,2) NOT NULL DEFAULT 0,
    meta_contratos INTEGER NOT NULL DEFAULT 0,
    descricao   TEXT,
    ativo       BOOLEAN NOT NULL DEFAULT true,
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(mes, ano)
);

CREATE INDEX IF NOT EXISTS idx_metas_mensais_periodo ON metas_mensais(mes, ano);

-- Seed com metas para 2026 (valores de exemplo)
INSERT INTO metas_mensais (mes, ano, meta_vendas, meta_km, meta_contratos, descricao)
VALUES
    (1, 2026, 50000.00, 150, 5, 'Meta Janeiro 2026'),
    (2, 2026, 55000.00, 160, 5, 'Meta Fevereiro 2026'),
    (3, 2026, 60000.00, 170, 6, 'Meta Março 2026'),
    (4, 2026, 65000.00, 180, 6, 'Meta Abril 2026'),
    (5, 2026, 70000.00, 190, 7, 'Meta Maio 2026'),
    (6, 2026, 75000.00, 200, 7, 'Meta Junho 2026'),
    (7, 2026, 75000.00, 200, 7, 'Meta Julho 2026'),
    (8, 2026, 70000.00, 190, 7, 'Meta Agosto 2026'),
    (9, 2026, 65000.00, 180, 6, 'Meta Setembro 2026'),
    (10, 2026, 60000.00, 170, 6, 'Meta Outubro 2026'),
    (11, 2026, 55000.00, 160, 5, 'Meta Novembro 2026'),
    (12, 2026, 80000.00, 220, 8, 'Meta Dezembro 2026')
ON CONFLICT (mes, ano) DO NOTHING;
