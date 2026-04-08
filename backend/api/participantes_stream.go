package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/aomenos1km/app-web/models"
	"github.com/gin-gonic/gin"
)

type participantesEvento struct {
	ContratoID     string    `json:"contrato_id"`
	ParticipanteID string    `json:"participante_id,omitempty"`
	Acao           string    `json:"acao"`
	AtualizadoEm   time.Time `json:"atualizado_em"`
}

type participantesHub struct {
	mu   sync.RWMutex
	subs map[string]map[chan participantesEvento]struct{}
}

var hubParticipantes = &participantesHub{
	subs: make(map[string]map[chan participantesEvento]struct{}),
}

func subscribeParticipantes(contratoID string) chan participantesEvento {
	ch := make(chan participantesEvento, 16)
	hubParticipantes.mu.Lock()
	defer hubParticipantes.mu.Unlock()
	if hubParticipantes.subs[contratoID] == nil {
		hubParticipantes.subs[contratoID] = make(map[chan participantesEvento]struct{})
	}
	hubParticipantes.subs[contratoID][ch] = struct{}{}
	return ch
}

func unsubscribeParticipantes(contratoID string, ch chan participantesEvento) {
	hubParticipantes.mu.Lock()
	defer hubParticipantes.mu.Unlock()
	if subs, ok := hubParticipantes.subs[contratoID]; ok {
		delete(subs, ch)
		if len(subs) == 0 {
			delete(hubParticipantes.subs, contratoID)
		}
	}
	close(ch)
}

func publishParticipantesAtualizados(contratoID, participanteID, acao string) {
	hubParticipantes.mu.RLock()
	subs := hubParticipantes.subs[contratoID]
	hubParticipantes.mu.RUnlock()
	if len(subs) == 0 {
		return
	}

	evento := participantesEvento{
		ContratoID:     contratoID,
		ParticipanteID: participanteID,
		Acao:           acao,
		AtualizadoEm:   time.Now(),
	}

	for ch := range subs {
		select {
		case ch <- evento:
		default:
		}
	}
}

func StreamParticipantes(c *gin.Context) {
	contratoID := c.Param("id")
	if contratoID == "" {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Contrato obrigatório"})
		return
	}

	authUser := getAuthzUser(c)
	if !authUser.IsAdmin() && !authUser.IsConsultor() {
		canAccess, err := canAccessContrato(c.Request.Context(), authUser, contratoID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: err.Error()})
			return
		}
		if !canAccess {
			rejectForbidden(c, "Você não tem permissão para acompanhar este evento")
			return
		}
	}

	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")

	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Streaming nao suportado"})
		return
	}

	sub := subscribeParticipantes(contratoID)
	defer unsubscribeParticipantes(contratoID, sub)

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
		case evento := <-sub:
			payload, err := json.Marshal(evento)
			if err != nil {
				continue
			}
			_, _ = fmt.Fprintf(c.Writer, "event: participantes_atualizados\ndata: %s\n\n", payload)
			flusher.Flush()
		}
	}
}
