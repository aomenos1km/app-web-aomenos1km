-- =================================================================
-- CRM operacional: enriquecimento de interacoes e fila de pendencias
-- =================================================================

ALTER TABLE empresas_crm_interacoes
    ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS tipo_interacao VARCHAR(30) NOT NULL DEFAULT 'Anotacao',
    ADD COLUMN IF NOT EXISTS canal VARCHAR(30) NOT NULL DEFAULT 'WhatsApp',
    ADD COLUMN IF NOT EXISTS resultado VARCHAR(30) NOT NULL DEFAULT 'Sem Retorno';

CREATE TABLE IF NOT EXISTS empresas_crm_pendencias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    interacao_origem_id UUID REFERENCES empresas_crm_interacoes(id) ON DELETE SET NULL,
    responsavel_user_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    responsavel_nome VARCHAR(255) NOT NULL DEFAULT 'Consultor',
    descricao TEXT NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'Aberta',
    prioridade VARCHAR(20) NOT NULL DEFAULT 'Normal',
    data_prevista DATE NOT NULL,
    concluida_em TIMESTAMPTZ,
    concluida_por_user_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    concluida_por_nome VARCHAR(255),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_empresas_crm_pendencias_empresa ON empresas_crm_pendencias(empresa_id, status, data_prevista);
CREATE INDEX IF NOT EXISTS idx_empresas_crm_pendencias_status_data ON empresas_crm_pendencias(status, data_prevista);
CREATE INDEX IF NOT EXISTS idx_empresas_crm_pendencias_responsavel ON empresas_crm_pendencias(responsavel_user_id, status);

WITH ultimas AS (
    SELECT DISTINCT ON (empresa_id)
        id,
        empresa_id,
        usuario_id,
        usuario_nome,
        texto,
        proximo_contato,
        criado_em
    FROM empresas_crm_interacoes
    WHERE proximo_contato IS NOT NULL
    ORDER BY empresa_id, criado_em DESC
)
INSERT INTO empresas_crm_pendencias (
    empresa_id,
    interacao_origem_id,
    responsavel_user_id,
    responsavel_nome,
    descricao,
    status,
    prioridade,
    data_prevista
)
SELECT
    u.empresa_id,
    u.id,
    u.usuario_id,
    COALESCE(NULLIF(u.usuario_nome, ''), 'Consultor'),
    COALESCE(NULLIF(u.texto, ''), 'Retorno agendado.'),
    'Aberta',
    'Normal',
    u.proximo_contato
FROM ultimas u
WHERE NOT EXISTS (
    SELECT 1
    FROM empresas_crm_pendencias p
    WHERE p.empresa_id = u.empresa_id
      AND p.status = 'Aberta'
);
