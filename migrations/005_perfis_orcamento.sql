-- Migration 005: Perfis e Regras de Orçamento
-- Estas tabelas alimentam a "Automação de Estrutura" do Gerador de Orçamentos.
-- Cada perfil (ex.: Econômico, Padrão, VIP) possui coleção de regras que determinam
-- quais insumos entram e como a quantidade deles é calculada.

CREATE TABLE IF NOT EXISTS perfis_orcamento (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome      VARCHAR(120) NOT NULL,
    descricao TEXT,
    ativo     BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS perfis_orcamento_nome_uq ON perfis_orcamento (lower(nome));

CREATE TABLE IF NOT EXISTS regras_orcamento (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    perfil_id   UUID NOT NULL REFERENCES perfis_orcamento(id) ON DELETE CASCADE,
    insumo_id   UUID REFERENCES insumos(id) ON DELETE SET NULL,
    nome_item   VARCHAR(200) NOT NULL,
    tipo_regra  VARCHAR(30)  NOT NULL CHECK (tipo_regra IN ('Fixo', 'Por Pessoa', 'Ratio')),
    -- Fixo   → quantidade = divisor  (ex: 1 coordenador fixo)
    -- Por Pessoa → quantidade = ceil(qtd_pessoas / divisor)  (ex: 1 a cada 10 pessoas)
    -- Ratio  → quantidade = qtd_pessoas * divisor  (ex: 1.0 × qtd = kits por pessoa)
    divisor     NUMERIC(10,4) NOT NULL DEFAULT 1,
    categoria   VARCHAR(100),
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS regras_orcamento_perfil_idx ON regras_orcamento (perfil_id);
