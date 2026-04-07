package handlers

import (
	"fmt"
	"io"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"github.com/Martin-Brazda/Cinepi/scraper" // Added import
	"github.com/PuerkitoBio/goquery"
)

var seasonEpisodeURLPatterns = []*regexp.Regexp{
	regexp.MustCompile(`/(\d+)-(\d+)/?$`),
	regexp.MustCompile(`(?i)/season[-_/ ]?(\d+)[^0-9]+episode[-_/ ]?(\d+)/?$`),
	regexp.MustCompile(`(?i)/s(\d+)[-_. ]*e(\d+)/?$`),
}

var seasonEpisodeTitlePattern = regexp.MustCompile(`(?i)(?:season|s)\s*(\d+)\D+(?:episode|ep|e)\s*(\d+)`)

func parseSeasonEpisode(rawURL, rawTitle string) (season int, episode int, ok bool) {
	for _, p := range seasonEpisodeURLPatterns {
		m := p.FindStringSubmatch(rawURL)
		if len(m) == 3 {
			s, err1 := strconv.Atoi(m[1])
			e, err2 := strconv.Atoi(m[2])
			if err1 == nil && err2 == nil {
				return s, e, true
			}
		}
	}

	m := seasonEpisodeTitlePattern.FindStringSubmatch(rawTitle)
	if len(m) == 3 {
		s, err1 := strconv.Atoi(m[1])
		e, err2 := strconv.Atoi(m[2])
		if err1 == nil && err2 == nil {
			return s, e, true
		}
	}

	return 0, 0, false
}

func fetchSeasonEpisodesFromAjax(client *http.Client, seasonDataID string, seasonNum int) ([]Episode, error) {
	req, err := http.NewRequest("GET", "https://hurawatch.art/ajax/ajax.php?episode="+seasonDataID, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

	res, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		return nil, fmt.Errorf("ajax season fetch returned %d", res.StatusCode)
	}

	body, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}

	doc, err := goquery.NewDocumentFromReader(strings.NewReader(string(body)))
	if err != nil {
		return nil, err
	}

	episodes := make([]Episode, 0)
	doc.Find("li a[href*='/series/']").Each(func(i int, a *goquery.Selection) {
		href, _ := a.Attr("href")
		title := strings.TrimSpace(a.Text())
		if title == "" {
			if t, ok := a.Attr("title"); ok {
				title = strings.TrimSpace(t)
			}
		}
		if title == "" || href == "" {
			return
		}
		if strings.HasPrefix(href, "/") {
			href = "https://hurawatch.art" + href
		}
		epNum := i + 1
		if _, parsedEpisode, ok := parseSeasonEpisode(href, title); ok {
			epNum = parsedEpisode
		}
		if parts := strings.Split(title, ":"); len(parts) > 1 {
			title = strings.TrimSpace(parts[1])
		}
		episodes = append(episodes, Episode{
			Number:    epNum,
			Title:     title,
			ScrapeURL: href,
			Duration:  "Unknown",
		})
	})

	sort.SliceStable(episodes, func(i, j int) bool { return episodes[i].Number < episodes[j].Number })
	return episodes, nil
}

// ParseShowFile dynamically fetches a show's URL and parses its HTML into a Show object.
func ParseShowFile(targetUrl string) (*Show, error) {
	// Fetch with a proper User-Agent to avoid being blocked/throttled
	client := &http.Client{}
	req, err := http.NewRequest("GET", targetUrl, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %v", err)
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

	res, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch target URL: %v", err)
	}
	defer res.Body.Close()

	if res.StatusCode != 200 {
		return nil, fmt.Errorf("status code error: %d %s", res.StatusCode, res.Status)
	}

	doc, err := goquery.NewDocumentFromReader(res.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to parse HTML: %v", err)
	}

	// Structural extraction
	title := strings.TrimSpace(doc.Find("h1.film-title, h1.title, h2.heading-name a, h2.heading-name").First().Text())
	desc := strings.TrimSpace(doc.Find(".film-description, .description").First().Text())

	poster, _ := doc.Find(".film-poster img, .poster img, .m_i-d-poster img").First().Attr("src")
	yearRaw := doc.Find(".film-year, .year").First().Text()

	year := 2024
	if len(yearRaw) >= 4 {
		fmt.Sscanf(yearRaw[:4], "%d", &year)
	}

	// Extract genres with a more robust method
	var categories []string
	doc.Find(".row-line, .film-stats .item").Each(func(i int, s *goquery.Selection) {
		text := s.Text()
		if strings.Contains(text, "Genre:") || strings.Contains(text, "Genres:") {
			s.Find("a").Each(func(j int, tag *goquery.Selection) {
				genre := strings.TrimSpace(tag.Text())
				if genre != "" && !strings.Contains(genre, "Genre:") {
					categories = append(categories, genre)
				}
			})
		}
	})

	// Fallback to simpler selector if the loop didn't find anything
	if len(categories) == 0 {
		doc.Find("div.row-line a[href*='/genre/'], .film-genres a, .genres a").Each(func(i int, s *goquery.Selection) {
			genre := strings.TrimSpace(s.Text())
			if genre != "" {
				categories = append(categories, genre)
			}
		})
	}

	// If goquery failed, try the more robust Playwright scraper for description and categories
	if desc == "" || len(categories) == 0 {
		fmt.Println("Metadata incomplete via goquery, trying robust Playwright fallback...")
		meta, err := scraper.GetShowMetadata(targetUrl)
		if err == nil {
			if desc == "" {
				desc = meta.Description
			}
			if len(categories) == 0 {
				categories = meta.Categories
			}
			if year == 2024 && meta.Year != 2024 {
				year = meta.Year
			}
		}
	}

	if len(categories) == 0 {
		categories = []string{"Uncategorized"} // final fallback
	}

	// We create an ID out of the title
	id := strings.ToLower(strings.ReplaceAll(title, " ", "-"))

	show := &Show{
		ID:          id,
		Title:       title,
		Description: desc,
		Categories:  categories,
		PosterURL:   poster,
		HeroURL:     poster, // Default to poster if no hero available organically
		Year:        year,
	}

	// Parse episodes natively
	var seasons []Season
	seasonBuckets := make(map[int][]Episode)

	// Preferred path: episode lists are loaded via AJAX per season using data-id on .ss-item.
	doc.Find(".ss-item").Each(func(_ int, ss *goquery.Selection) {
		rawSeason, hasSeason := ss.Attr("data-ss")
		seasonDataID, hasID := ss.Attr("data-id")
		if !hasSeason || !hasID || strings.TrimSpace(seasonDataID) == "" {
			return
		}
		seasonNum, err := strconv.Atoi(strings.TrimSpace(rawSeason))
		if err != nil || seasonNum <= 0 {
			return
		}

		episodes, err := fetchSeasonEpisodesFromAjax(client, seasonDataID, seasonNum)
		if err != nil || len(episodes) == 0 {
			return
		}
		seasonBuckets[seasonNum] = episodes
	})

	if len(seasonBuckets) == 0 {
		doc.Find(".episodes-list li, .scrolly li, ul#episodes li").Each(func(i int, s *goquery.Selection) {
			epLink, _ := s.Find("a").Attr("href")
			// Clean up episode title: sometimes they include "Eps X :" prefixes
			epTitle := strings.TrimSpace(s.Find("a").First().Text())
			if epTitle == "" {
				epTitle = strings.TrimSpace(s.Text())
			}

			// Clean up the title if it contains "Eps X :"
			if parts := strings.Split(epTitle, ":"); len(parts) > 1 {
				epTitle = strings.TrimSpace(parts[1])
			}

			// Resolve relative links correctly
			if strings.HasPrefix(epLink, "/") {
				epLink = "https://hurawatch.art" + epLink
			}

			seasonNum := 1
			epNum := i + 1

			if rawSeason, ok := s.Attr("data-season"); ok {
				if parsed, err := strconv.Atoi(strings.TrimSpace(rawSeason)); err == nil && parsed > 0 {
					seasonNum = parsed
				}
			}
			if rawEpisode, ok := s.Attr("data-episode"); ok {
				if parsed, err := strconv.Atoi(strings.TrimSpace(rawEpisode)); err == nil && parsed > 0 {
					epNum = parsed
				}
			}

			if parsedSeason, parsedEpisode, ok := parseSeasonEpisode(epLink, epTitle); ok {
				seasonNum = parsedSeason
				epNum = parsedEpisode
			}

			seasonBuckets[seasonNum] = append(seasonBuckets[seasonNum], Episode{
				Number:    epNum,
				Title:     epTitle,
				Duration:  "Unknown",
				ScrapeURL: epLink,
			})
		})
	}

	// Fallback to Playwright if no episodes found via goquery
	if len(seasonBuckets) == 0 {
		fmt.Println("No episodes found via goquery, trying Playwright...")
		pwEps, err := scraper.GetEpisodes(targetUrl)
		if err == nil && len(pwEps) > 0 {
			for i, pwe := range pwEps {
				seasonNum := 1
				epNum := i + 1
				if pwe.Season > 0 {
					seasonNum = pwe.Season
					epNum = pwe.Number
				}
				if parsedSeason, parsedEpisode, ok := parseSeasonEpisode(pwe.URL, pwe.Title); ok {
					seasonNum = parsedSeason
					epNum = parsedEpisode
				}

				seasonBuckets[seasonNum] = append(seasonBuckets[seasonNum], Episode{
					Number:    epNum,
					Title:     pwe.Title,
					ScrapeURL: pwe.URL,
					Duration:  "Unknown",
				})
			}
		} else if err != nil {
			fmt.Printf("Playwright GetEpisodes failed: %v\n", err)
		}
	}

	if len(seasonBuckets) > 0 {
		seasonNumbers := make([]int, 0, len(seasonBuckets))
		for seasonNum := range seasonBuckets {
			seasonNumbers = append(seasonNumbers, seasonNum)
		}
		sort.Ints(seasonNumbers)

		for _, seasonNum := range seasonNumbers {
			episodes := seasonBuckets[seasonNum]
			sort.SliceStable(episodes, func(i, j int) bool {
				return episodes[i].Number < episodes[j].Number
			})
			seasons = append(seasons, Season{
				Number:   seasonNum,
				Episodes: episodes,
			})
		}
		show.Seasons = seasons
	}

	return show, nil
}
