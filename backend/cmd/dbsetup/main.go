package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load(filepath.Join("..", "..", ".env.local"))

	databaseURL := os.Getenv("POSTGRES_URL")
	if databaseURL == "" {
		log.Fatal("POSTGRES_URL não definida")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		log.Fatalf("falha ao abrir pool: %v", err)
	}
	defer pool.Close()

	files := []string{
		filepath.Join("..", "..", "..", "migrations", "001_init.sql"),
		filepath.Join("..", "..", "..", "migrations", "002_seed_usuarios.sql"),
		filepath.Join("..", "..", "..", "migrations", "003_locais_taxas.sql"),
		filepath.Join("..", "..", "..", "migrations", "004_propostas.sql"),
		filepath.Join("..", "..", "..", "migrations", "005_perfis_orcamento.sql"),
		filepath.Join("..", "..", "..", "migrations", "006_configuracoes_sistema.sql"),
		filepath.Join("..", "..", "..", "migrations", "007_usuarios_campos_adicionais.sql"),
		filepath.Join("..", "..", "..", "migrations", "008_preco_ingresso.sql"),
		filepath.Join("..", "..", "..", "migrations", "009_propostas_preco_ingresso.sql"),
		filepath.Join("..", "..", "..", "migrations", "010_orcamentos_publicos_local_cidade.sql"),
		filepath.Join("..", "..", "..", "migrations", "011_comissoes_status.sql"),
		filepath.Join("..", "..", "..", "migrations", "012_notificacoes_proposta_autor.sql"),
		filepath.Join("..", "..", "..", "migrations", "013_empresas_crm.sql"),
		filepath.Join("..", "..", "..", "migrations", "014_crm_fila_operacional.sql"),
		filepath.Join("..", "..", "..", "migrations", "015_catalogo_owner_permissions.sql"),
		filepath.Join("..", "..", "..", "migrations", "016_metas_mensais.sql"),
		filepath.Join("..", "..", "..", "migrations", "017_lista_transmissao.sql"),
	}

	for _, file := range files {
		sqlBytes, err := os.ReadFile(file)
		if err != nil {
			log.Fatalf("falha ao ler %s: %v", file, err)
		}

		if _, err := pool.Exec(ctx, string(sqlBytes)); err != nil {
			log.Fatalf("falha ao executar %s: %v", file, err)
		}

		fmt.Printf("ok: %s\n", file)
	}
}
