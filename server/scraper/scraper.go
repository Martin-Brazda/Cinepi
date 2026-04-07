package scraper

import (
	"fmt"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/playwright-community/playwright-go"
)

func GetM3u8Url(targetUrl string) []string {
	var urls []string
	var mu sync.Mutex
	foundFirst := make(chan struct{}, 1)

	pw, err := playwright.Run()
	if err != nil {
		fmt.Printf("Could not start playwright: %v\n", err)
		return nil
	}
	defer pw.Stop()

	browser, err := pw.Chromium.Launch(playwright.BrowserTypeLaunchOptions{
		Headless: playwright.Bool(true),
	})
	if err != nil {
		fmt.Printf("Could not launch browser: %v\n", err)
		return nil
	}
	defer browser.Close()

	page, err := browser.NewPage()
	if err != nil {
		fmt.Printf("Could not create page: %v\n", err)
		return nil
	}

	page.On("response", func(response playwright.Response) {
		parsed, err := url.Parse(response.URL())
		if err != nil {
			return
		}
		if strings.HasSuffix(parsed.Path, ".m3u8") {
			mu.Lock()
			urls = append(urls, response.URL())
			mu.Unlock()

			select {
			case foundFirst <- struct{}{}:
			default:
			}
		}
	})

	_, err = page.Goto(targetUrl, playwright.PageGotoOptions{
		Timeout: playwright.Float(60000),
	})
	if err != nil {
		fmt.Printf("Could not navigate: %v\n", err)
	}

	// Wait for the first URL OR a maximum of 10 seconds
	select {
	case <-foundFirst:
		// When found Wait 500ms to catch immediate sub-variants
		time.Sleep(500 * time.Millisecond)
	case <-time.After(10 * time.Second):
	}

	return urls
}

type ShowMetadata struct {
	Description string
	Categories  []string
	Year        int
}

func GetShowMetadata(targetUrl string) (*ShowMetadata, error) {
	pw, err := playwright.Run()
	if err != nil {
		return nil, err
	}
	defer pw.Stop()

	browser, err := pw.Chromium.Launch(playwright.BrowserTypeLaunchOptions{
		Headless: playwright.Bool(true),
	})
	if err != nil {
		return nil, err
	}
	defer browser.Close()

	page, err := browser.NewPage()
	if err != nil {
		return nil, err
	}

	_, err = page.Goto(targetUrl, playwright.PageGotoOptions{
		WaitUntil: playwright.WaitUntilStateNetworkidle,
		Timeout:   playwright.Float(60000),
	})
	if err != nil {
		return nil, err
	}

	// Extract Description
	desc, _ := page.Locator(".film-description, .description").First().InnerText()

	// Extract Genres
	var genres []string
	genreLocators, _ := page.Locator("div.row-line a[href*='/genre/'], .film-genres a, .genres a").All()
	for _, loc := range genreLocators {
		text, _ := loc.InnerText()
		if text != "" {
			genres = append(genres, strings.TrimSpace(text))
		}
	}

	// Extract Year
	year := 2024
	yearText, _ := page.Locator(".film-year, .year").First().InnerText()
	if yearText == "" {
		// Try parsing from the "Released:" row if available
		releasedRow := page.Locator("div.row-line:has-text('Released:')")
		if count, _ := releasedRow.Count(); count > 0 {
			fullText, _ := releasedRow.InnerText()
			// Simple year extraction from "Released: 2022-06-23"
			parts := strings.Split(fullText, ":")
			if len(parts) > 1 {
				dateStr := strings.TrimSpace(parts[1])
				if len(dateStr) >= 4 {
					fmt.Sscanf(dateStr[:4], "%d", &year)
				}
			}
		}
	} else if len(yearText) >= 4 {
		fmt.Sscanf(yearText[:4], "%d", &year)
	}

	return &ShowMetadata{
		Description: strings.TrimSpace(desc),
		Categories:  genres,
		Year:        year,
	}, nil
}

func GetDescription(targetUrl string) (string, error) {
	pw, err := playwright.Run()
	if err != nil {
		fmt.Printf("Could not start playwright: %v\n", err)
		return "", nil
	}
	defer pw.Stop()

	browser, err := pw.Chromium.Launch(playwright.BrowserTypeLaunchOptions{
		Headless: playwright.Bool(true),
	})
	if err != nil {
		fmt.Printf("Could not launch browser: %v\n", err)
		return "", nil
	}
	defer browser.Close()

	page, err := browser.NewPage()
	if err != nil {
		fmt.Printf("Could not create page: %v\n", err)
		return "", nil
	}

	_, err = page.Goto(targetUrl, playwright.PageGotoOptions{
		Timeout: playwright.Float(60000),
	})
	if err != nil {
		fmt.Printf("Could not navigate: %v\n", err)
		return "", err
	}

	// Wait for selector to handle JS-rendered content
	_, _ = page.WaitForSelector(".description", playwright.PageWaitForSelectorOptions{
		Timeout: playwright.Float(10000),
	})

	description, err := page.Locator(".description").TextContent()
	if err != nil {
		fmt.Printf("Could not get description text: %v\n", err)
		return "", err
	}
	fmt.Println(description)

	return description, nil
}

type EpisodeSkeleton struct {
	Season int
	Number int
	Title  string
	URL    string
}

func GetEpisodes(targetUrl string) ([]EpisodeSkeleton, error) {
	pw, err := playwright.Run()
	if err != nil {
		return nil, err
	}
	defer pw.Stop()

	browser, err := pw.Chromium.Launch(playwright.BrowserTypeLaunchOptions{
		Headless: playwright.Bool(true),
	})
	if err != nil {
		return nil, err
	}
	defer browser.Close()

	page, err := browser.NewPage()
	if err != nil {
		return nil, err
	}

	_, err = page.Goto(targetUrl, playwright.PageGotoOptions{
		WaitUntil: playwright.WaitUntilStateNetworkidle,
		Timeout:   playwright.Float(60000),
	})
	if err != nil {
		return nil, err
	}

	extractEpisodes := func(defaultSeason int) []EpisodeSkeleton {
		selectors := []string{".episodes-list li", "ul#episodes li", ".nav-item", ".eps-item"}
		var items []playwright.ElementHandle
		for _, sel := range selectors {
			_, _ = page.WaitForSelector(sel, playwright.PageWaitForSelectorOptions{
				Timeout: playwright.Float(3000),
			})
			found, _ := page.QuerySelectorAll(sel)
			if len(found) > 0 {
				items = found
				break
			}
		}

		var seasonResults []EpisodeSkeleton
		for i, item := range items {
			linkLoc, _ := item.QuerySelector("a")
			if linkLoc == nil {
				linkLoc = item
			}

			title, _ := linkLoc.TextContent()
			href, _ := linkLoc.GetAttribute("href")

			if title != "" && href != "" {
				title = strings.TrimSpace(title)
				if !strings.HasPrefix(href, "http") {
					href = "https://hurawatch.art" + href
				}

				// Clean up "Eps 1 :" prefix
				if parts := strings.Split(title, ":"); len(parts) > 1 {
					title = strings.TrimSpace(parts[1])
				}

				seasonResults = append(seasonResults, EpisodeSkeleton{
					Season: defaultSeason,
					Number: i + 1,
					Title:  title,
					URL:    href,
				})
			}
		}
		return seasonResults
	}

	var results []EpisodeSkeleton
	seen := map[string]struct{}{}

	// First pass: current season (usually active one)
	for _, ep := range extractEpisodes(1) {
		if _, ok := seen[ep.URL]; ok {
			continue
		}
		seen[ep.URL] = struct{}{}
		results = append(results, ep)
	}

	// Try discovering and clicking season controls to collect additional seasons.
	seasonSelectors := []string{
		".ss-item",
		".seasons li",
		".season-item",
		"[data-season]",
		".dropdown-menu a[href*='season']",
	}

	seasonIdx := 2
	for _, sel := range seasonSelectors {
		controls, _ := page.QuerySelectorAll(sel)
		if len(controls) < 2 {
			continue
		}

		for i, control := range controls {
			if i == 0 {
				continue
			}
			_ = control.Click()
			page.WaitForTimeout(350)

			for _, ep := range extractEpisodes(seasonIdx) {
				if _, ok := seen[ep.URL]; ok {
					continue
				}
				seen[ep.URL] = struct{}{}
				results = append(results, ep)
			}
			seasonIdx++
		}
		// First matching selector set is enough.
		break
	}

	return results, nil
}

func GetHomepageTrending() ([]string, error) {
	pw, err := playwright.Run()
	if err != nil {
		return nil, err
	}
	defer pw.Stop()

	browser, err := pw.Chromium.Launch(playwright.BrowserTypeLaunchOptions{
		Headless: playwright.Bool(true),
	})
	if err != nil {
		return nil, err
	}
	defer browser.Close()

	page, err := browser.NewPage()
	if err != nil {
		return nil, err
	}

	_, err = page.Goto("https://hurawatch.art/home", playwright.PageGotoOptions{
		WaitUntil: playwright.WaitUntilStateNetworkidle,
		Timeout:   playwright.Float(60000),
	})
	if err != nil {
		return nil, err
	}

	// Capture all /series/ links
	links, err := page.Locator("a[href*='/series/']").All()
	if err != nil {
		return nil, err
	}

	uniqueUrls := make(map[string]bool)
	for _, link := range links {
		href, _ := link.GetAttribute("href")
		if href != "" && strings.Contains(href, "/series/") {
			if !strings.HasPrefix(href, "http") {
				href = "https://hurawatch.art" + href
			}
			// Clean URL (remove trailing slashes)
			href = strings.TrimSuffix(href, "/")
			uniqueUrls[href] = true
		}
	}

	var results []string
	for url := range uniqueUrls {
		results = append(results, url)
	}

	return results, nil
}
