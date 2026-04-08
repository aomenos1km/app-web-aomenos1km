-- =================================================================
-- Configuracoes Globais do Sistema (precificacao e backups)
-- =================================================================

CREATE TABLE IF NOT EXISTS configuracoes_sistema (
    id INTEGER PRIMARY KEY,
    margem_lucro DECIMAL(10,2) NOT NULL DEFAULT 75,
    custo_operacional_fixo DECIMAL(10,2) NOT NULL DEFAULT 5,
    adicional_kit_premium DECIMAL(10,2) NOT NULL DEFAULT 40,
    preco_backup_camiseta DECIMAL(10,2) NOT NULL DEFAULT 25,
    preco_backup_medalha DECIMAL(10,2) NOT NULL DEFAULT 15,
    preco_backup_squeeze DECIMAL(10,2) NOT NULL DEFAULT 10,
    preco_backup_bag DECIMAL(10,2) NOT NULL DEFAULT 12,
    preco_backup_lanche DECIMAL(10,2) NOT NULL DEFAULT 15,
    preco_backup_trofeu DECIMAL(10,2) NOT NULL DEFAULT 45,
    setup_minimo DECIMAL(10,2) NOT NULL DEFAULT 1200,
    limite_setup_pessoas INTEGER NOT NULL DEFAULT 150,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO configuracoes_sistema (
    id,
    margem_lucro,
    custo_operacional_fixo,
    adicional_kit_premium,
    preco_backup_camiseta,
    preco_backup_medalha,
    preco_backup_squeeze,
    preco_backup_bag,
    preco_backup_lanche,
    preco_backup_trofeu,
    setup_minimo,
    limite_setup_pessoas
)
VALUES (1, 75, 5, 40, 25, 15, 10, 12, 15, 45, 1200, 150)
ON CONFLICT (id) DO NOTHING;
