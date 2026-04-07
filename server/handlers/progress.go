package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type ProgressRequest struct {
	EpisodeID uint `json:"episode_id"`
	Progress  int  `json:"progress"`
}

func UpdateProgress(c *gin.Context) {
	var req ProgressRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if req.Progress < 0 {
		req.Progress = 0
	}
	if req.Progress > 100 {
		req.Progress = 100
	}

	watched := false
	if req.Progress >= 95 { // Consider watched if >= 95%
		watched = true
	}

	result := DB.Model(&Episode{}).Where("id = ?", req.EpisodeID).Updates(map[string]interface{}{
		"progress": req.Progress,
		"watched":  watched,
	})

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update progress"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success"})
}
