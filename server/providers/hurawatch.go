package providers

import "github.com/Martin-Brazda/Cinepi/scraper"

type HurawatchProvider struct{}

func (HurawatchProvider) Name() string { return "hurawatch" }

func (HurawatchProvider) Search(query string) ([]ShowSkeleton, error) {
	return scraper.SearchShows(query)
}

func (HurawatchProvider) TVCatalog(maxPages, pageWorkers int) ([]string, error) {
	return scraper.GetTVSeriesURLs(maxPages, pageWorkers)
}

func (HurawatchProvider) MovieCatalog(maxPages, pageWorkers int) ([]string, error) {
	return scraper.GetMovieURLs(maxPages, pageWorkers)
}
