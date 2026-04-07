package handlers

import (
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

func RequireAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		expected := strings.TrimSpace(os.Getenv("ADMIN_TOKEN"))
		if expected == "" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": "admin access is disabled: ADMIN_TOKEN is not configured",
			})
			return
		}

		candidate := strings.TrimSpace(c.GetHeader("X-Admin-Token"))
		if candidate == "" {
			auth := strings.TrimSpace(c.GetHeader("Authorization"))
			if strings.HasPrefix(strings.ToLower(auth), "bearer ") {
				candidate = strings.TrimSpace(auth[7:])
			}
		}

		if candidate == "" || candidate != expected {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "unauthorized admin request",
			})
			return
		}

		c.Next()
	}
}
