-- 018_inscricoes_genero_dependentes.sql
-- Adiciona suporte para gênero/identidade, dependentes e valida duplicação de CPF

-- Adiciona coluna para gênero/identidade (opcional)
ALTER TABLE participantes
ADD COLUMN IF NOT EXISTS genero_identidade VARCHAR NULL,
ADD COLUMN IF NOT EXISTS inscricao_relacionamento VARCHAR NULL,
ADD COLUMN IF NOT EXISTS inscricao_titular_id UUID NULL;

-- Adiciona constraint de chave estrangeira para inscricao_titular_id
ALTER TABLE participantes
ADD CONSTRAINT fk_inscricao_titular 
  FOREIGN KEY (inscricao_titular_id) 
  REFERENCES participantes(id) 
  ON DELETE RESTRICT;

-- Cria índice único para evitar CPF duplicado por evento (contrato)
-- Permitirá null para campos e apenas impedirá duplicação de CPFs válidos
CREATE UNIQUE INDEX IF NOT EXISTS idx_participantes_contrato_cpf_unico
ON participantes(contrato_id, cpf)
WHERE cpf IS NOT NULL AND cpf != '';

-- Cria índice para buscar dependentes por titular
CREATE INDEX IF NOT EXISTS idx_participantes_titular
ON participantes(inscricao_titular_id);

-- Cria índice para buscar ingressos por evento e status de pagamento
CREATE INDEX IF NOT EXISTS idx_participantes_contrato_status
ON participantes(contrato_id, status_pagamento);

-- Cria índice para queries de gênero/identidade (para relatórios)
CREATE INDEX IF NOT EXISTS idx_participantes_genero
ON participantes(contrato_id, genero_identidade);

-- Cria tabela de histórico de duplicações (para auditoria)
CREATE TABLE IF NOT EXISTS inscricoes_duplicadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participante_original_id UUID NOT NULL REFERENCES participantes(id) ON DELETE CASCADE,
  participante_duplicada_id UUID NOT NULL REFERENCES participantes(id) ON DELETE CASCADE,
  cpf VARCHAR NOT NULL,
  contrato_id UUID NOT NULL,
  razao VARCHAR,
  detectado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolvido_em TIMESTAMP NULL
);

-- Índice para auditoria
CREATE INDEX IF NOT EXISTS idx_inscricoes_duplicadas_contrato
ON inscricoes_duplicadas(contrato_id, detectado_em DESC);
