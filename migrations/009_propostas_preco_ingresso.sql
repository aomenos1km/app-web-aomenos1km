-- Migration 009: Adiciona preco_ingresso em propostas
-- Valor derivado do gerador para propagação no contrato/check-in.

ALTER TABLE propostas
  ADD COLUMN IF NOT EXISTS preco_ingresso NUMERIC(10,2) DEFAULT NULL;

COMMENT ON COLUMN propostas.preco_ingresso IS
  'Preço do ingresso por participante (R$), calculado no gerador de orçamentos.';
