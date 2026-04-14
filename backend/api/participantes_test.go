package api

import (
	"strings"
	"testing"

	"github.com/aomenos1km/app-web/models"
)

func TestMontarDescricaoCobrancaAsaasComDependentes(t *testing.T) {
	input := models.ParticipanteInput{
		Nome: "Titular Teste",
		Dependentes: []models.DependenteInput{
			{Nome: "Dependente Um", Relacionamento: "Filho", CPF: "111"},
			{Nome: "Dependente Dois", Relacionamento: "Filha", CPF: "222"},
		},
	}

	descricao := montarDescricaoCobrancaAsaas("Corrida Junina", "20/07/2026", input)

	checks := []string{
		"Evento: Corrida Junina",
		"Data Evento: 20/07/2026",
		"Qtd Ingressos: 3",
		"Participantes: Titular Teste, Dependente Um, Dependente Dois",
	}

	for _, check := range checks {
		if !strings.Contains(descricao, check) {
			t.Fatalf("descricao deveria conter %q, obtido: %q", check, descricao)
		}
	}
}

func TestMontarDescricaoCobrancaAsaasLimite500(t *testing.T) {
	input := models.ParticipanteInput{Nome: strings.Repeat("NomeMuitoGrande", 60)}
	descricao := montarDescricaoCobrancaAsaas("Evento", "01/01/2027", input)
	if len(descricao) > 500 {
		t.Fatalf("descricao deveria ter no maximo 500 caracteres, obteve %d", len(descricao))
	}
}
