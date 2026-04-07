package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/Martin-Brazda/Cinepi/providers"
	"github.com/Martin-Brazda/Cinepi/scraper"
	"github.com/gin-gonic/gin"
)

type SeedJobStatus struct {
	JobType         string    `json:"job_type"`
	State           string    `json:"state"`
	CancelRequested bool      `json:"cancel_requested"`
	Workers         int       `json:"workers"`
	Discovered      int       `json:"discovered"`
	Queued          int       `json:"queued"`
	Processed       int       `json:"processed"`
	Imported        int       `json:"imported"`
	Failed          int       `json:"failed"`
	StartedAt       time.Time `json:"started_at"`
	FinishedAt      time.Time `json:"finished_at,omitempty"`
	LastError       string    `json:"last_error,omitempty"`
	ElapsedSec      int64     `json:"elapsed_sec"`
	ETASeconds      int64     `json:"eta_seconds,omitempty"`
	ThroughputPM    float64   `json:"throughput_per_min"`
}

var (
	seedStatusMu sync.Mutex
	seedStatuses = map[string]*SeedJobStatus{}
)

func SeedPopularShows(c *gin.Context) {
	fmt.Println("Seeding popular shows from Hurawatch homepage...")

	urls, err := scraper.GetHomepageTrending()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch trending shows", "details": err.Error()})
		return
	}

	maxShows := 30
	if raw := c.Query("limit"); raw != "" {
		if v, err := strconv.Atoi(raw); err == nil && v > 0 {
			maxShows = v
		}
	}
	if maxShows > len(urls) {
		maxShows = len(urls)
	}

	workers := 4
	if raw := c.Query("workers"); raw != "" {
		if v, err := strconv.Atoi(raw); err == nil && v > 0 && v <= 12 {
			workers = v
		}
	}

	fmt.Printf("Found %d potential shows to seed. Seeding top %d with %d workers...\n", len(urls), maxShows, workers)

	jobType := "popular"
	workers = clampWorkers(workers)
	if !beginJob(jobType, workers, len(urls), maxShows) {
		c.JSON(http.StatusConflict, gin.H{"error": "popular seeding already running"})
		return
	}

	go func() {
		seedTargets := urls[:maxShows]
		jobs := make(chan string, workers*3)
		var wg sync.WaitGroup

		for i := 0; i < workers; i++ {
			wg.Add(1)
			go func(workerID int) {
				defer wg.Done()
				for url := range jobs {
					if isJobCancelled(jobType) {
						return
					}
					// tiny stagger to avoid synchronized bursts
					time.Sleep(80 * time.Millisecond)

					show, err := ParseShowFile(url)
					if err != nil {
						markFailure(jobType, err)
						fmt.Printf("Seed worker %d skipping [%s]: %v\n", workerID+1, url, err)
						continue
					}

					// Add/Update in DB
					if err := AddOrUpdateShow(*show); err != nil {
						markFailure(jobType, err)
						fmt.Printf("Seed worker %d failed to save [%s]: %v\n", workerID+1, show.Title, err)
						continue
					}

					current := markSuccess(jobType)
					fmt.Printf("Seed success [%d/%d]: %s\n", current, len(seedTargets), show.Title)
				}
			}(i)
		}

		for _, url := range seedTargets {
			if isJobCancelled(jobType) {
				break
			}
			jobs <- url
		}
		close(jobs)
		wg.Wait()
		finishJob(jobType)
		s := snapshotJob(jobType)
		fmt.Printf("Seeding complete. Imported %d/%d shows.\n", s.Imported, len(seedTargets))
	}()

	c.JSON(http.StatusOK, gin.H{
		"message":         "Seeding started in background",
		"potential_shows": len(urls),
		"queued_shows":    maxShows,
		"workers":         workers,
	})
}

func SeedAllTVShows(c *gin.Context) {
	startSeedCatalog(c, "tv")
}

func SeedAllMovies(c *gin.Context) {
	startSeedCatalog(c, "movies")
}

func SeedAllShows(c *gin.Context) {
	startSeedCatalog(c, "all")
}

func SeedStatus(c *gin.Context) {
	seedStatusMu.Lock()
	defer seedStatusMu.Unlock()

	out := make(map[string]SeedJobStatus, len(seedStatuses))
	for key, status := range seedStatuses {
		out[key] = withComputedTiming(*status)
	}
	var dbJobs []SeedJobRecord
	DB.Order("updated_at_unix desc").Find(&dbJobs)
	c.JSON(http.StatusOK, gin.H{"jobs": out, "jobs_persisted": dbJobs})
}

func CancelSeedJob(c *gin.Context) {
	jobType := c.Query("job_type")
	if jobType == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "job_type query param is required"})
		return
	}
	seedStatusMu.Lock()
	if s, ok := seedStatuses[jobType]; ok {
		s.CancelRequested = true
	}
	seedStatusMu.Unlock()
	DB.Model(&SeedJobRecord{}).Where("job_type = ?", jobType).Update("cancel_requested", true)
	c.JSON(http.StatusOK, gin.H{"status": "cancel_requested", "job_type": jobType})
}

func startSeedCatalog(c *gin.Context, mode string) {
	p := providers.Active()
	workers := clampWorkers(parseIntQuery(c, "workers", 8))
	pageWorkers := clampPageWorkers(parseIntQuery(c, "page_workers", 14))
	offset := parseIntQuery(c, "offset", 0)
	limit := parseIntQuery(c, "limit", 0)

	var urls []string
	var err error
	var jobType string

	switch mode {
	case "tv":
		jobType = "all_tv"
		tvPages := parseIntQuery(c, "tv_pages", scraper.MaxTVSeriesPages)
		if tvPages > scraper.MaxTVSeriesPages {
			tvPages = scraper.MaxTVSeriesPages
		}
		if tvPages <= 0 {
			tvPages = scraper.MaxTVSeriesPages
		}
		urls, err = p.TVCatalog(tvPages, pageWorkers)
	case "movies":
		jobType = "all_movies"
		moviePages := parseIntQuery(c, "movie_pages", scraper.MaxMoviePages)
		if moviePages > scraper.MaxMoviePages {
			moviePages = scraper.MaxMoviePages
		}
		if moviePages <= 0 {
			moviePages = scraper.MaxMoviePages
		}
		urls, err = p.MovieCatalog(moviePages, pageWorkers)
	default:
		jobType = "all_catalog"
		tvPages := parseIntQuery(c, "tv_pages", scraper.MaxTVSeriesPages)
		moviePages := parseIntQuery(c, "movie_pages", scraper.MaxMoviePages)
		tvURLs, tvErr := p.TVCatalog(tvPages, pageWorkers)
		mvURLs, mvErr := p.MovieCatalog(moviePages, pageWorkers)
		if tvErr != nil {
			err = tvErr
			break
		}
		if mvErr != nil {
			err = mvErr
			break
		}
		seen := map[string]bool{}
		for _, u := range tvURLs {
			seen[u] = true
		}
		for _, u := range mvURLs {
			seen[u] = true
		}
		urls = make([]string, 0, len(seen))
		for u := range seen {
			urls = append(urls, u)
		}
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to discover shows from paginated catalog", "details": err.Error()})
		return
	}

	if offset < 0 {
		offset = 0
	}
	if offset >= len(urls) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "offset is out of range"})
		return
	}
	remaining := len(urls) - offset
	if limit <= 0 || limit > remaining {
		limit = remaining
	}
	seedTargets := urls[offset : offset+limit]

	if !beginJob(jobType, workers, len(urls), len(seedTargets)) {
		c.JSON(http.StatusConflict, gin.H{"error": "a seeding job of this type is already running", "job_type": jobType})
		return
	}

	go func() {
		jobs := make(chan string, workers*3)
		var wg sync.WaitGroup

		for i := 0; i < workers; i++ {
			wg.Add(1)
			go func(workerID int) {
				defer wg.Done()
				for url := range jobs {
					if isJobCancelled(jobType) {
						return
					}
					time.Sleep(80 * time.Millisecond)

					show, err := ParseShowFile(url)
					if err != nil {
						markFailure(jobType, err)
						fmt.Printf("All-seed worker %d skipping [%s]: %v\n", workerID+1, url, err)
						continue
					}

					if err := AddOrUpdateShow(*show); err != nil {
						markFailure(jobType, err)
						fmt.Printf("All-seed worker %d failed to save [%s]: %v\n", workerID+1, show.Title, err)
						continue
					}

					current := markSuccess(jobType)
					fmt.Printf("All-seed success [%d/%d]: %s\n", current, len(seedTargets), show.Title)
				}
			}(i)
		}

		for _, url := range seedTargets {
			if isJobCancelled(jobType) {
				break
			}
			jobs <- url
		}
		close(jobs)
		wg.Wait()
		finishJob(jobType)
		s := snapshotJob(jobType)
		fmt.Printf("All-seed complete. Imported %d/%d shows.\n", s.Imported, len(seedTargets))
	}()

	c.JSON(http.StatusOK, gin.H{
		"message":          "seeding started in background",
		"job_type":         jobType,
		"discovered_shows": len(urls),
		"queued_shows":     len(seedTargets),
		"workers":          workers,
		"page_workers":     pageWorkers,
		"offset":           offset,
		"limit":            limit,
	})
}

// RescrapeCategories re-scrapes all shows that have "Uncategorized" categories
func RescrapeCategories(c *gin.Context) {
	var shows []Show
	DB.Where("categories = ? AND scrape_url != ''", `["Uncategorized"]`).Find(&shows)

	if len(shows) == 0 {
		c.JSON(http.StatusOK, gin.H{"message": "No uncategorized shows to fix"})
		return
	}

	fmt.Printf("Found %d uncategorized shows to re-scrape...\n", len(shows))

	go func() {
		fixed := 0
		for i, show := range shows {
			time.Sleep(1 * time.Second) // rate limit

			scraped, err := ParseShowFile(show.ScrapeURL)
			if err != nil {
				fmt.Printf("Re-scrape skip [%s]: %v\n", show.Title, err)
				continue
			}

			// Only update if we actually got categories
			if len(scraped.Categories) > 0 && !(len(scraped.Categories) == 1 && scraped.Categories[0] == "Uncategorized") {
				show.Categories = scraped.Categories
				if scraped.Description != "" && show.Description == "" {
					show.Description = scraped.Description
				}
				if scraped.Year != 2024 {
					show.Year = scraped.Year
				}
				DB.Save(&show)
				fixed++
				fmt.Printf("Fixed categories [%d/%d]: %s -> %v\n", i+1, len(shows), show.Title, scraped.Categories)
			} else {
				fmt.Printf("Still uncategorized [%d/%d]: %s\n", i+1, len(shows), show.Title)
			}
		}
		fmt.Printf("Category re-scrape complete. Fixed %d/%d shows.\n", fixed, len(shows))
	}()

	c.JSON(http.StatusOK, gin.H{
		"message":             "Re-scrape started in background",
		"uncategorized_shows": len(shows),
	})
}

func parseIntQuery(c *gin.Context, key string, fallback int) int {
	raw := c.Query(key)
	if raw == "" {
		return fallback
	}
	v, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return v
}

func clampWorkers(workers int) int {
	if workers < 1 {
		return 1
	}
	if workers > 24 {
		return 24
	}
	return workers
}

func clampPageWorkers(workers int) int {
	if workers < 1 {
		return 1
	}
	if workers > 64 {
		return 64
	}
	return workers
}

func beginJob(jobType string, workers, discovered, queued int) bool {
	seedStatusMu.Lock()
	defer seedStatusMu.Unlock()

	if existing, ok := seedStatuses[jobType]; ok && existing.State == "running" {
		return false
	}
	seedStatuses[jobType] = &SeedJobStatus{
		JobType:    jobType,
		State:      "running",
		Workers:    workers,
		Discovered: discovered,
		Queued:     queued,
		StartedAt:  time.Now(),
	}
	persistSeedJob(jobType)
	return true
}

func markSuccess(jobType string) int {
	seedStatusMu.Lock()
	defer seedStatusMu.Unlock()

	status := seedStatuses[jobType]
	status.Processed++
	status.Imported++
	persistSeedJob(jobType)
	return status.Imported
}

func markFailure(jobType string, err error) {
	seedStatusMu.Lock()
	defer seedStatusMu.Unlock()

	status := seedStatuses[jobType]
	status.Processed++
	status.Failed++
	if err != nil {
		status.LastError = err.Error()
	}
	persistSeedJob(jobType)
}

func finishJob(jobType string) {
	seedStatusMu.Lock()
	defer seedStatusMu.Unlock()

	status := seedStatuses[jobType]
	if status.CancelRequested {
		status.State = "cancelled"
	} else {
		status.State = "finished"
	}
	status.FinishedAt = time.Now()
	persistSeedJob(jobType)
}

func snapshotJob(jobType string) SeedJobStatus {
	seedStatusMu.Lock()
	defer seedStatusMu.Unlock()
	return withComputedTiming(*seedStatuses[jobType])
}

func withComputedTiming(status SeedJobStatus) SeedJobStatus {
	end := status.FinishedAt
	if end.IsZero() {
		end = time.Now()
	}
	elapsed := end.Sub(status.StartedAt)
	if elapsed < 0 {
		elapsed = 0
	}
	status.ElapsedSec = int64(elapsed.Seconds())

	minutes := elapsed.Minutes()
	if minutes > 0 {
		status.ThroughputPM = float64(status.Processed) / minutes
	}
	remaining := status.Queued - status.Processed
	if status.State == "running" && status.ThroughputPM > 0 && remaining > 0 {
		status.ETASeconds = int64(float64(remaining)/status.ThroughputPM*60.0 + 0.5)
	}
	return status
}

func isJobCancelled(jobType string) bool {
	seedStatusMu.Lock()
	defer seedStatusMu.Unlock()
	s := seedStatuses[jobType]
	if s == nil {
		return false
	}
	return s.CancelRequested
}

func persistSeedJob(jobType string) {
	s := seedStatuses[jobType]
	if s == nil {
		return
	}
	now := time.Now().Unix()
	rec := SeedJobRecord{
		JobType:         s.JobType,
		State:           s.State,
		CancelRequested: s.CancelRequested,
		Workers:         s.Workers,
		Discovered:      s.Discovered,
		Queued:          s.Queued,
		Processed:       s.Processed,
		Imported:        s.Imported,
		Failed:          s.Failed,
		LastError:       s.LastError,
		StartedAtUnix:   s.StartedAt.Unix(),
		UpdatedAtUnix:   now,
	}
	if !s.FinishedAt.IsZero() {
		rec.FinishedAtUnix = s.FinishedAt.Unix()
	}
	DB.Where(SeedJobRecord{JobType: jobType}).Assign(rec).FirstOrCreate(&SeedJobRecord{})
}
