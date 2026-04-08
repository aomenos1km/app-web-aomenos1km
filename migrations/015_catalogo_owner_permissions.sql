-- Permissoes de propriedade para catalogos editaveis por consultor
ALTER TABLE insumos
    ADD COLUMN IF NOT EXISTS criado_por_user_id UUID REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE locais
    ADD COLUMN IF NOT EXISTS criado_por_user_id UUID REFERENCES usuarios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_insumos_criado_por_user_id ON insumos(criado_por_user_id);
CREATE INDEX IF NOT EXISTS idx_locais_criado_por_user_id ON locais(criado_por_user_id);
