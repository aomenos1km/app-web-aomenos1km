package api

import (
	"context"
	"net/http"
	"strings"

	"github.com/aomenos1km/app-web/db"
	"github.com/aomenos1km/app-web/models"
	"github.com/gin-gonic/gin"
)

type ConfiguracaoSistema struct {
	MargemLucro                               float64  `json:"margem_lucro"`
	CustoOperacionalFixo                      float64  `json:"custo_operacional_fixo"`
	AdicionalKitPremium                       float64  `json:"adicional_kit_premium"`
	PrecoBackupCamiseta                       float64  `json:"preco_backup_camiseta"`
	PrecoBackupMedalha                        float64  `json:"preco_backup_medalha"`
	PrecoBackupSqueeze                        float64  `json:"preco_backup_squeeze"`
	PrecoBackupBag                            float64  `json:"preco_backup_bag"`
	PrecoBackupLanche                         float64  `json:"preco_backup_lanche"`
	PrecoBackupTrofeu                         float64  `json:"preco_backup_trofeu"`
	SetupMinimo                               float64  `json:"setup_minimo"`
	LimiteSetupPessoas                        int      `json:"limite_setup_pessoas"`
	FormasPagamentoDisponiveis                []string `json:"formas_pagamento_disponiveis"`
	MaxParcelasSemJuros                       int      `json:"max_parcelas_sem_juros"`
	PermiteParcelamentoPixTransferenciaBoleto bool     `json:"permite_parcelamento_pix_transferencia_boleto"`
	EntradaMinPercent                         float64  `json:"entrada_min_percent"`
	MultaAtrasoPercent                        float64  `json:"multa_atraso_percent"`
	JurosMesPercent                           float64  `json:"juros_mes_percent"`
	TextoCondicoesPagamento                   string   `json:"texto_condicoes_pagamento"`
}

type ConfiguracaoPublicaPreco struct {
	ConfiguracaoSistema
	PrecoBasePorPessoa float64 `json:"preco_base_por_pessoa"`
}

func parseFormasPagamento(raw string) []string {
	items := strings.Split(raw, ",")
	out := make([]string, 0, len(items))
	for _, item := range items {
		v := strings.TrimSpace(item)
		if v != "" {
			out = append(out, v)
		}
	}
	if len(out) == 0 {
		return []string{"PIX", "Transferência", "Boleto", "Cartão"}
	}
	return out
}

func joinFormasPagamento(items []string) string {
	if len(items) == 0 {
		return "PIX, Transferência, Boleto, Cartão"
	}
	normalized := make([]string, 0, len(items))
	for _, item := range items {
		v := strings.TrimSpace(item)
		if v != "" {
			normalized = append(normalized, v)
		}
	}
	if len(normalized) == 0 {
		return "PIX, Transferência, Boleto, Cartão"
	}
	return strings.Join(normalized, ", ")
}

func defaultsConfiguracao() ConfiguracaoSistema {
	return ConfiguracaoSistema{
		MargemLucro:                               75,
		CustoOperacionalFixo:                      5,
		AdicionalKitPremium:                       40,
		PrecoBackupCamiseta:                       25,
		PrecoBackupMedalha:                        15,
		PrecoBackupSqueeze:                        10,
		PrecoBackupBag:                            12,
		PrecoBackupLanche:                         15,
		PrecoBackupTrofeu:                         45,
		SetupMinimo:                               1200,
		LimiteSetupPessoas:                        150,
		FormasPagamentoDisponiveis:                []string{"PIX", "Transferência", "Boleto", "Cartão"},
		MaxParcelasSemJuros:                       3,
		PermiteParcelamentoPixTransferenciaBoleto: false,
		EntradaMinPercent:                         30,
		MultaAtrasoPercent:                        2,
		JurosMesPercent:                           1,
		TextoCondicoesPagamento:                   "Entrada mínima de 30% na assinatura e saldo até a data do evento.",
	}
}

func ensureConfiguracaoSistema(ctx context.Context) error {
	_, err := db.Pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS configuracoes_sistema (
			id INTEGER PRIMARY KEY,
			margem_lucro DECIMAL(10,2) NOT NULL DEFAULT 75,
			custo_operacional_fixo DECIMAL(10,2) NOT NULL DEFAULT 5,
			adicional_kit_premium DECIMAL(10,2) NOT NULL DEFAULT 40,
			preco_backup_camiseta DECIMAL(10,2) NOT NULL DEFAULT 25,
			preco_backup_medalha DECIMAL(10,2) NOT NULL DEFAULT 15,
			preco_backup_squeeze DECIMAL(10,2) NOT NULL DEFAULT 10,
			preco_backup_bag DECIMAL(10,2) NOT NULL DEFAULT 12,
			preco_backup_lanche DECIMAL(10,2) NOT NULL DEFAULT 15,
			preco_backup_trofeu DECIMAL(10,2) NOT NULL DEFAULT 45,
			setup_minimo DECIMAL(10,2) NOT NULL DEFAULT 1200,
			limite_setup_pessoas INTEGER NOT NULL DEFAULT 150,
			atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)
	if err != nil {
		return err
	}

	d := defaultsConfiguracao()
	_, err = db.Pool.Exec(ctx, `
		INSERT INTO configuracoes_sistema (
			id, margem_lucro, custo_operacional_fixo, adicional_kit_premium,
			preco_backup_camiseta, preco_backup_medalha, preco_backup_squeeze,
			preco_backup_bag, preco_backup_lanche, preco_backup_trofeu,
			setup_minimo, limite_setup_pessoas,
			formas_pagamento_disponiveis, max_parcelas_sem_juros,
			permite_parcelamento_pix_transferencia_boleto, entrada_min_percent,
			multa_atraso_percent, juros_mes_percent, texto_condicoes_pagamento
		) VALUES (
			$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
			$13,$14,$15,$16,$17,$18,$19
		)
		ON CONFLICT (id) DO NOTHING
	`, 1, d.MargemLucro, d.CustoOperacionalFixo, d.AdicionalKitPremium,
		d.PrecoBackupCamiseta, d.PrecoBackupMedalha, d.PrecoBackupSqueeze,
		d.PrecoBackupBag, d.PrecoBackupLanche, d.PrecoBackupTrofeu,
		d.SetupMinimo, d.LimiteSetupPessoas,
		joinFormasPagamento(d.FormasPagamentoDisponiveis), d.MaxParcelasSemJuros,
		d.PermiteParcelamentoPixTransferenciaBoleto, d.EntradaMinPercent,
		d.MultaAtrasoPercent, d.JurosMesPercent, d.TextoCondicoesPagamento)
	return err
}

func carregarConfiguracaoSistema(ctx context.Context) (ConfiguracaoSistema, error) {
	var cfg ConfiguracaoSistema
	var formasPagamentoRaw string
	err := db.Pool.QueryRow(ctx, `
		SELECT
			margem_lucro, custo_operacional_fixo, adicional_kit_premium,
			preco_backup_camiseta, preco_backup_medalha, preco_backup_squeeze,
			preco_backup_bag, preco_backup_lanche, preco_backup_trofeu,
			setup_minimo, limite_setup_pessoas,
			COALESCE(formas_pagamento_disponiveis, ''),
			COALESCE(max_parcelas_sem_juros, 3),
			COALESCE(permite_parcelamento_pix_transferencia_boleto, false),
			COALESCE(entrada_min_percent, 0),
			COALESCE(multa_atraso_percent, 0),
			COALESCE(juros_mes_percent, 0),
			COALESCE(texto_condicoes_pagamento, '')
		FROM configuracoes_sistema
		WHERE id = 1
	`).Scan(
		&cfg.MargemLucro,
		&cfg.CustoOperacionalFixo,
		&cfg.AdicionalKitPremium,
		&cfg.PrecoBackupCamiseta,
		&cfg.PrecoBackupMedalha,
		&cfg.PrecoBackupSqueeze,
		&cfg.PrecoBackupBag,
		&cfg.PrecoBackupLanche,
		&cfg.PrecoBackupTrofeu,
		&cfg.SetupMinimo,
		&cfg.LimiteSetupPessoas,
		&formasPagamentoRaw,
		&cfg.MaxParcelasSemJuros,
		&cfg.PermiteParcelamentoPixTransferenciaBoleto,
		&cfg.EntradaMinPercent,
		&cfg.MultaAtrasoPercent,
		&cfg.JurosMesPercent,
		&cfg.TextoCondicoesPagamento,
	)
	cfg.FormasPagamentoDisponiveis = parseFormasPagamento(formasPagamentoRaw)
	return cfg, err
}

// BuscarConfiguracoesSistema retorna as regras globais da tela Configurações.
func BuscarConfiguracoesSistema(c *gin.Context) {
	if err := ensureConfiguracaoSistema(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Erro ao preparar configurações"})
		return
	}

	cfg, err := carregarConfiguracaoSistema(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Erro ao buscar configurações"})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: cfg})
}

// SalvarConfiguracoesSistema atualiza os parâmetros globais de precificação.
func SalvarConfiguracoesSistema(c *gin.Context) {
	var req ConfiguracaoSistema
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Dados inválidos: " + err.Error()})
		return
	}

	if req.LimiteSetupPessoas < 1 {
		req.LimiteSetupPessoas = 1
	}
	if req.MaxParcelasSemJuros < 1 {
		req.MaxParcelasSemJuros = 1
	}

	if err := ensureConfiguracaoSistema(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Erro ao preparar configurações"})
		return
	}

	_, err := db.Pool.Exec(c.Request.Context(), `
		UPDATE configuracoes_sistema
		SET
			margem_lucro = $1,
			custo_operacional_fixo = $2,
			adicional_kit_premium = $3,
			preco_backup_camiseta = $4,
			preco_backup_medalha = $5,
			preco_backup_squeeze = $6,
			preco_backup_bag = $7,
			preco_backup_lanche = $8,
			preco_backup_trofeu = $9,
			setup_minimo = $10,
			limite_setup_pessoas = $11,
			formas_pagamento_disponiveis = $12,
			max_parcelas_sem_juros = $13,
			permite_parcelamento_pix_transferencia_boleto = $14,
			entrada_min_percent = $15,
			multa_atraso_percent = $16,
			juros_mes_percent = $17,
			texto_condicoes_pagamento = $18,
			atualizado_em = NOW()
		WHERE id = 1
	`, req.MargemLucro, req.CustoOperacionalFixo, req.AdicionalKitPremium,
		req.PrecoBackupCamiseta, req.PrecoBackupMedalha, req.PrecoBackupSqueeze,
		req.PrecoBackupBag, req.PrecoBackupLanche, req.PrecoBackupTrofeu,
		req.SetupMinimo, req.LimiteSetupPessoas,
		joinFormasPagamento(req.FormasPagamentoDisponiveis), req.MaxParcelasSemJuros,
		req.PermiteParcelamentoPixTransferenciaBoleto, req.EntradaMinPercent,
		req.MultaAtrasoPercent, req.JurosMesPercent, req.TextoCondicoesPagamento)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Erro ao salvar configurações"})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Message: "Configurações salvas com sucesso"})
}

func precoInsumoOuBackup(mapa map[string]float64, nomes []string, backup float64) float64 {
	for _, nome := range nomes {
		if v, ok := mapa[nome]; ok && v > 0 {
			return v
		}
	}
	return backup
}

// BuscarPrecoPublico calcula preço-base por pessoa com config global + insumos.
func BuscarPrecoPublico(c *gin.Context) {
	if err := ensureConfiguracaoSistema(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Erro ao preparar configurações"})
		return
	}

	cfg, err := carregarConfiguracaoSistema(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Erro ao buscar configurações"})
		return
	}

	rows, err := db.Pool.Query(c.Request.Context(), `SELECT LOWER(nome), preco_unitario FROM insumos WHERE ativo = true`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Erro ao ler insumos"})
		return
	}
	defer rows.Close()

	mapaInsumos := map[string]float64{}
	for rows.Next() {
		var nome string
		var preco float64
		if err := rows.Scan(&nome, &preco); err != nil {
			continue
		}
		mapaInsumos[nome] = preco
	}

	camiseta := precoInsumoOuBackup(mapaInsumos, []string{"camiseta tech", "camiseta"}, cfg.PrecoBackupCamiseta)
	medalha := precoInsumoOuBackup(mapaInsumos, []string{"medalha"}, cfg.PrecoBackupMedalha)
	squeeze := precoInsumoOuBackup(mapaInsumos, []string{"squeeze"}, cfg.PrecoBackupSqueeze)
	bag := precoInsumoOuBackup(mapaInsumos, []string{"bag esportiva", "bag"}, cfg.PrecoBackupBag)
	lanche := precoInsumoOuBackup(mapaInsumos, []string{"kit snacks", "kit lanche"}, cfg.PrecoBackupLanche)

	kitBase := camiseta + medalha + squeeze + bag + lanche
	baseCalculo := kitBase + cfg.CustoOperacionalFixo
	precoBase := baseCalculo * (1 + (cfg.MargemLucro / 100))

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data: ConfiguracaoPublicaPreco{
			ConfiguracaoSistema: cfg,
			PrecoBasePorPessoa:  precoBase,
		},
	})
}
