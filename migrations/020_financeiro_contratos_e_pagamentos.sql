-- 020_financeiro_contratos_e_pagamentos.sql
-- Estrutura financeira para contratos (parcelas) + parâmetros de condições de pagamento.

CREATE TABLE IF NOT EXISTS contrato_parcelas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contrato_id VARCHAR NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
    numero_parcela INTEGER NOT NULL,
    valor_previsto DECIMAL(12,2) NOT NULL,
    valor_recebido DECIMAL(12,2) NOT NULL DEFAULT 0,
    vencimento DATE NOT NULL,
    data_pagamento DATE NULL,
    forma_pagamento_esperada VARCHAR(50) NOT NULL DEFAULT 'PIX',
    forma_pagamento_realizada VARCHAR(50) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Pendente',
    observacoes TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    criado_por_user_id UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
    baixado_por_user_id UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
    CONSTRAINT uq_contrato_parcela_numero UNIQUE (contrato_id, numero_parcela)
);

CREATE INDEX IF NOT EXISTS idx_contrato_parcelas_contrato ON contrato_parcelas(contrato_id);
CREATE INDEX IF NOT EXISTS idx_contrato_parcelas_vencimento ON contrato_parcelas(vencimento);
CREATE INDEX IF NOT EXISTS idx_contrato_parcelas_status ON contrato_parcelas(status);
CREATE INDEX IF NOT EXISTS idx_contrato_parcelas_data_pagamento ON contrato_parcelas(data_pagamento);

ALTER TABLE configuracoes_sistema
    ADD COLUMN IF NOT EXISTS formas_pagamento_disponiveis TEXT NOT NULL DEFAULT 'PIX, Transferência Bancária, Cartão de Crédito, Boleto Bancário',
    ADD COLUMN IF NOT EXISTS max_parcelas_sem_juros INTEGER NOT NULL DEFAULT 3,
    ADD COLUMN IF NOT EXISTS permite_parcelamento_pix_transferencia_boleto BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS entrada_min_percent DECIMAL(5,2) NOT NULL DEFAULT 30,
    ADD COLUMN IF NOT EXISTS multa_atraso_percent DECIMAL(5,2) NOT NULL DEFAULT 2,
    ADD COLUMN IF NOT EXISTS juros_mes_percent DECIMAL(5,2) NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS texto_condicoes_pagamento TEXT NOT NULL DEFAULT '';
