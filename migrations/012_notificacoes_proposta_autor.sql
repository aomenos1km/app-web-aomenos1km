-- Adiciona metadados para notificacoes relacionadas a propostas e autoria
ALTER TABLE notificacoes
  ADD COLUMN IF NOT EXISTS proposta_id UUID REFERENCES propostas(id),
  ADD COLUMN IF NOT EXISTS autor_nome VARCHAR(255),
  ADD COLUMN IF NOT EXISTS autor_perfil VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_notificacoes_proposta_id ON notificacoes(proposta_id);
