//go:build ignore
// +build ignore

package main

import (
	"context"
	"fmt"
	"os"
	"sort"
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

	var usuariosAntes int
	if err := tx.QueryRow(context.Background(), `SELECT COUNT(*) FROM usuarios`).Scan(&usuariosAntes); err != nil {
		panic(err)
	}

	rows, err := tx.Query(context.Background(), `
		SELECT tablename
		FROM pg_tables
		WHERE schemaname = 'public'
		  AND tablename <> 'usuarios'
		ORDER BY tablename
	`)
	if err != nil {
		panic(err)
	}
	defer rows.Close()

	tabelas := make([]string, 0)
	for rows.Next() {
		var tabela string
		if err := rows.Scan(&tabela); err != nil {
			panic(err)
		}
		tabelas = append(tabelas, tabela)
	}
	if err := rows.Err(); err != nil {
		panic(err)
	}

	if len(tabelas) == 0 {
		fmt.Println("Nenhuma tabela pública encontrada para limpar (além de usuarios)")
		return
	}

	quoted := make([]string, 0, len(tabelas))
	for _, tabela := range tabelas {
		quoted = append(quoted, fmt.Sprintf(`"%s"`, strings.ReplaceAll(tabela, `"`, `""`)))
	}
	sort.Strings(quoted)

	sql := "TRUNCATE TABLE " + strings.Join(quoted, ", ") + " RESTART IDENTITY CASCADE"
	if _, err := tx.Exec(context.Background(), sql); err != nil {
		panic(err)
	}

	var usuariosDepois int
	if err := tx.QueryRow(context.Background(), `SELECT COUNT(*) FROM usuarios`).Scan(&usuariosDepois); err != nil {
		panic(err)
	}

	var adminExiste bool
	if err := tx.QueryRow(context.Background(), `SELECT EXISTS(SELECT 1 FROM usuarios WHERE LOWER(login) = 'admin')`).Scan(&adminExiste); err != nil {
		panic(err)
	}

	if err := tx.Commit(context.Background()); err != nil {
		panic(err)
	}

	fmt.Printf("OK: banco limpo preservando usuarios. Tabelas truncadas: %d\n", len(tabelas))
	fmt.Printf("Usuarios preservados: %d -> %d\n", usuariosAntes, usuariosDepois)
	fmt.Printf("Login admin existe: %t\n", adminExiste)
}
