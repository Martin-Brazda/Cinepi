package handlers

import (
	"fmt"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"github.com/Martin-Brazda/Cinepi/providers"
	"github.com/gin-gonic/gin"
)

var episodeSeasonPattern = regexp.MustCompile(`(?i)(?:/(\d+)-(\d+)/?$|/season[-_/ ]?(\d+)[^0-9]+episode[-_/ ]?(\d+)/?$|/s(\d+)[-_. ]*e(\d+)/?$)`)

func needsSeasonRepair(s Show) bool {
	if len(s.Seasons) != 1 || s.Seasons[0].Number != 1 {
		return false
	}
	for _, ep := range s.Seasons[0].Episodes {
		m := episodeSeasonPattern.FindStringSubmatch(ep.ScrapeURL)
		if len(m) > 0 {
			for _, season := range []string{m[1], m[3], m[5]} {
				if season != "" && season != "1" {
					return true
				}
			}
		}
		epTitleLower := strings.ToLower(ep.Title)
		if strings.Contains(epTitleLower, "season ") && !strings.Contains(epTitleLower, "season 1") {
			return true
		}
	}
	return false
}

type ShowListItem struct {
	ID          string   `json:"id"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Year        int      `json:"year"`
	Categories  []string `json:"categories"`
	PosterURL   string   `json:"poster_url"`
	HeroURL     string   `json:"hero_url"`
	ScrapeURL   string   `json:"scrape_url,omitempty"`
}

type CategoryRow struct {
	Category string         `json:"category"`
	Items    []ShowListItem `json:"items"`
}

func toShowListItem(s Show) ShowListItem {
	return ShowListItem{
		ID:          s.ID,
		Title:       s.Title,
		Description: s.Description,
		Year:        s.Year,
		Categories:  s.Categories,
		PosterURL:   s.PosterURL,
		HeroURL:     s.HeroURL,
		ScrapeURL:   s.ScrapeURL,
	}
}

func GetTrending(c *gin.Context) {
	var shows []Show
	DB.Find(&shows)

	out := make([]ShowListItem, 0, len(shows))
	for _, s := range shows {
		out = append(out, toShowListItem(s))
	}
	c.JSON(http.StatusOK, out)
}

func GetShows(c *gin.Context) {
	genre := c.Query("genre")

	limit := 100
	offset := 0
	if raw := strings.TrimSpace(c.Query("limit")); raw != "" {
		if v, err := strconv.Atoi(raw); err == nil && v > 0 {
			if v > 500 {
				v = 500
			}
			limit = v
		}
	}
	if raw := strings.TrimSpace(c.Query("offset")); raw != "" {
		if v, err := strconv.Atoi(raw); err == nil && v >= 0 {
			offset = v
		}
	}

	q := DB.Model(&Show{})

	if genre != "" && !strings.EqualFold(genre, "All") {
		// Categories are stored as a JSON array string in SQLite (via gorm serializer).
		// Best-effort filter using LIKE to avoid fetching everything then filtering in Go.
		g := strings.ToLower(strings.TrimSpace(genre))
		q = q.Where("LOWER(categories) LIKE ?", `%\"`+g+`\"%`)
	}

	var shows []Show
	q.Limit(limit).Offset(offset).Find(&shows)

	out := make([]ShowListItem, 0, len(shows))
	for _, s := range shows {
		out = append(out, toShowListItem(s))
	}
	c.JSON(http.StatusOK, out)
}

func GetHomeRows(c *gin.Context) {
	perCategory := 12
	if raw := strings.TrimSpace(c.Query("per_category")); raw != "" {
		if v, err := strconv.Atoi(raw); err == nil && v > 0 && v <= 40 {
			perCategory = v
		}
	}
	maxCategories := 12
	if raw := strings.TrimSpace(c.Query("categories")); raw != "" {
		if v, err := strconv.Atoi(raw); err == nil && v > 0 && v <= 40 {
			maxCategories = v
		}
	}
	scanLimit := 3000
	if raw := strings.TrimSpace(c.Query("scan_limit")); raw != "" {
		if v, err := strconv.Atoi(raw); err == nil && v > 0 && v <= 20000 {
			scanLimit = v
		}
	}

	var shows []Show
	DB.Limit(scanLimit).Find(&shows)

	grouped := map[string][]ShowListItem{}
	for _, s := range shows {
		cats := s.Categories
		if len(cats) == 0 {
			cats = []string{"Uncategorized"}
		}
		for _, cName := range cats {
			if cName == "" {
				cName = "Uncategorized"
			}
			items := grouped[cName]
			if len(items) < perCategory {
				grouped[cName] = append(items, toShowListItem(s))
			}
		}
	}

	keys := make([]string, 0, len(grouped))
	for k := range grouped {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	if len(keys) > maxCategories {
		keys = keys[:maxCategories]
	}

	rows := make([]CategoryRow, 0, len(keys))
	for _, k := range keys {
		rows = append(rows, CategoryRow{
			Category: k,
			Items:    grouped[k],
		})
	}
	c.JSON(http.StatusOK, rows)
}

func GetShowByID(c *gin.Context) {
	id := c.Param("id")
	var s Show
	if err := DB.Preload("Seasons.Episodes").First(&s, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "show not found"})
		return
	}

	// Auto-populate skeleton shows or repair previously flattened seasons.
	if (len(s.Seasons) == 0 || s.Description == "" || needsSeasonRepair(s)) && s.ScrapeURL != "" {
		fmt.Printf("Auto-populating skeleton show: %s\n", s.Title)
		scraped, err := ParseShowFile(s.ScrapeURL)
		if err == nil {
			// Merge scraped data and update DB
			if err := AddOrUpdateShow(*scraped); err == nil {
				// Re-fetch populated show
				DB.Preload("Seasons.Episodes").First(&s, "id = ?", id)
			}
		}
	}

	c.JSON(http.StatusOK, s)
}

func SearchShows(c *gin.Context) {
	query := strings.ToLower(c.Query("q"))
	scope := strings.ToLower(strings.TrimSpace(c.DefaultQuery("scope", "local")))
	if query == "" {
		c.JSON(http.StatusOK, []ShowListItem{})
		return
	}

	// 1. Search local DB
	var results []Show
	if DB.Dialector.Name() == "postgres" {
		like := "%" + query + "%"
		DB.Raw(`
			SELECT *
			FROM shows
			WHERE to_tsvector('simple', COALESCE(title,'') || ' ' || COALESCE(description,'')) @@ plainto_tsquery('simple', ?)
			   OR LOWER(title) LIKE ?
			   OR LOWER(description) LIKE ?
			ORDER BY ts_rank(
				to_tsvector('simple', COALESCE(title,'') || ' ' || COALESCE(description,'')),
				plainto_tsquery('simple', ?)
			) DESC, year DESC
			LIMIT 300
		`, query, like, like, query).Scan(&results)
	} else {
		DB.Where("LOWER(title) LIKE ? OR LOWER(description) LIKE ?", "%"+query+"%", "%"+query+"%").Find(&results)
	}

	type rankedItem struct {
		item  ShowListItem
		score int
	}
	ranked := make([]rankedItem, 0, len(results))
	seen := make(map[string]struct{}, len(results))
	for _, r := range results {
		score := 1
		title := strings.ToLower(r.Title)
		desc := strings.ToLower(r.Description)
		if strings.HasPrefix(title, query) {
			score += 20
		}
		if strings.Contains(title, query) {
			score += 10
		}
		if strings.Contains(desc, query) {
			score += 3
		}
		if r.Year > 2020 {
			score += 1
		}
		ranked = append(ranked, rankedItem{item: toShowListItem(r), score: score})
		seen[r.ID] = struct{}{}
	}
	sort.SliceStable(ranked, func(i, j int) bool { return ranked[i].score > ranked[j].score })
	out := make([]ShowListItem, 0, len(ranked))
	for _, r := range ranked {
		out = append(out, r.item)
	}

	// 2. Optionally search active provider (external scope only)
	if scope == "external" {
		externalResults, err := providers.Active().Search(query)
		if err == nil {
			for _, ext := range externalResults {
				// Generate ID for comparison
				id := strings.ToLower(strings.ReplaceAll(ext.Title, " ", "-"))

				if _, ok := seen[id]; ok {
					continue
				}

				// Return a skeleton show but do NOT persist it (search should be read-only).
				out = append(out, ShowListItem{
					ID:         id,
					Title:      ext.Title,
					PosterURL:  ext.PosterURL,
					ScrapeURL:  ext.DetailURL,
					Categories: []string{"Uncategorized"},
				})
				seen[id] = struct{}{}
			}
		}
	}

	c.JSON(http.StatusOK, out)
}
