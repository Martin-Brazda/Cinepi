package main

import (
	"bufio"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/Martin-Brazda/Cinepi/handlers"
	"github.com/gin-gonic/gin"
)

func CORSMiddleware() gin.HandlerFunc {
	allowedOrigins := map[string]struct{}{}
	for _, origin := range strings.Split(os.Getenv("CORS_ALLOWED_ORIGINS"), ",") {
		normalized := strings.TrimSpace(origin)
		if normalized == "" {
			continue
		}
		allowedOrigins[normalized] = struct{}{}
	}
	allowAnyOrigin := len(allowedOrigins) == 0

	return func(c *gin.Context) {
		requestOrigin := strings.TrimSpace(c.GetHeader("Origin"))
		if allowAnyOrigin {
			c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		} else if requestOrigin != "" {
			if _, ok := allowedOrigins[requestOrigin]; ok {
				c.Writer.Header().Set("Access-Control-Allow-Origin", requestOrigin)
				c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
				c.Writer.Header().Set("Vary", "Origin")
			}
		}
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

func main() {
	loadDotEnv(".env")

	handlers.LoadDatabase()

	r := gin.Default()

	r.Use(CORSMiddleware())

	v1 := r.Group("/api/v1")
	{
		v1.GET("/status", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"status": "online"})
		})

		v1.GET("/trending", handlers.GetTrending)
		v1.GET("/shows", handlers.GetShows)
		v1.GET("/home-rows", handlers.GetHomeRows)
		v1.GET("/shows/:id", handlers.GetShowByID)
		v1.GET("/search", handlers.SearchShows)
		v1.GET("/scrape", handlers.ScrapeRateLimitMiddleware(), handlers.Scrape)
		v1.POST("/progress", handlers.UpdateProgress)
		v1.POST("/auth/register", handlers.Register)
		v1.POST("/auth/login", handlers.Login)
		v1.POST("/auth/refresh", handlers.RefreshSession)
		v1.POST("/auth/logout", handlers.Logout)
		v1.POST("/auth/logout-all", handlers.LogoutAll)
		v1.GET("/profiles", handlers.ListProfiles)
		v1.POST("/profiles", handlers.CreateProfile)
		v1.GET("/profiles/:profileId/my-list", handlers.GetMyList)
		v1.POST("/profiles/:profileId/my-list/:showId", handlers.AddMyListItem)
		v1.DELETE("/profiles/:profileId/my-list/:showId", handlers.RemoveMyListItem)
		v1.POST("/profiles/:profileId/progress", handlers.UpdateProfileProgress)
		v1.GET("/profiles/:profileId/continue-watching", handlers.GetContinueWatching)
		v1.GET("/profiles/:profileId/recommendations", handlers.GetRecommendations)
		v1.POST("/profiles/:profileId/recommendations/refresh", handlers.RefreshRecommendations)
		v1.GET("/shows/:id/playback-options", handlers.GetPlaybackOptions)
		v1.GET("/shows/:id/auto-next", handlers.GetAutoNext)

		admin := v1.Group("/admin")
		{
			admin.Use(handlers.RequireAdmin())
			admin.POST("/scrape-show", handlers.ScrapeShow)
			admin.POST("/seed-popular", handlers.SeedPopularShows)
			admin.POST("/seed-all", handlers.SeedAllShows)
			admin.POST("/seed-all-tv", handlers.SeedAllTVShows)
			admin.POST("/seed-all-movies", handlers.SeedAllMovies)
			admin.GET("/seed-status", handlers.SeedStatus)
			admin.POST("/seed-cancel", handlers.CancelSeedJob)
			admin.POST("/rescrape-categories", handlers.RescrapeCategories)
		}
	}

	port := strings.TrimSpace(os.Getenv("PORT"))
	if port == "" {
		port = "8081"
	}
	addr := ":" + port
	log.Printf("Cinepi Server starting on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}

func loadDotEnv(path string) {
	file, err := os.Open(path)
	if err != nil {
		return
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}

		key := strings.TrimSpace(parts[0])
		key = strings.TrimPrefix(key, "export ")
		value := strings.TrimSpace(parts[1])
		value = strings.Trim(value, `"'`)

		if key == "" {
			continue
		}
		if _, exists := os.LookupEnv(key); exists {
			continue
		}
		if err := os.Setenv(key, value); err != nil {
			log.Printf("Skipping invalid env var %q: %v", key, err)
		}
	}

	if err := scanner.Err(); err != nil {
		log.Printf("Failed reading %s: %v", path, err)
		return
	}

	log.Printf("Loaded environment variables from %s", path)
}
