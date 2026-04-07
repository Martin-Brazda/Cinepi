package handlers

import (
	"net/http"

	"github.com/Martin-Brazda/Cinepi/scraper"
	"github.com/gin-gonic/gin"
)

func Scrape(c *gin.Context) {
	targetUrl := c.Query("url")
	if targetUrl == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "query parameter 'url' is required",
		})
		return
	}

	urls := scraper.GetM3u8Url(targetUrl)
	first := ""
	if len(urls) > 0 {
		first = urls[0]
	}

	c.JSON(http.StatusOK, gin.H{
		"url":       targetUrl,
		"m3u8":      first,
		"m3u8_list": urls,
	})
}
