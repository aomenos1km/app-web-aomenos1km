//go:build ignore
// +build ignore

package main

import (
	"context"
	"fmt"
	"os"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

var slugRegex = regexp.MustCompile(`[^a-z0-9]+`)

func slugify(value string) string {
	v := strings.ToLower(strings.TrimSpace(value))
	replacer := strings.NewReplacer(
		"á", "a", "à", "a", "â", "a", "ã", "a", "ä", "a",
		"é", "e", "è", "e", "ê", "e", "ë", "e",
		"í", "i", "ì", "i", "î", "i", "ï", "i",
		"ó", "o", "ò", "o", "ô", "o", "õ", "o", "ö", "o",
		"ú", "u", "ù", "u", "û", "u", "ü", "u",
		"ç", "c",
	)
	v = replacer.Replace(v)
	v = slugRegex.ReplaceAllString(v, "-")
	v = strings.Trim(v, "-")
	return v
}

func main() {
	dsn := os.Getenv("POSTGRES_URL")
	if dsn == "" {
		panic("POSTGRES_URL vazio")
	}

	pool, err := pgxpool.New(context.Background(), dsn)
	if err != nil {
		panic(err)
	}
	defer pool.Close()

	rows, err := pool.Query(context.Background(), `
    SELECT id, COALESCE(empresa_nome,''), COALESCE(nome_evento,''), COALESCE(descricao,''), COALESCE(status,'')
    FROM contratos
    ORDER BY criado_em DESC
    LIMIT 40
  `)
	if err != nil {
		panic(err)
	}
	defer rows.Close()

	target := "guilherme-augusto-kawashima-ruiz-goncalves-homens-run"
	fmt.Println("TARGET:", target)
	for rows.Next() {
		var id, empresa, nomeEvento, descricao, status string
		if err := rows.Scan(&id, &empresa, &nomeEvento, &descricao, &status); err != nil {
			panic(err)
		}
		s1 := slugify(strings.TrimSpace(empresa + " " + nomeEvento))
		s2 := slugify(nomeEvento)
		s3 := slugify(empresa)
		s4 := slugify(descricao)

		hit := strings.Contains(s1, target) || strings.Contains(target, s1) || strings.Contains(s2, target) || strings.Contains(target, s2)
		if hit || strings.Contains(strings.ToLower(empresa), "guilherme") || strings.Contains(strings.ToLower(nomeEvento), "homens") {
			fmt.Printf("ID=%s | ST=%s\n  EMP=%s\n  EVT=%s\n  DSC=%s\n  S1=%s\n  S2=%s\n  S3=%s\n  S4=%s\n\n", id, status, empresa, nomeEvento, descricao, s1, s2, s3, s4)
		}
	}
}
