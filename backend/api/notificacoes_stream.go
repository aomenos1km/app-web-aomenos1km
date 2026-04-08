package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/aomenos1km/app-web/db"
	"github.com/aomenos1km/app-web/models"
	"github.com/gin-gonic/gin"
)

type notificacoesHub struct {
	mu   sync.RWMutex
	subs map[chan models.Notificacao]struct{}
}

var hubNotificacoes = &notificacoesHub{
	subs: make(map[chan models.Notificacao]struct{}),
}

func subscribeNotificacoes() chan models.Notificacao {
	ch := make(chan models.Notificacao, 16)
	hubNotificacoes.mu.Lock()
	hubNotificacoes.subs[ch] = struct{}{}
	hubNotificacoes.mu.Unlock()
	return ch
}

func unsubscribeNotificacoes(ch chan models.Notificacao) {
	hubNotificacoes.mu.Lock()
	delete(hubNotificacoes.subs, ch)
	hubNotificacoes.mu.Unlock()
	close(ch)
}

func publishNotificacao(n models.Notificacao) {
	hubNotificacoes.mu.RLock()
	defer hubNotificacoes.mu.RUnlock()

	for ch := range hubNotificacoes.subs {
		select {
		case ch <- n:
		default:
		}
	}
}

func criarNotificacao(
	ctx context.Context,
	titulo, mensagem, tipo string,
	contratoID, propostaID *string,
	autorNome, autorPerfil string,
) (*models.Notificacao, error) {
	titulo = strings.TrimSpace(titulo)
	mensagem = strings.TrimSpace(mensagem)
	tipo = strings.TrimSpace(tipo)
	autorNome = strings.TrimSpace(autorNome)
	autorPerfil = strings.TrimSpace(autorPerfil)

	if titulo == "" || mensagem == "" {
		return nil, nil
	}
	if tipo == "" {
		tipo = "info"
	}

	var n models.Notificacao
	err := db.Pool.QueryRow(ctx, `
		INSERT INTO notificacoes (titulo, mensagem, tipo, contrato_id, proposta_id, autor_nome, autor_perfil)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, titulo, mensagem, tipo, lida, contrato_id, proposta_id,
		          COALESCE(autor_nome, ''), COALESCE(autor_perfil, ''), criado_em`,
		titulo,
		mensagem,
		tipo,
		contratoID,
		propostaID,
		autorNome,
		autorPerfil,
	).Scan(&n.ID, &n.Titulo, &n.Mensagem, &n.Tipo, &n.Lida, &n.ContratoID, &n.PropostaID, &n.AutorNome, &n.AutorPerfil, &n.CriadoEm)
	if err != nil {
		return nil, err
	}

	publishNotificacao(n)
	return &n, nil
}

func StreamNotificacoes(c *gin.Context) {
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")

	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Streaming nao suportado"})
		return
	}

	sub := subscribeNotificacoes()
	defer unsubscribeNotificacoes(sub)

	_, _ = fmt.Fprint(c.Writer, ": connected\n\n")
	flusher.Flush()

	keepAlive := time.NewTicker(25 * time.Second)
	defer keepAlive.Stop()

	ctx := c.Request.Context()
	for {
		select {
		case <-ctx.Done():
			return
		case <-keepAlive.C:
			_, _ = fmt.Fprint(c.Writer, ": keepalive\n\n")
			flusher.Flush()
		case n := <-sub:
			payload, err := json.Marshal(n)
			if err != nil {
				continue
			}
			_, _ = fmt.Fprintf(c.Writer, "event: notificacao_nova\ndata: %s\n\n", payload)
			flusher.Flush()
		}
	}
}
