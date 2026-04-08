//go:build ignore
// +build ignore

package main

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

func loadLocalEnv() {
	files := []string{".env.local", ".env"}
	for _, file := range files {
		content, err := os.ReadFile(file)
		if err != nil {
			continue
		}
		for _, line := range strings.Split(string(content), "\n") {
			line = strings.TrimSpace(line)
			if line == "" || strings.HasPrefix(line, "#") || !strings.Contains(line, "=") {
				continue
			}
			parts := strings.SplitN(line, "=", 2)
			key := strings.TrimSpace(parts[0])
			val := strings.Trim(strings.TrimSpace(parts[1]), "\"")
			if key != "" {
				_ = os.Setenv(key, val)
			}
		}
		return
	}
}

func main() {
	loadLocalEnv()
	dsn := os.Getenv("POSTGRES_URL")
	if dsn == "" {
		panic("POSTGRES_URL nao definida")
	}

	pool, err := pgxpool.New(context.Background(), dsn)
	if err != nil {
		panic(err)
	}
	defer pool.Close()

	tx, err := pool.Begin(context.Background())
	if err != nil {
		panic(err)
	}
	defer tx.Rollback(context.Background())

	statements := []string{
		"DELETE FROM proposta_itens",
		"DELETE FROM notificacoes WHERE proposta_id IS NOT NULL",
		"DELETE FROM propostas",
		"DELETE FROM orcamentos_publicos",
		"DELETE FROM notificacoes WHERE contrato_id IS NOT NULL",
		"DELETE FROM participantes",
		"DELETE FROM contratos",
		"DELETE FROM empresas",
		"ALTER SEQUENCE IF EXISTS participantes_numero_inscricao_seq RESTART WITH 1",
	}

	for _, sql := range statements {
		if _, err := tx.Exec(context.Background(), sql); err != nil {
			panic(err)
		}
	}

	if err := tx.Commit(context.Background()); err != nil {
		panic(err)
	}

	fmt.Println("OK: propostas, orcamentos_publicos, contratos, participantes e empresas limpos")
}
