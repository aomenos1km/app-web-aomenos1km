//go:build ignore
// +build ignore

package main

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type participanteSeed struct {
	nome                string
	whatsapp            string
	email               string
	cpf                 string
	nascimento          string
	cidade              string
	uf                  string
	tamanhoCamiseta     string
	modalidade          string
	modalidadeDistancia string
	tempoPratica        string
	temAssessoria       string
	objetivo            string
	interesseAssessoria bool
	formatoInteresse    string
	comoConheceu        string
	observacoes         string
}

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

	var empresaID string
	var empresaNome string
	err = tx.QueryRow(context.Background(), `
    SELECT id, COALESCE(nome_fantasia, razao_social, '')
    FROM empresas
    WHERE REPLACE(REPLACE(REPLACE(LOWER(COALESCE(nome_fantasia, razao_social, '')), ' ', ''), '-', ''), '_', '') NOT LIKE '%aomenos1km%'
    ORDER BY criado_em ASC
    LIMIT 1
  `).Scan(&empresaID, &empresaNome)
	if err != nil {
		panic("nenhuma empresa nao-Aomenos1km encontrada para criar o evento de historico")
	}

	contratoID := "hist-leads-demo-20260226"
	dataEvento := "2026-02-26"
	nomeEvento := fmt.Sprintf("%s Experience Run", empresaNome)

	if _, err := tx.Exec(context.Background(), `DELETE FROM participantes WHERE contrato_id = $1`, contratoID); err != nil {
		panic(err)
	}
	if _, err := tx.Exec(context.Background(), `DELETE FROM contratos WHERE id = $1`, contratoID); err != nil {
		panic(err)
	}

	if _, err := tx.Exec(context.Background(), `
    INSERT INTO contratos (
      id, data_criacao, empresa_id, empresa_nome, descricao, valor_total, data_evento,
      local_nome, modalidade, qtd_contratada, qtd_kit, km, status, valor_pago,
      consultor, possui_kit, tipo_kit, nome_evento, observacoes
    ) VALUES (
      $1, $2, $3, $4, $5, 0, $6,
      $7, 'Corrida', 120, 0, '5km e 10km', 'Finalizado', 0,
      'Administrador', false, '', $8, $9
    )
  `, contratoID, dataEvento, empresaID, empresaNome, "Evento demonstrativo para Histórico & Leads", dataEvento, "Parque Linear Bruno Covas", nomeEvento, "Seed temporário para visualização do módulo Histórico & Leads"); err != nil {
		panic(err)
	}

	participantesSeed := []participanteSeed{
		{"Adrieli Medeiros Mendes", "(75) 99704-9077", "adriellymedeiros1703@gmail.com", "12345678901", "2002-03-17", "São Paulo", "SP", "M", "Corrida", "Caminhada ou 3 Km", "6 meses a 1 ano", "Não", "Ganhar condicionamento", true, "Online", "Instagram", "Lead quente do evento corporativo"},
		{"Amanda Lima Oliveira", "(11) 95973-9402", "amandalima.econ@gmail.com", "12345678902", "1990-07-27", "São Paulo", "SP", "P", "Corrida", "Corrida 10 Km", "Mais de 2 anos", "Sim", "Melhorar performance", false, "", "Indicação", ""},
		{"Bruna Ferreira de Sousa", "(11) 98080-9361", "bruna.sousa5@icloud.com", "12345678903", "1999-05-09", "São Paulo", "SP", "M", "Corrida", "Corrida 5 Km", "1 a 2 anos", "Não", "Voltar a treinar", true, "Presencial", "Instagram", "Quer entender planos de assessoria"},
		{"Cleide Lima", "(11) 98413-4100", "lcleide929@gmail.com", "12345678904", "1979-12-12", "São Paulo", "SP", "G", "Corrida", "Corrida 5 Km", "Mais de 2 anos", "Sim", "Preparar prova alvo", false, "", "Outros", ""},
		{"Crislene Diniz Ribeiro Britto", "(11) 98308-4351", "crislene.gs@hotmail.com", "12345678905", "1989-05-09", "São Paulo", "SP", "M", "Corrida", "Corrida 5 Km", "1 a 2 anos", "Não", "Saúde e bem-estar", true, "Híbrido", "Indicação", "Perfil com bom potencial de conversão"},
		{"Debora Santos da Silva Caldas", "(11) 91044-0145", "santosdebi@yahoo.com.br", "12345678906", "1989-07-06", "São Pedro", "SP", "GG", "Corrida", "Corrida 10 Km", "Mais de 2 anos", "Não", "Emagrecimento", false, "", "Outros", ""},
		{"Elineide Oliveira Vieira", "(11) 98179-6036", "elineide.vieira@outlook.com", "12345678907", "1973-11-09", "São Paulo", "SP", "M", "Corrida", "Corrida 5 Km", "6 meses a 1 ano", "Não", "Criar rotina", true, "Online", "Instagram", ""},
		{"Elizane Santos da Silva", "(11) 98508-5382", "santosellen148@gmail.com", "12345678908", "1975-10-19", "São Paulo", "SP", "P", "Corrida", "Corrida 10 Km", "Mais de 2 anos", "Sim", "Performance", false, "", "Indicação", ""},
		{"Fabiana Rocha Mendes", "(11) 97654-8899", "fabiana.rocha@email.com", "12345678909", "1993-08-11", "Guarulhos", "SP", "M", "Corrida", "Caminhada ou 3 Km", "Até 6 meses", "Não", "Começar a correr", true, "Presencial", "Instagram", "Primeira experiência com evento esportivo"},
		{"Juliana Costa Freitas", "(11) 98877-6644", "juliana.freitas@email.com", "12345678910", "1987-01-22", "Santo André", "SP", "G", "Corrida", "Corrida 5 Km", "1 a 2 anos", "Não", "Retomar condicionamento", false, "", "Outros", ""},
	}

	for index, participante := range participantesSeed {
		inscricao := time.Date(2026, 2, 1+index, 10, 0, 0, 0, time.UTC)
		if _, err := tx.Exec(context.Background(), `
      INSERT INTO participantes (
        contrato_id, nome, whatsapp, email, tamanho_camiseta, modalidade,
        data_inscricao, cpf, nascimento, cidade, modalidade_distancia, tempo_pratica,
        tem_assessoria, objetivo, apto_fisico, termo_responsabilidade, uso_imagem,
        interesse_assessoria, formato_interesse, como_conheceu, observacoes, uf, status_pagamento
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12,
        $13, $14, true, true, true,
        $15, $16, $17, $18, $19, 'Confirmado'
      )
    `,
			contratoID,
			participante.nome,
			participante.whatsapp,
			participante.email,
			participante.tamanhoCamiseta,
			participante.modalidade,
			inscricao,
			participante.cpf,
			participante.nascimento,
			participante.cidade,
			participante.modalidadeDistancia,
			participante.tempoPratica,
			participante.temAssessoria,
			participante.objetivo,
			participante.interesseAssessoria,
			participante.formatoInteresse,
			participante.comoConheceu,
			participante.observacoes,
			participante.uf,
		); err != nil {
			panic(err)
		}
	}

	if err := tx.Commit(context.Background()); err != nil {
		panic(err)
	}

	fmt.Printf("OK: evento passado criado para Histórico & Leads\nEmpresa: %s\nContrato: %s\nParticipantes: %d\n", empresaNome, contratoID, len(participantesSeed))
}
