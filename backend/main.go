package main

import (
	"log"
	"os"
	"strings"

	"github.com/aomenos1km/app-web/api"
	"github.com/aomenos1km/app-web/db"
	"github.com/aomenos1km/app-web/middleware"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
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
			val := strings.TrimSpace(parts[1])
			val = strings.Trim(val, "\"")
			if key != "" {
				_ = os.Setenv(key, val)
			}
		}
		return
	}
}

func allowedOriginsFromEnv() []string {
	origins := []string{"http://localhost:3000", "http://127.0.0.1:3000"}

	if single := strings.TrimSpace(os.Getenv("FRONTEND_URL")); single != "" {
		origins = append(origins, single)
	}

	for _, raw := range strings.Split(os.Getenv("FRONTEND_URLS"), ",") {
		origin := strings.TrimSpace(raw)
		if origin != "" {
			origins = append(origins, origin)
		}
	}

	return origins
}

func isAllowedOrigin(origin string, allowed []string) bool {
	origin = strings.TrimSpace(origin)
	if origin == "" {
		return false
	}

	for _, candidate := range allowed {
		if origin == candidate {
			return true
		}
	}

	// Aceita previews da Vercel do projeto (URLs mudam a cada deploy)
	if strings.HasPrefix(origin, "https://app-web-aomenos1km") && strings.HasSuffix(origin, ".vercel.app") {
		return true
	}

	return false
}

func main() {
	loadLocalEnv()

	// Carrega .env.local em desenvolvimento
	if err := godotenv.Load(".env.local"); err != nil {
		log.Println("⚠️  .env.local não encontrado, usando variáveis do sistema")
	}

	// Conecta ao banco de dados
	if err := db.Connect(); err != nil {
		log.Fatalf("❌ Falha ao conectar ao banco: %v", err)
	}
	defer db.Close()

	// Modo do Gin (debug | release)
	gin.SetMode(os.Getenv("GIN_MODE"))

	r := gin.New()
	r.Use(gin.Logger())
	r.Use(gin.Recovery())

	// ─── CORS ──────────────────────────────────────────────────────────────────
	corsOrigins := allowedOriginsFromEnv()
	r.Use(cors.New(cors.Config{
		AllowOriginFunc: func(origin string) bool {
			return isAllowedOrigin(origin, corsOrigins)
		},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
	}))

	// ─── Health Check ──────────────────────────────────────────────────────────
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok", "service": "aomenos1km-api"})
	})

	// ─── Rotas Públicas (sem autenticação) ─────────────────────────────────────
	public := r.Group("/api")
	{
		// Auth
		public.POST("/auth/login", api.Login)

		// Formulário público de check-in (acessa dados do evento pelo ID)
		public.GET("/eventos/:id/publico", api.BuscarContratoPublico)
		public.GET("/eventos/publico/slug/:slug", api.BuscarContratoPublicoPorSlug)
		public.POST("/participantes/checkin", api.CriarParticipante)
		public.GET("/participantes/:id/status-pagamento", api.VerificarStatusPagamento)

		// Formulário público de orçamento
		public.POST("/orcamentos/publico", api.ReceberOrcamentoPublico)
		public.GET("/consultores/publico", api.ListarConsultoresPublico)
		public.GET("/locais/publico", api.ListarLocais)
		public.GET("/empresas/consulta-cnpj-publico", api.ConsultarCNPJ)

		// Insumos disponíveis para cálculo público de orçamento
		public.GET("/insumos/publico", api.ListarInsumos)
		public.GET("/configuracoes/publico/preco", api.BuscarPrecoPublico)
		public.POST("/transmissao/inscricao", api.InscreverListaTransmissao)
	}

	// ─── Rotas Protegidas (requerem JWT) ───────────────────────────────────────
	protected := r.Group("/api")
	protected.Use(middleware.AuthMiddleware())
	{
		// Usuário logado
		protected.GET("/auth/me", api.Me)
		protected.PUT("/auth/senha", api.AlterarSenha)

		// Contratos / Eventos
		protected.GET("/contratos", api.ListarContratos)
		protected.POST("/contratos", api.CriarContrato)
		protected.GET("/contratos/:id", api.BuscarContrato)
		protected.PUT("/contratos/:id", api.AtualizarContrato)
		protected.PUT("/contratos/:id/status", api.AtualizarStatusContrato)
		protected.DELETE("/contratos/:id", api.DeletarContrato)

		// Participantes por contrato
		protected.GET("/contratos/:id/participantes", api.ListarParticipantes)
		protected.GET("/contratos/:id/participantes/stream", api.StreamParticipantes)

		// Participantes (admin actions)
		protected.PUT("/participantes/:id", api.EditarParticipante)
		protected.DELETE("/participantes/:id", api.DeletarParticipante)

		// Histórico / Leads de participantes
		protected.GET("/participantes/historico", api.HistoricoParticipantes)

		// Empresas
		protected.GET("/empresas", api.ListarEmpresas)
		protected.POST("/empresas", api.CriarEmpresa)
		protected.GET("/empresas/consulta-cnpj", api.ConsultarCNPJ)
		protected.GET("/empresas/:id", api.BuscarEmpresa)
		protected.PUT("/empresas/:id", api.AtualizarEmpresa)
		protected.DELETE("/empresas/:id", api.DeletarEmpresa)
		protected.GET("/empresas/:id/crm-interacoes", api.ListarEmpresaCRMInteracoes)
		protected.POST("/empresas/:id/crm-interacoes", api.CriarEmpresaCRMInteracao)
		protected.GET("/crm/painel", api.ListarCRMPainel)
		protected.PUT("/crm/pendencias/:id", api.AtualizarCRMPendencia)

		// Insumos
		protected.GET("/insumos", api.ListarInsumos)
		protected.POST("/insumos", api.CriarInsumo)
		protected.PUT("/insumos/:id", api.AtualizarInsumo)
		protected.DELETE("/insumos/:id", api.DeletarInsumo)

		// Locais / Parques
		protected.GET("/locais", api.ListarLocais)
		protected.POST("/locais", api.CriarLocal)
		protected.PUT("/locais/:id", api.AtualizarLocal)
		protected.DELETE("/locais/:id", api.DeletarLocal)

		// Notificações
		protected.GET("/notificacoes", api.ListarNotificacoes)
		protected.GET("/notificacoes/stream", api.StreamNotificacoes)
		protected.PUT("/notificacoes/:id/lida", api.MarcarNotificacaoLida)
		protected.PUT("/notificacoes/lidas", api.MarcarTodasNotificacoesLidas)

		// Orçamentos públicos recebidos
		protected.GET("/orcamentos", api.ListarOrcamentosPublicos)
		protected.GET("/orcamentos/pendentes", api.ListarPedidosPendentes)

		// Perfis e Regras de Orçamento (Automação de Estrutura)
		protected.GET("/perfis", api.ListarPerfis)
		protected.POST("/perfis", api.CriarPerfil)
		protected.DELETE("/perfis/:id", api.DeletarPerfil)
		protected.GET("/perfis/:id/regras", api.ListarRegras)
		protected.POST("/regras", api.SalvarRegra)
		protected.DELETE("/regras/:id", api.DeletarRegra)
		protected.GET("/calcular-estrutura", api.CalcularEstrutura)

		// Propostas geradas no gerador de orçamento
		protected.GET("/propostas", api.ListarPropostas)
		protected.GET("/propostas/:id", api.BuscarProposta)
		protected.POST("/propostas", api.CriarProposta)
		protected.PUT("/propostas/:id/status", api.AtualizarStatusProposta)
		protected.DELETE("/propostas/:id", api.DeletarProposta)
		protected.POST("/propostas/:id/converter", api.ConverterPropostaContrato)

		// Dashboard
		protected.GET("/dashboard", api.GetDashboard)
		protected.GET("/transmissao/inscricoes", api.ListarInscricoesTransmissao)
		protected.GET("/dashboard/meta-mensal", api.GetMetaMensal)
		protected.GET("/dashboard/tendencia-6-meses", api.GetTendencia6Meses)
		protected.GET("/dashboard/ranking-consultores", api.GetRankingConsultores)
		protected.GET("/dashboard/ranking-eventos", api.GetRankingEventos)
		protected.GET("/dashboard/performance-orcamentos-vendas", api.GetPerformanceOrcamentosVendas)
		protected.GET("/comissoes/extrato", api.ListarExtratoComissoes)
		protected.PUT("/comissoes/:id/pagar", api.MarcarComissaoPaga)
		protected.GET("/configuracoes", api.BuscarConfiguracoesSistema)

		// Storage (assinatura Cloudinary para upload direto)
		protected.POST("/storage/assinatura", api.StorageAssinatura)

		// Usuários (todos autenticados podem listar e editar/deletar a si próprios)
		protected.GET("/usuarios", api.ListarUsuarios)
		protected.PUT("/usuarios/:id", api.AtualizarUsuario)
		protected.DELETE("/usuarios/:id", api.DeletarUsuario)

		// Usuários (admin only — criar)
		adminGroup := protected.Group("/admin")
		adminGroup.Use(middleware.AdminOnlyMiddleware())
		{
			adminGroup.POST("/usuarios", api.CriarUsuario)
			adminGroup.PUT("/configuracoes", api.SalvarConfiguracoesSistema)
		}
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("🚀 Servidor iniciado em http://localhost:%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("❌ Erro ao iniciar servidor: %v", err)
	}
}
