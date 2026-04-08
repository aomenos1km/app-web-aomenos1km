ALTER TABLE contratos
ADD COLUMN IF NOT EXISTS comissao_status VARCHAR(20) NOT NULL DEFAULT 'Pendente',
ADD COLUMN IF NOT EXISTS comissao_data_pagamento TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS comissao_pago_por VARCHAR(255) NULL,
ADD COLUMN IF NOT EXISTS comissao_observacao TEXT NULL;

UPDATE contratos
SET comissao_status = 'Pendente'
WHERE comissao_status IS NULL OR TRIM(comissao_status) = '';
