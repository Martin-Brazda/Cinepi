package providers

import (
	"os"
	"strings"

	"github.com/Martin-Brazda/Cinepi/scraper"
)

type ShowSkeleton = scraper.ShowSkeleton

type Provider interface {
	Name() string
	Search(query string) ([]ShowSkeleton, error)
	TVCatalog(maxPages, pageWorkers int) ([]string, error)
	MovieCatalog(maxPages, pageWorkers int) ([]string, error)
}

func Active() Provider {
	name := strings.ToLower(strings.TrimSpace(os.Getenv("ACTIVE_PROVIDER")))
	switch name {
	case "", "hurawatch":
		return HurawatchProvider{}
	default:
		return HurawatchProvider{}
	}
}
