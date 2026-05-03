package handlers

import (
	"net"
	"net/http"
	neturl "net/url"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/Martin-Brazda/Cinepi/scraper"
	"github.com/gin-gonic/gin"
)

var scrapeRateState = struct {
	mu      sync.Mutex
	hits    map[string][]time.Time
	window  time.Duration
	maxHits int
}{
	hits:    map[string][]time.Time{},
	window:  time.Minute,
	maxHits: 20,
}

func ScrapeRateLimitMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := strings.TrimSpace(c.ClientIP())
		if ip == "" {
			ip = "unknown"
		}

		now := time.Now()
		cutoff := now.Add(-scrapeRateState.window)

		scrapeRateState.mu.Lock()
		defer scrapeRateState.mu.Unlock()

		history := scrapeRateState.hits[ip]
		filtered := history[:0]
		for _, ts := range history {
			if ts.After(cutoff) {
				filtered = append(filtered, ts)
			}
		}
		if len(filtered) >= scrapeRateState.maxHits {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": "rate limit exceeded for scrape endpoint",
			})
			return
		}
		scrapeRateState.hits[ip] = append(filtered, now)
		c.Next()
	}
}

func Scrape(c *gin.Context) {
	targetUrl := c.Query("url")
	if targetUrl == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "query parameter 'url' is required",
		})
		return
	}
	if !isScrapeTargetAllowed(targetUrl) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "url is not allowed for scraping",
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

func isScrapeTargetAllowed(raw string) bool {
	parsed, err := neturl.Parse(strings.TrimSpace(raw))
	if err != nil || parsed == nil {
		return false
	}
	scheme := strings.ToLower(parsed.Scheme)
	if scheme != "http" && scheme != "https" {
		return false
	}
	host := strings.TrimSpace(parsed.Hostname())
	if host == "" {
		return false
	}

	allowedHosts := parseScrapeAllowlist()
	if len(allowedHosts) > 0 {
		ok := false
		lowerHost := strings.ToLower(host)
		for _, allowed := range allowedHosts {
			if lowerHost == allowed || strings.HasSuffix(lowerHost, "."+allowed) {
				ok = true
				break
			}
		}
		if !ok {
			return false
		}
	}

	ips, err := net.LookupIP(host)
	if err != nil || len(ips) == 0 {
		return false
	}
	for _, ip := range ips {
		if isBlockedIP(ip) {
			return false
		}
	}
	return true
}

func parseScrapeAllowlist() []string {
	raw := strings.TrimSpace(os.Getenv("SCRAPE_ALLOWED_HOSTS"))
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		host := strings.ToLower(strings.TrimSpace(part))
		if host != "" {
			out = append(out, host)
		}
	}
	return out
}

func isBlockedIP(ip net.IP) bool {
	if ip == nil {
		return true
	}
	if ip.IsLoopback() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsMulticast() || ip.IsUnspecified() {
		return true
	}

	if v4 := ip.To4(); v4 != nil {
		if v4[0] == 10 {
			return true
		}
		if v4[0] == 127 {
			return true
		}
		if v4[0] == 169 && v4[1] == 254 {
			return true
		}
		if v4[0] == 172 && v4[1] >= 16 && v4[1] <= 31 {
			return true
		}
		if v4[0] == 192 && v4[1] == 168 {
			return true
		}
	}

	if strings.HasPrefix(ip.String(), "fc") || strings.HasPrefix(ip.String(), "fd") {
		return true
	}
	return false
}
