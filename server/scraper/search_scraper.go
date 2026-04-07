package scraper

import (
	"fmt"
	"strings"

	"github.com/playwright-community/playwright-go"
)

type ShowSkeleton struct {
	Title     string
	PosterURL string
	DetailURL string
}

func SearchShows(query string) ([]ShowSkeleton, error) {
	pw, err := playwright.Run()
	if err != nil {
		return nil, fmt.Errorf("could not start playwright: %v", err)
	}
	defer pw.Stop()

	browser, err := pw.Chromium.Launch(playwright.BrowserTypeLaunchOptions{
		Headless: playwright.Bool(true),
	})
	if err != nil {
		return nil, fmt.Errorf("could not launch browser: %v", err)
	}
	defer browser.Close()

	page, err := browser.NewPage()
	if err != nil {
		return nil, fmt.Errorf("could not create page: %v", err)
	}

	searchUrl := fmt.Sprintf("https://hurawatch.art/search?keyword=%s", strings.ReplaceAll(query, " ", "+"))
	fmt.Printf("Searching: %s\n", searchUrl)
	_, err = page.Goto(searchUrl, playwright.PageGotoOptions{
		WaitUntil: playwright.WaitUntilStateNetworkidle,
		Timeout:   playwright.Float(60000),
	})
	if err != nil {
		return nil, fmt.Errorf("could not navigate to search page: %v", err)
	}

	title, _ := page.Title()
	fmt.Printf("Page Title: %s\n", title)

	// Wait for the results container or a small timeout to ensure dynamic content is there
	_, err = page.WaitForSelector(".flw-item", playwright.PageWaitForSelectorOptions{
		Timeout: playwright.Float(10000),
	})
	if err != nil {
		fmt.Printf("WaitForSelector failed: %v\n", err)
	}

	items, err := page.Locator(".flw-item").All()
	if err != nil {
		return nil, fmt.Errorf("could not get items: %v", err)
	}
	fmt.Printf("Found %d items\n", len(items))

	var results []ShowSkeleton
	for _, item := range items {
		titleLoc := item.Locator(".film-name a")
		title, _ := titleLoc.TextContent()
		
		linkLoc := item.Locator(".film-poster-ahref")
		link, _ := linkLoc.GetAttribute("href")
		if !strings.HasPrefix(link, "http") {
			link = "https://hurawatch.art" + link
		}

		imgLoc := item.Locator(".film-poster img")
		poster, _ := imgLoc.GetAttribute("src")

		if title != "" && link != "" {
			results = append(results, ShowSkeleton{
				Title:     strings.TrimSpace(title),
				PosterURL: poster,
				DetailURL: link,
			})
		}
	}

	return results, nil
}
