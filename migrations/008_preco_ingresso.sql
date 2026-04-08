-- Migration 008: Adiciona campo preco_ingresso na tabela contratos
-- Este campo armazena o valor do ingresso por pessoa para eventos pagos.
-- É derivado automaticamente do gerador de orçamentos (totalGeral / qtdPessoas)
-- e nunca digitado manualmente.

ALTER TABLE contratos
  ADD COLUMN IF NOT EXISTS preco_ingresso NUMERIC(10,2) DEFAULT NULL;

COMMENT ON COLUMN contratos.preco_ingresso IS
  'Valor do ingresso por participante (R$). Derivado do gerador de orçamentos. NULL = evento gratuito.';
