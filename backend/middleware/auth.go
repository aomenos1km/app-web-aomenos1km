package middleware

import (
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// AuthMiddleware valida o token JWT no header Authorization
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "Token de autenticação não fornecido",
			})
			return
		}

		// Espera: "Bearer <token>"
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "Formato de token inválido. Use: Bearer <token>",
			})
			return
		}

		tokenStr := parts[1]
		secret := os.Getenv("JWT_SECRET")

		token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return []byte(secret), nil
		})

		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "Token inválido ou expirado",
			})
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "Claims do token inválidas",
			})
			return
		}

		// Salva os dados do usuário no contexto da requisição
		c.Set("user_id", claims["user_id"])
		c.Set("login", claims["login"])
		c.Set("perfil", claims["perfil"])
		c.Set("nome", claims["nome"])
		c.Next()
	}
}

// AdminOnlyMiddleware garante que apenas admins acessem a rota
func AdminOnlyMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		perfil, _ := c.Get("perfil")
		if perfil != "Admin" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"success": false,
				"error":   "Acesso restrito a administradores",
			})
			return
		}
		c.Next()
	}
}
