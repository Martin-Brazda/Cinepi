package handlers

type Show struct {
	ID          string   `json:"id" gorm:"primaryKey"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Year        int      `json:"year"`
	Categories  []string `json:"categories" gorm:"serializer:json"`
	PosterURL   string   `json:"poster_url"`
	HeroURL     string   `json:"hero_url"`
	ScrapeURL   string   `json:"scrape_url,omitempty"`
	Seasons     []Season `json:"seasons,omitempty" gorm:"foreignKey:ShowID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
}

type Season struct {
	ID       uint      `json:"-" gorm:"primaryKey"`
	ShowID   string    `json:"-" gorm:"index"`
	Number   int       `json:"number"`
	Episodes []Episode `json:"episodes" gorm:"foreignKey:SeasonID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
}

type Episode struct {
	ID          uint   `json:"id" gorm:"primaryKey"`
	SeasonID    uint   `json:"-" gorm:"index"`
	Number      int    `json:"number"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Duration    string `json:"duration"`
	Watched     bool   `json:"watched"`
	Progress    int    `json:"progress"` // percentage
	ScrapeURL   string `json:"scrape_url,omitempty"`
}

type User struct {
	ID           uint      `json:"id" gorm:"primaryKey"`
	Email        string    `json:"email" gorm:"uniqueIndex;not null"`
	PasswordHash string    `json:"-" gorm:"not null"`
	CreatedAt    int64     `json:"created_at"`
	Profiles     []Profile `json:"profiles,omitempty" gorm:"foreignKey:UserID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
}

type Profile struct {
	ID         uint   `json:"id" gorm:"primaryKey"`
	UserID     uint   `json:"user_id" gorm:"index;not null"`
	Name       string `json:"name"`
	IsKids     bool   `json:"is_kids"`
	AvatarURL  string `json:"avatar_url"`
	CreatedAt  int64  `json:"created_at"`
	LastActive int64  `json:"last_active"`
}

type SessionToken struct {
	ID        uint   `json:"id" gorm:"primaryKey"`
	UserID    uint   `json:"user_id" gorm:"index;not null"`
	TokenHash string `json:"-" gorm:"uniqueIndex;not null"`
	CreatedAt int64  `json:"created_at"`
	ExpiresAt int64  `json:"expires_at" gorm:"index"`
	RevokedAt int64  `json:"revoked_at"`
}

type ProfileListItem struct {
	ID        uint   `json:"id" gorm:"primaryKey"`
	ProfileID uint   `json:"profile_id" gorm:"uniqueIndex:idx_profile_show;index;not null"`
	ShowID    string `json:"show_id" gorm:"uniqueIndex:idx_profile_show;index;not null"`
	CreatedAt int64  `json:"created_at"`
}

type ProfileEpisodeProgress struct {
	ID        uint  `json:"id" gorm:"primaryKey"`
	ProfileID uint  `json:"profile_id" gorm:"uniqueIndex:idx_profile_episode;index;not null"`
	EpisodeID uint  `json:"episode_id" gorm:"uniqueIndex:idx_profile_episode;index;not null"`
	Progress  int   `json:"progress"`
	Watched   bool  `json:"watched"`
	UpdatedAt int64 `json:"updated_at"`
}

type WatchEvent struct {
	ID        uint   `json:"id" gorm:"primaryKey"`
	ProfileID uint   `json:"profile_id" gorm:"index;not null"`
	ShowID    string `json:"show_id" gorm:"index;not null"`
	Weight    int    `json:"weight"`
	CreatedAt int64  `json:"created_at"`
}

type ProfileRecommendation struct {
	ID        uint   `json:"id" gorm:"primaryKey"`
	ProfileID uint   `json:"profile_id" gorm:"index"`
	ShowID    string `json:"show_id" gorm:"index"`
	Score     int    `json:"score"`
	UpdatedAt int64  `json:"updated_at" gorm:"index"`
}

type SeedJobRecord struct {
	ID              uint   `json:"id" gorm:"primaryKey"`
	JobType         string `json:"job_type" gorm:"uniqueIndex"`
	State           string `json:"state" gorm:"index"`
	Workers         int    `json:"workers"`
	Discovered      int    `json:"discovered"`
	Queued          int    `json:"queued"`
	Processed       int    `json:"processed"`
	Imported        int    `json:"imported"`
	Failed          int    `json:"failed"`
	LastError       string `json:"last_error"`
	StartedAtUnix   int64  `json:"started_at_unix" gorm:"index"`
	FinishedAtUnix  int64  `json:"finished_at_unix"`
	CancelRequested bool   `json:"cancel_requested" gorm:"index"`
	UpdatedAtUnix   int64  `json:"updated_at_unix" gorm:"index"`
}
