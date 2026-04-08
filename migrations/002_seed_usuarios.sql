-- =================================================================
-- Seed: Usuários iniciais do sistema
-- IMPORTANTE: Alterar as senhas após o primeiro deploy!
-- As senhas abaixo são hashes bcrypt de "admin123" e "consul123"
-- =================================================================

INSERT INTO usuarios (id, nome, login, senha_hash, perfil, ativo)
VALUES
    (
        uuid_generate_v4(),
        'Administrador',
        'admin',
        '$2a$10$VJQJAF798CA4ylzVxAkYEe7FgtKX4XiLCdLX8wVzDwVAX3QtsrIFq', -- admin123
        'Admin',
        true
    ),
    (
        uuid_generate_v4(),
        'Consultor Demo',
        'consultor',
        '$2a$10$FakUBgDencguPSkM.qV8wezRy6HAw51w1UHIhxTvE0q11VofoCHqe', -- consul123
        'Consultor',
        true
    )
ON CONFLICT (login) DO UPDATE
SET
    nome = EXCLUDED.nome,
    senha_hash = EXCLUDED.senha_hash,
    perfil = EXCLUDED.perfil,
    ativo = EXCLUDED.ativo;
