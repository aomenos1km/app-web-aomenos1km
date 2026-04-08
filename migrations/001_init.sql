-- =================================================================
-- AOMENOS1KM — Schema Inicial PostgreSQL
-- Migrado da estrutura Google Sheets original
-- =================================================================

-- Extensão para UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =================================================================
-- TABELA: usuarios
-- Autenticação interna do painel admin
-- =================================================================
CREATE TABLE IF NOT EXISTS usuarios (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome        VARCHAR(255) NOT NULL,
    login       VARCHAR(100) NOT NULL UNIQUE,
    email       VARCHAR(255),
    senha_hash  VARCHAR(255) NOT NULL,
    perfil      VARCHAR(50)  NOT NULL DEFAULT 'Consultor', -- Admin | Consultor | Visualizador
    ativo       BOOLEAN      NOT NULL DEFAULT true,
    comissao_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
    criado_em   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =================================================================
-- TABELA: empresas
-- Clientes PJ e PF (antigo DB_Empresas)
-- =================================================================
CREATE TABLE IF NOT EXISTS empresas (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    data_cadastro   DATE,
    documento       VARCHAR(20),        -- CNPJ ou CPF
    razao_social    VARCHAR(255) NOT NULL,
    nome_fantasia   VARCHAR(255),
    responsavel     VARCHAR(255),
    telefone        VARCHAR(30),
    email           VARCHAR(255),
    endereco        TEXT,
    logradouro      VARCHAR(255),
    numero          VARCHAR(20),
    complemento     VARCHAR(100),
    bairro          VARCHAR(100),
    cidade          VARCHAR(100),
    uf              CHAR(2),
    cep             VARCHAR(10),
    tipo_pessoa     VARCHAR(2) NOT NULL DEFAULT 'PJ',  -- PJ | PF
    status          VARCHAR(20) NOT NULL DEFAULT 'Ativo', -- Ativo | Lead | Inativo
    observacoes     TEXT,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_empresas_documento   ON empresas(documento);
CREATE INDEX IF NOT EXISTS idx_empresas_status      ON empresas(status);
CREATE INDEX IF NOT EXISTS idx_empresas_tipo_pessoa ON empresas(tipo_pessoa);

-- =================================================================
-- TABELA: locais
-- Locais e parques de eventos (antigo DB_Locais)
-- =================================================================
CREATE TABLE IF NOT EXISTS locais (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo      VARCHAR(50) UNIQUE,
    nome        VARCHAR(255) NOT NULL,
    tipo        VARCHAR(50),   -- Parque | Praça | Corpo Deágua | etc.
    logradouro  VARCHAR(255),
    numero      VARCHAR(20),
    complemento VARCHAR(100),
    bairro      VARCHAR(100),
    cidade      VARCHAR(100),
    uf          CHAR(2),
    cep         VARCHAR(10),
    latitude    DECIMAL(10,8),
    longitude   DECIMAL(11,8),
    observacoes TEXT,
    ativo       BOOLEAN NOT NULL DEFAULT true,
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_locais_cidade ON locais(cidade);
CREATE INDEX IF NOT EXISTS idx_locais_ativo  ON locais(ativo);

-- =================================================================
-- TABELA: insumos
-- Produtos e serviços para orçamentos (antigo DB_Insumos)
-- =================================================================
CREATE TABLE IF NOT EXISTS insumos (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome            VARCHAR(255) NOT NULL,
    categoria       VARCHAR(100),
    descricao       TEXT,
    preco_unitario  DECIMAL(10,2) NOT NULL DEFAULT 0,
    unidade         VARCHAR(20) DEFAULT 'unidade',  -- unidade | hora | evento | etc.
    ativo           BOOLEAN NOT NULL DEFAULT true,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insumos_categoria ON insumos(categoria);

-- =================================================================
-- TABELA: parceiros
-- Staff e parceiros (antigo DB_Parceiros)
-- =================================================================
CREATE TABLE IF NOT EXISTS parceiros (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome            VARCHAR(255) NOT NULL,
    especialidade   VARCHAR(100),
    email           VARCHAR(255),
    whatsapp        VARCHAR(30),
    cpf             VARCHAR(14),
    valor_hora      DECIMAL(10,2),
    status          VARCHAR(20) NOT NULL DEFAULT 'Ativo',
    observacoes     TEXT,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =================================================================
-- TABELA: fornecedores
-- Fornecedores externos (antigo DB_Fornecedores)
-- =================================================================
CREATE TABLE IF NOT EXISTS fornecedores (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome            VARCHAR(255) NOT NULL,
    especialidade   VARCHAR(100),
    email           VARCHAR(255),
    whatsapp        VARCHAR(30),
    documento       VARCHAR(20),
    valor_referencia DECIMAL(10,2),
    status          VARCHAR(20) NOT NULL DEFAULT 'Ativo',
    observacoes     TEXT,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =================================================================
-- TABELA: contratos
-- Eventos / Contratos (antigo DB_Contratos — tabela central)
-- Colunas mapeadas dos índices do Google Sheets
-- =================================================================
CREATE TABLE IF NOT EXISTS contratos (
    id                  VARCHAR(50)  PRIMARY KEY,           -- Col A
    data_criacao        DATE,                               -- Col B
    empresa_id          UUID REFERENCES empresas(id),       -- FK -> empresas
    empresa_nome        VARCHAR(255),                       -- Col C (desnormalizado para performance)
    descricao           TEXT,                               -- Col D
    valor_total         DECIMAL(12,2) NOT NULL DEFAULT 0,   -- Col E
    data_evento         DATE,                               -- Col F
    local_id            UUID REFERENCES locais(id),         -- FK -> locais
    local_nome          VARCHAR(255),                       -- Col G (desnormalizado)
    modalidade          VARCHAR(50),                        -- Col H (caminhada | corrida | mista)
    qtd_contratada      INTEGER NOT NULL DEFAULT 0,         -- Col I
    qtd_kit             INTEGER DEFAULT 0,                  -- Col J
    km                  VARCHAR(20),                        -- Col K (ex: "5km", "10km")
    status              VARCHAR(50) NOT NULL DEFAULT 'Lead', -- Col L (Lead | Proposta Enviada | Negociação | Fechado | Cancelado | Finalizado)
    valor_pago          DECIMAL(12,2) DEFAULT 0,            -- Col M
    data_pagamento      DATE,                               -- Col N
    consultor           VARCHAR(255),                       -- Col O
    possui_kit          BOOLEAN DEFAULT false,              -- Col P
    tipo_kit            VARCHAR(100),                       -- Col Q
    link_gateway        TEXT,                               -- Col R (link pagamento externo)
    qr_code_pix         TEXT,                               -- Col S (imagem QR code)
    nome_evento         VARCHAR(255),                       -- Col T (nome customizado do evento)
    capa_url            TEXT,                               -- Col U (imagem capa no Cloudinary)
    observacoes         TEXT,                               -- Col V
    pix_copia_cola      TEXT,                               -- Col W (código PIX copia e cola)
    criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contratos_empresa_id  ON contratos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_contratos_data_evento ON contratos(data_evento);
CREATE INDEX IF NOT EXISTS idx_contratos_status      ON contratos(status);
CREATE INDEX IF NOT EXISTS idx_contratos_consultor   ON contratos(consultor);

-- =================================================================
-- TABELA: participantes
-- Inscritos em eventos (antigo DB_Participantes)
-- =================================================================
CREATE TABLE IF NOT EXISTS participantes (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Col A
    contrato_id         VARCHAR(50) NOT NULL REFERENCES contratos(id) ON DELETE CASCADE, -- Col B
    nome                VARCHAR(255) NOT NULL,   -- Col C
    whatsapp            VARCHAR(30),             -- Col D
    email               VARCHAR(255),            -- Col E
    tamanho_camiseta    VARCHAR(5),              -- Col F (PP, P, M, G, GG, XGG)
    modalidade          VARCHAR(50),             -- Col G (caminhada | corrida)
    data_inscricao      TIMESTAMPTZ DEFAULT NOW(), -- Col H
    cpf                 VARCHAR(14),             -- Col I
    nascimento          DATE,                    -- Col J
    cidade              VARCHAR(100),            -- Col K
    modalidade_distancia VARCHAR(20),            -- Col L (5km, 10km, etc.)
    tempo_pratica       VARCHAR(50),             -- Col M
    tem_assessoria      VARCHAR(50),             -- Col N
    objetivo            TEXT,                    -- Col O
    apto_fisico         BOOLEAN DEFAULT true,    -- Col P
    termo_responsabilidade BOOLEAN DEFAULT false, -- Col Q
    uso_imagem          BOOLEAN DEFAULT false,   -- Col R
    interesse_assessoria BOOLEAN DEFAULT false,  -- Col S
    formato_interesse   VARCHAR(100),            -- Col T
    como_conheceu       VARCHAR(100),            -- Col U
    observacoes         TEXT,                    -- Col V
    uf                  CHAR(2),                 -- Col W
    comprovante_url     TEXT,                    -- Col X (imagem Cloudinary)
    status_pagamento    VARCHAR(20) DEFAULT 'Pendente', -- Pendente | Confirmado | Isento
    numero_kit          INTEGER,                 -- número do kit atribuído
    criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_participantes_contrato_id ON participantes(contrato_id);
CREATE INDEX IF NOT EXISTS idx_participantes_cpf         ON participantes(cpf);
CREATE INDEX IF NOT EXISTS idx_participantes_email       ON participantes(email);
CREATE INDEX IF NOT EXISTS idx_participantes_status_pgto ON participantes(status_pagamento);

-- =================================================================
-- TABELA: notificacoes
-- Alertas internos do sistema (antigo DB_Notificacoes)
-- =================================================================
CREATE TABLE IF NOT EXISTS notificacoes (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    titulo      VARCHAR(255) NOT NULL,
    mensagem    TEXT NOT NULL,
    tipo        VARCHAR(30) DEFAULT 'info',  -- info | warning | success | danger
    lida        BOOLEAN NOT NULL DEFAULT false,
    usuario_id  UUID REFERENCES usuarios(id),
    contrato_id VARCHAR(50) REFERENCES contratos(id),
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notificacoes_lida      ON notificacoes(lida);
CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario   ON notificacoes(usuario_id);

-- =================================================================
-- TABELA: orcamentos_publicos
-- Formulários de orçamento enviados pelo formulário público
-- =================================================================
CREATE TABLE IF NOT EXISTS orcamentos_publicos (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_nome    VARCHAR(255) NOT NULL,
    responsavel     VARCHAR(255),
    email           VARCHAR(255),
    telefone        VARCHAR(30),
    data_interesse  DATE,
    modalidade      VARCHAR(50),
    qtd_participantes INTEGER,
    km              VARCHAR(20),
    possui_kit      BOOLEAN DEFAULT false,
    mensagem        TEXT,
    status          VARCHAR(30) DEFAULT 'Novo',  -- Novo | Em Análise | Convertido
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =================================================================
-- FUNCTION: updated_at trigger
-- =================================================================
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger em todas as tabelas com atualizado_em
DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['usuarios', 'empresas', 'insumos', 'contratos', 'participantes']
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS set_timestamp ON %I;
            CREATE TRIGGER set_timestamp
            BEFORE UPDATE ON %I
            FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
        ', t, t);
    END LOOP;
END;
$$ LANGUAGE plpgsql;
