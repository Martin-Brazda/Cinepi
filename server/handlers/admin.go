package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type ScrapeRequest struct {
	URL string `json:"url" binding:"required"`
}

func ScrapeShow(c *gin.Context) {
	var req ScrapeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body format"})
		return
	}

	show, err := ParseShowFile(req.URL)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to scrape target", "details": err.Error()})
		return
	}

	if err := AddOrUpdateShow(*show); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save show to database"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Successfully imported show",
		"show":    show,
	})
}
