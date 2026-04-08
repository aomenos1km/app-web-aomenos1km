package api

import (
	"context"
	"net/http"

	"github.com/aomenos1km/app-web/db"
	"github.com/aomenos1km/app-web/models"
	"github.com/gin-gonic/gin"
)

type ConfiguracaoSistema struct {
	MargemLucro          float64 `json:"margem_lucro"`
	CustoOperacionalFixo float64 `json:"custo_operacional_fixo"`
	AdicionalKitPremium  float64 `json:"adicional_kit_premium"`
	PrecoBackupCamiseta  float64 `json:"preco_backup_camiseta"`
	PrecoBackupMedalha   float64 `json:"preco_backup_medalha"`
	PrecoBackupSqueeze   float64 `json:"preco_backup_squeeze"`
	PrecoBackupBag       float64 `json:"preco_backup_bag"`
	PrecoBackupLanche    float64 `json:"preco_backup_lanche"`
	PrecoBackupTrofeu    float64 `json:"preco_backup_trofeu"`
	SetupMinimo          float64 `json:"setup_minimo"`
	LimiteSetupPessoas   int     `json:"limite_setup_pessoas"`
}

type ConfiguracaoPublicaPreco struct {
	ConfiguracaoSistema
	PrecoBasePorPessoa float64 `json:"preco_base_por_pessoa"`
}

func defaultsConfiguracao() ConfiguracaoSistema {
	return ConfiguracaoSistema{
		MargemLucro:          75,
		CustoOperacionalFixo: 5,
		AdicionalKitPremium:  40,
		PrecoBackupCamiseta:  25,
		PrecoBackupMedalha:   15,
		PrecoBackupSqueeze:   10,
		PrecoBackupBag:       12,
		PrecoBackupLanche:    15,
		PrecoBackupTrofeu:    45,
		SetupMinimo:          1200,
		LimiteSetupPessoas:   150,
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
			setup_minimo, limite_setup_pessoas
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		ON CONFLICT (id) DO NOTHING
	`, 1, d.MargemLucro, d.CustoOperacionalFixo, d.AdicionalKitPremium,
		d.PrecoBackupCamiseta, d.PrecoBackupMedalha, d.PrecoBackupSqueeze,
		d.PrecoBackupBag, d.PrecoBackupLanche, d.PrecoBackupTrofeu,
		d.SetupMinimo, d.LimiteSetupPessoas)
	return err
}

func carregarConfiguracaoSistema(ctx context.Context) (ConfiguracaoSistema, error) {
	var cfg ConfiguracaoSistema
	err := db.Pool.QueryRow(ctx, `
		SELECT
			margem_lucro, custo_operacional_fixo, adicional_kit_premium,
			preco_backup_camiseta, preco_backup_medalha, preco_backup_squeeze,
			preco_backup_bag, preco_backup_lanche, preco_backup_trofeu,
			setup_minimo, limite_setup_pessoas
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
	)
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
			atualizado_em = NOW()
		WHERE id = 1
	`, req.MargemLucro, req.CustoOperacionalFixo, req.AdicionalKitPremium,
		req.PrecoBackupCamiseta, req.PrecoBackupMedalha, req.PrecoBackupSqueeze,
		req.PrecoBackupBag, req.PrecoBackupLanche, req.PrecoBackupTrofeu,
		req.SetupMinimo, req.LimiteSetupPessoas)
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
