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

	checks := []string{
		"empresas",
		"contratos",
		"participantes",
		"propostas",
		"orcamentos_publicos",
		"notificacoes",
		"empresas_crm_interacoes",
		"empresas_crm_pendencias",
		"contrato_parcelas",
		"lista_transmissao",
		"metas_mensais",
	}

	for _, tabela := range checks {
		var count int
		if err := pool.QueryRow(context.Background(), fmt.Sprintf("SELECT COUNT(*) FROM %s", tabela)).Scan(&count); err != nil {
			panic(err)
		}
		fmt.Printf("%s=%d\n", tabela, count)
	}

	var usuarios int
	var adminExists bool
	if err := pool.QueryRow(context.Background(), "SELECT COUNT(*) FROM usuarios").Scan(&usuarios); err != nil {
		panic(err)
	}
	if err := pool.QueryRow(context.Background(), "SELECT EXISTS(SELECT 1 FROM usuarios WHERE LOWER(login) = 'admin')").Scan(&adminExists); err != nil {
		panic(err)
	}

	fmt.Printf("usuarios=%d\n", usuarios)
	fmt.Printf("admin_exists=%t\n", adminExists)
}
