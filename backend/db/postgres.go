package db

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
)

var Pool *pgxpool.Pool

// Connect inicializa o pool de conexões com o Postgres
func Connect() error {
	dsn := os.Getenv("POSTGRES_URL")
	if dsn == "" {
		return fmt.Errorf("variável POSTGRES_URL não definida")
	}

	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return fmt.Errorf("erro ao parsear CONFIG do banco: %w", err)
	}

	pool, err := pgxpool.NewWithConfig(context.Background(), config)
	if err != nil {
		return fmt.Errorf("erro ao conectar ao banco: %w", err)
	}

	// Valida conexão
	if err := pool.Ping(context.Background()); err != nil {
		return fmt.Errorf("banco não respondeu ao ping: %w", err)
	}

	Pool = pool
	log.Println("✅ Conectado ao PostgreSQL com sucesso")
	return nil
}

// Close fecha o pool de conexões
func Close() {
	if Pool != nil {
		Pool.Close()
		log.Println("🔌 Conexão com PostgreSQL encerrada")
	}
}
