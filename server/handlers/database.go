package handlers

import (
	"log"
	"net"
	neturl "net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/pressly/goose/v3"
	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

func LoadDatabase() {
	databaseURL := getDatabaseURL()
	if databaseURL != "" {
		log.Println("Database backend: postgres")
		loadPostgres(databaseURL)
		return
	}
	log.Println("Database backend: sqlite (fallback)")
	loadSQLite()
}

func getDatabaseURL() string {
	databaseURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if databaseURL != "" {
		return databaseURL
	}
	return strings.TrimSpace(os.Getenv("DB_CONN_STRING"))
}

func loadSQLite() {
	db, err := gorm.Open(sqlite.Open("cinepi.db"), &gorm.Config{})
	if err != nil {
		log.Fatalf("failed to connect database: %v", err)
	}

	DB = db

	err = DB.AutoMigrate(
		&Show{}, &Season{}, &Episode{},
		&User{}, &Profile{}, &SessionToken{},
		&ProfileListItem{}, &ProfileEpisodeProgress{}, &WatchEvent{}, &ProfileRecommendation{},
		&SeedJobRecord{},
	)
	if err != nil {
		log.Fatalf("failed to migrate database: %v", err)
	}

	// Initialize mock data if completely empty
	var count int64
	DB.Model(&Show{}).Count(&count)
	if count == 0 {
		log.Println("Database empty...")
	} else {
		log.Printf("Successfully loaded %d shows from SQLite database.", count)
	}
}

func loadPostgres(databaseURL string) {
	connectionURL := databaseURL
	if poolerURL := getPoolerURL(); poolerURL != "" {
		log.Println("Using Supabase pooler URL for Postgres connection.")
		connectionURL = poolerURL
	}
	connectionURL = addIPv4HostAddr(connectionURL)
	db, err := gorm.Open(postgres.Open(connectionURL), &gorm.Config{})
	if err != nil {
		if isNetworkUnreachableError(err) {
			poolerURL := getPoolerURL()
			if poolerURL != "" && poolerURL != connectionURL {
				log.Println("Primary Postgres host unreachable; retrying with pooler URL.")
				connectionURL = addIPv4HostAddr(poolerURL)
				db, err = gorm.Open(postgres.Open(connectionURL), &gorm.Config{})
			}
		}
		if err != nil {
			log.Fatalf("failed to connect postgres database: %v", err)
		}
	}

	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("failed to get postgres sql DB handle: %v", err)
	}

	if err := goose.SetDialect("postgres"); err != nil {
		log.Fatalf("failed to set goose postgres dialect: %v", err)
	}

	migrationsDir := os.Getenv("MIGRATIONS_DIR")
	if migrationsDir == "" {
		migrationsDir = "migrations"
	}
	if !filepath.IsAbs(migrationsDir) {
		if cwd, err := os.Getwd(); err == nil {
			migrationsDir = filepath.Join(cwd, migrationsDir)
		}
	}

	if err := goose.Up(sqlDB, migrationsDir); err != nil {
		log.Fatalf("failed to run goose migrations: %v", err)
	}

	DB = db

	if err := DB.AutoMigrate(
		&Show{}, &Season{}, &Episode{},
		&User{}, &Profile{}, &SessionToken{},
		&ProfileListItem{}, &ProfileEpisodeProgress{}, &WatchEvent{}, &ProfileRecommendation{},
		&SeedJobRecord{},
	); err != nil {
		log.Fatalf("failed to auto-migrate postgres models: %v", err)
	}

	var count int64
	DB.Model(&Show{}).Count(&count)
	log.Printf("Connected to Postgres. Loaded %d shows.", count)
}

func addIPv4HostAddr(databaseURL string) string {
	parsed, err := neturl.Parse(databaseURL)
	if err != nil {
		return databaseURL
	}

	scheme := strings.ToLower(parsed.Scheme)
	if scheme != "postgres" && scheme != "postgresql" {
		return databaseURL
	}

	query := parsed.Query()
	if query.Get("hostaddr") != "" {
		return databaseURL
	}

	host := parsed.Hostname()
	if host == "" {
		return databaseURL
	}

	ips, err := net.LookupIP(host)
	if err != nil {
		return databaseURL
	}

	for _, ip := range ips {
		if ip4 := ip.To4(); ip4 != nil {
			query.Set("hostaddr", ip4.String())
			parsed.RawQuery = query.Encode()
			log.Printf("Using IPv4 hostaddr %s for postgres host %s", ip4.String(), host)
			return parsed.String()
		}
	}
	log.Printf("No IPv4 address found for postgres host %s; keeping original host resolution", host)

	return databaseURL
}

func isNetworkUnreachableError(err error) bool {
	return strings.Contains(strings.ToLower(err.Error()), "network is unreachable")
}

func getPoolerURL() string {
	if value := strings.TrimSpace(os.Getenv("SUPABASE_POOLER_URL")); value != "" {
		return value
	}
	if value := strings.TrimSpace(os.Getenv("DATABASE_POOLER_URL")); value != "" {
		return value
	}
	return ""
}

func AddOrUpdateShow(show Show) error {
	var existing Show
	err := DB.Where("id = ?", show.ID).First(&existing).Error

	if err == gorm.ErrRecordNotFound {
		return DB.Create(&show).Error
	} else if err != nil {
		return err
	}

	// Delete existing seasons recursively defined by the constraint (sqlite requires PRAGMA foreign_keys = ON, but GORM Select handles it if needed)
	// We'll just delete them cleanly using gorm Unscoped to be completely safe replacing the tree
	DB.Where("show_id = ?", show.ID).Delete(&Season{})

	// Replace properties
	existing.Title = show.Title
	existing.Description = show.Description
	existing.Categories = show.Categories
	existing.PosterURL = show.PosterURL
	existing.HeroURL = show.HeroURL
	existing.Year = show.Year
	if show.ScrapeURL != "" {
		existing.ScrapeURL = show.ScrapeURL
	}
	existing.Seasons = show.Seasons

	return DB.Session(&gorm.Session{FullSaveAssociations: true}).Save(&existing).Error
}
