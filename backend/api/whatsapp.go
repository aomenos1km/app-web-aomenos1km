package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

// whatsAppMessage estrutura da mensagem para a API oficial do WhatsApp Business
type whatsAppMessage struct {
	MessagingProduct string            `json:"messaging_product"`
	To               string            `json:"to"`
	Type             string            `json:"type"`
	Text             whatsAppText      `json:"text"`
}

type whatsAppText struct {
	PreviewURL bool   `json:"preview_url"`
	Body       string `json:"body"`
}

// enviarWhatsApp envia uma mensagem de texto via WhatsApp Business API oficial
func enviarWhatsApp(numero, mensagem string) error {
	phoneNumberID := os.Getenv("WHATSAPP_PHONE_NUMBER_ID")
	accessToken := os.Getenv("WHATSAPP_ACCESS_TOKEN")
	apiVersion := os.Getenv("WHATSAPP_API_VERSION")

	if phoneNumberID == "" || accessToken == "" {
		// Nenhum serviço de WhatsApp configurado — apenas registra no log
		fmt.Printf("[WhatsApp] Para: %s | Mensagem: %s\n", numero, mensagem)
		return nil
	}

	if apiVersion == "" {
		apiVersion = "v18.0"
	}

	payload := whatsAppMessage{
		MessagingProduct: "whatsapp",
		To:               numero,
		Type:             "text",
		Text: whatsAppText{
			PreviewURL: false,
			Body:       mensagem,
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("erro ao serializar mensagem: %w", err)
	}

	url := fmt.Sprintf("https://graph.facebook.com/%s/%s/messages", apiVersion, phoneNumberID)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(body))
	if err != nil {
		return fmt.Errorf("erro ao criar request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("erro ao enviar mensagem: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("WhatsApp API retornou status %d", resp.StatusCode)
	}

	return nil
}
