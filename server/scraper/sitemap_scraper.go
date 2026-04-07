package scraper

import (
	"fmt"
	"net/http"
	"strings"
	"sync"

	"github.com/PuerkitoBio/goquery"
)

const (
	MaxTVSeriesPages = 250
	MaxMoviePages    = 1788
)

func GetTVSeriesURLs(maxPage, pageWorkers int) ([]string, error) {
	return getCatalogURLs("https://hurawatch.art/tv-series/page/%d/", maxPage, MaxTVSeriesPages, pageWorkers)
}

func GetMovieURLs(maxPage, pageWorkers int) ([]string, error) {
	return getCatalogURLs("https://hurawatch.art/movies/page/%d/", maxPage, MaxMoviePages, pageWorkers)
}

func GetAllCatalogURLs(tvMaxPage, movieMaxPage, pageWorkers int) ([]string, error) {
	tvURLs, err := GetTVSeriesURLs(tvMaxPage, pageWorkers)
	if err != nil {
		return nil, err
	}
	movieURLs, err := GetMovieURLs(movieMaxPage, pageWorkers)
	if err != nil {
		return nil, err
	}

	unique := make(map[string]bool, len(tvURLs)+len(movieURLs))
	for _, u := range tvURLs {
		unique[u] = true
	}
	for _, u := range movieURLs {
		unique[u] = true
	}

	if len(unique) == 0 {
		return nil, fmt.Errorf("no item urls discovered from tv/movies listing pages")
	}

	results := make([]string, 0, len(unique))
	for u := range unique {
		results = append(results, u)
	}
	return results, nil
}

func getCatalogURLs(pagePattern string, maxPage, hardLimit, pageWorkers int) ([]string, error) {
	if maxPage <= 0 || maxPage > hardLimit {
		maxPage = hardLimit
	}
	if pageWorkers <= 0 {
		pageWorkers = 12
	}
	if pageWorkers > 64 {
		pageWorkers = 64
	}

	pages := make(chan int, pageWorkers*2)
	unique := map[string]bool{}
	var mu sync.Mutex
	var wg sync.WaitGroup

	for w := 0; w < pageWorkers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for pageNum := range pages {
				pageURL := fmt.Sprintf(pagePattern, pageNum)
				links, err := extractCatalogLinks(pageURL)
				if err != nil {
					continue
				}
				mu.Lock()
				for _, link := range links {
					unique[link] = true
				}
				mu.Unlock()
			}
		}()
	}

	for i := 1; i <= maxPage; i++ {
		pages <- i
	}
	close(pages)
	wg.Wait()

	if len(unique) == 0 {
		return nil, fmt.Errorf("no item urls discovered from listing pages")
	}

	results := make([]string, 0, len(unique))
	for u := range unique {
		results = append(results, u)
	}
	return results, nil
}

func extractCatalogLinks(pageURL string) ([]string, error) {
	req, err := http.NewRequest(http.MethodGet, pageURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("status %d", resp.StatusCode)
	}

	doc, err := goquery.NewDocumentFromReader(resp.Body)
	if err != nil {
		return nil, err
	}

	local := map[string]bool{}
	doc.Find("a[href]").Each(func(_ int, s *goquery.Selection) {
		href, exists := s.Attr("href")
		if !exists {
			return
		}
		link := normalizeURL(href)
		if link == "" {
			return
		}
		if strings.HasPrefix(link, "/") {
			link = "https://hurawatch.art" + link
		}
		if !strings.HasPrefix(link, "http") {
			return
		}

		lower := strings.ToLower(link)
		if strings.Contains(lower, "/series/") || strings.Contains(lower, "/tv/") || strings.Contains(lower, "/movie/") || strings.Contains(lower, "/film/") {
			local[link] = true
		}
	})

	results := make([]string, 0, len(local))
	for link := range local {
		results = append(results, link)
	}
	return results, nil
}

func normalizeURL(raw string) string {
	u := strings.TrimSpace(raw)
	u = strings.TrimSuffix(u, "/")
	return u
}
