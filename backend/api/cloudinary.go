package api

import (
	"crypto/sha1"
	"fmt"
	"os"
	"strconv"
	"time"
)

// AssinaturaCloudinary dados retornados para o frontend fazer upload direto
type AssinaturaCloudinary struct {
	CloudName string `json:"cloud_name"`
	APIKey    string `json:"api_key"`
	Timestamp int64  `json:"timestamp"`
	Signature string `json:"signature"`
	Folder    string `json:"folder"`
}

// GerarAssinaturaCloudinary gera uma assinatura HMAC-SHA1 para upload autenticado
func GerarAssinaturaCloudinary() (*AssinaturaCloudinary, error) {
	cloudName := os.Getenv("CLOUDINARY_CLOUD_NAME")
	apiKey := os.Getenv("CLOUDINARY_API_KEY")
	apiSecret := os.Getenv("CLOUDINARY_API_SECRET")

	if cloudName == "" || apiKey == "" || apiSecret == "" {
		return nil, fmt.Errorf("credenciais do Cloudinary não configuradas")
	}

	timestamp := time.Now().Unix()
	folder := "aomenos1km"

	// Parâmetros a assinar (em ordem alfabética conforme documentação Cloudinary)
	paramStr := fmt.Sprintf("folder=%s&timestamp=%s", folder, strconv.FormatInt(timestamp, 10))

	// Cloudinary assina como SHA1(string_to_sign + api_secret), sem HMAC.
	signature := fmt.Sprintf("%x", sha1.Sum([]byte(paramStr+apiSecret)))

	return &AssinaturaCloudinary{
		CloudName: cloudName,
		APIKey:    apiKey,
		Timestamp: timestamp,
		Signature: signature,
		Folder:    folder,
	}, nil
}
