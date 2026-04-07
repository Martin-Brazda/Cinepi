package handlers

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

const sessionTTLSeconds = 60 * 60 * 24 * 7
const recommendationCacheTTLSeconds = 60 * 10

type authRequest struct {
	Email    string `json:"email" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type createProfileRequest struct {
	Name      string `json:"name" binding:"required"`
	IsKids    bool   `json:"is_kids"`
	AvatarURL string `json:"avatar_url"`
}

type profileProgressRequest struct {
	EpisodeID uint `json:"episode_id" binding:"required"`
	Progress  int  `json:"progress"`
}

func Register(c *gin.Context) {
	var req authRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	email := strings.ToLower(strings.TrimSpace(req.Email))
	if email == "" || len(req.Password) < 6 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid email or password"})
		return
	}

	hash, _ := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	user := User{Email: email, PasswordHash: string(hash), CreatedAt: time.Now().Unix()}
	if err := DB.Create(&user).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "email already exists"})
		return
	}

	token, tokenHash := newSessionToken()
	now := time.Now().Unix()
	DB.Create(&SessionToken{
		UserID: user.ID, TokenHash: tokenHash, CreatedAt: now, ExpiresAt: now + sessionTTLSeconds,
	})
	c.JSON(http.StatusOK, gin.H{"token": token, "user_id": user.ID})
}

func Login(c *gin.Context) {
	var req authRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	email := strings.ToLower(strings.TrimSpace(req.Email))

	var user User
	if err := DB.First(&user, "email = ?", email).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)) != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	token, tokenHash := newSessionToken()
	now := time.Now().Unix()
	DB.Create(&SessionToken{
		UserID: user.ID, TokenHash: tokenHash, CreatedAt: now, ExpiresAt: now + sessionTTLSeconds,
	})
	c.JSON(http.StatusOK, gin.H{"token": token, "user_id": user.ID})
}

func RefreshSession(c *gin.Context) {
	_, sess, ok := requireAuthSession(c)
	if !ok {
		return
	}
	// rotate token
	sess.RevokedAt = time.Now().Unix()
	DB.Save(sess)

	token, tokenHash := newSessionToken()
	now := time.Now().Unix()
	DB.Create(&SessionToken{
		UserID: sess.UserID, TokenHash: tokenHash, CreatedAt: now, ExpiresAt: now + sessionTTLSeconds,
	})
	c.JSON(http.StatusOK, gin.H{"token": token, "user_id": sess.UserID})
}

func Logout(c *gin.Context) {
	_, sess, ok := requireAuthSession(c)
	if !ok {
		return
	}
	sess.RevokedAt = time.Now().Unix()
	DB.Save(sess)
	c.JSON(http.StatusOK, gin.H{"status": "logged_out"})
}

func LogoutAll(c *gin.Context) {
	user, _, ok := requireAuthSession(c)
	if !ok {
		return
	}
	now := time.Now().Unix()
	DB.Model(&SessionToken{}).Where("user_id = ? AND revoked_at = 0", user.ID).Update("revoked_at", now)
	c.JSON(http.StatusOK, gin.H{"status": "logged_out_all"})
}

func CreateProfile(c *gin.Context) {
	user, ok := requireAuth(c)
	if !ok {
		return
	}
	var req createProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	p := Profile{
		UserID:     user.ID,
		Name:       strings.TrimSpace(req.Name),
		IsKids:     req.IsKids,
		AvatarURL:  strings.TrimSpace(req.AvatarURL),
		CreatedAt:  time.Now().Unix(),
		LastActive: time.Now().Unix(),
	}
	if p.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name required"})
		return
	}
	DB.Create(&p)
	c.JSON(http.StatusOK, p)
}

func ListProfiles(c *gin.Context) {
	user, ok := requireAuth(c)
	if !ok {
		return
	}
	var profiles []Profile
	DB.Where("user_id = ?", user.ID).Order("last_active desc").Find(&profiles)
	c.JSON(http.StatusOK, profiles)
}

func AddMyListItem(c *gin.Context) {
	user, ok := requireAuth(c)
	if !ok {
		return
	}
	profileID, ok := parseProfileIDForUser(c, user.ID)
	if !ok {
		return
	}
	showID := c.Param("showId")
	item := ProfileListItem{ProfileID: profileID, ShowID: showID, CreatedAt: time.Now().Unix()}
	DB.Where(ProfileListItem{ProfileID: profileID, ShowID: showID}).FirstOrCreate(&item)
	c.JSON(http.StatusOK, gin.H{"status": "added"})
}

func RemoveMyListItem(c *gin.Context) {
	user, ok := requireAuth(c)
	if !ok {
		return
	}
	profileID, ok := parseProfileIDForUser(c, user.ID)
	if !ok {
		return
	}
	showID := c.Param("showId")
	DB.Where("profile_id = ? AND show_id = ?", profileID, showID).Delete(&ProfileListItem{})
	c.JSON(http.StatusOK, gin.H{"status": "removed"})
}

func GetMyList(c *gin.Context) {
	user, ok := requireAuth(c)
	if !ok {
		return
	}
	profileID, ok := parseProfileIDForUser(c, user.ID)
	if !ok {
		return
	}
	var items []ProfileListItem
	DB.Where("profile_id = ?", profileID).Order("created_at desc").Find(&items)
	showIDs := make([]string, 0, len(items))
	for _, it := range items {
		showIDs = append(showIDs, it.ShowID)
	}
	var shows []Show
	if len(showIDs) > 0 {
		DB.Where("id IN ?", showIDs).Find(&shows)
	}
	out := make([]ShowListItem, 0, len(shows))
	for _, s := range shows {
		out = append(out, toShowListItem(s))
	}
	c.JSON(http.StatusOK, out)
}

func UpdateProfileProgress(c *gin.Context) {
	user, ok := requireAuth(c)
	if !ok {
		return
	}
	profileID, ok := parseProfileIDForUser(c, user.ID)
	if !ok {
		return
	}
	var req profileProgressRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	if req.Progress < 0 {
		req.Progress = 0
	}
	if req.Progress > 100 {
		req.Progress = 100
	}
	watched := req.Progress >= 95

	row := ProfileEpisodeProgress{
		ProfileID: profileID, EpisodeID: req.EpisodeID,
		Progress: req.Progress, Watched: watched, UpdatedAt: time.Now().Unix(),
	}
	DB.Where(ProfileEpisodeProgress{ProfileID: profileID, EpisodeID: req.EpisodeID}).
		Assign(ProfileEpisodeProgress{Progress: req.Progress, Watched: watched, UpdatedAt: row.UpdatedAt}).
		FirstOrCreate(&row)

	var ep Episode
	if DB.First(&ep, "id = ?", req.EpisodeID).Error == nil {
		var season Season
		if DB.First(&season, "id = ?", ep.SeasonID).Error == nil {
			DB.Create(&WatchEvent{ProfileID: profileID, ShowID: season.ShowID, Weight: req.Progress + 1, CreatedAt: time.Now().Unix()})
		}
	}
	c.JSON(http.StatusOK, gin.H{"status": "success"})
}

func GetContinueWatching(c *gin.Context) {
	user, ok := requireAuth(c)
	if !ok {
		return
	}
	profileID, ok := parseProfileIDForUser(c, user.ID)
	if !ok {
		return
	}
	var rows []ProfileEpisodeProgress
	DB.Where("profile_id = ? AND progress > 0 AND watched = ?", profileID, false).Order("updated_at desc").Limit(200).Find(&rows)

	type item struct {
		ShowID    string       `json:"show_id"`
		Show      ShowListItem `json:"show"`
		EpisodeID uint         `json:"episode_id"`
		Progress  int          `json:"progress"`
		UpdatedAt int64        `json:"updated_at"`
	}
	seen := map[string]bool{}
	out := make([]item, 0)
	for _, r := range rows {
		var ep Episode
		if DB.First(&ep, "id = ?", r.EpisodeID).Error != nil {
			continue
		}
		var season Season
		if DB.First(&season, "id = ?", ep.SeasonID).Error != nil {
			continue
		}
		if seen[season.ShowID] {
			continue
		}
		var show Show
		if DB.First(&show, "id = ?", season.ShowID).Error != nil {
			continue
		}
		seen[season.ShowID] = true
		out = append(out, item{
			ShowID: season.ShowID, Show: toShowListItem(show),
			EpisodeID: ep.ID, Progress: r.Progress, UpdatedAt: r.UpdatedAt,
		})
	}
	c.JSON(http.StatusOK, out)
}

func GetRecommendations(c *gin.Context) {
	user, ok := requireAuth(c)
	if !ok {
		return
	}
	profileID, ok := parseProfileIDForUser(c, user.ID)
	if !ok {
		return
	}

	now := time.Now().Unix()
	var cached []ProfileRecommendation
	DB.Where("profile_id = ? AND updated_at >= ?", profileID, now-recommendationCacheTTLSeconds).
		Order("score desc").Limit(30).Find(&cached)
	if len(cached) > 0 {
		out := make([]ShowListItem, 0, len(cached))
		for _, r := range cached {
			var s Show
			if DB.First(&s, "id = ?", r.ShowID).Error == nil {
				out = append(out, toShowListItem(s))
			}
		}
		c.JSON(http.StatusOK, out)
		return
	}
	out := rebuildRecommendations(profileID, now)
	c.JSON(http.StatusOK, out)
}

func RefreshRecommendations(c *gin.Context) {
	user, ok := requireAuth(c)
	if !ok {
		return
	}
	profileID, ok := parseProfileIDForUser(c, user.ID)
	if !ok {
		return
	}
	go rebuildRecommendations(profileID, time.Now().Unix())
	c.JSON(http.StatusOK, gin.H{"status": "refresh_started"})
}

func rebuildRecommendations(profileID uint, now int64) []ShowListItem {
	type tally struct {
		ShowID string
		Score  int
	}

	var events []WatchEvent
	DB.Where("profile_id = ?", profileID).Order("created_at desc").Limit(1000).Find(&events)
	scores := map[string]int{}
	for _, e := range events {
		scores[e.ShowID] += e.Weight
	}

	var popular []Show
	DB.Limit(50).Find(&popular)
	for _, s := range popular {
		if _, exists := scores[s.ID]; !exists {
			scores[s.ID] += 1
		}
	}

	ranked := make([]tally, 0, len(scores))
	for id, score := range scores {
		ranked = append(ranked, tally{ShowID: id, Score: score})
	}
	sort.SliceStable(ranked, func(i, j int) bool { return ranked[i].Score > ranked[j].Score })

	out := make([]ShowListItem, 0, 30)
	DB.Where("profile_id = ?", profileID).Delete(&ProfileRecommendation{})
	for _, r := range ranked {
		var s Show
		if DB.First(&s, "id = ?", r.ShowID).Error == nil {
			out = append(out, toShowListItem(s))
			DB.Create(&ProfileRecommendation{
				ProfileID: profileID, ShowID: s.ID, Score: r.Score, UpdatedAt: now,
			})
			if len(out) >= 30 {
				break
			}
		}
	}
	return out
}

func GetPlaybackOptions(c *gin.Context) {
	showID := c.Param("id")
	var show Show
	if DB.First(&show, "id = ?", showID).Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "show not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"show_id":         show.ID,
		"qualities":       []string{"auto", "1080p", "720p", "480p"},
		"subtitles":       []string{"off", "en", "es"},
		"default_quality": "auto",
		"auto_next":       true,
	})
}

func GetAutoNext(c *gin.Context) {
	showID := c.Param("id")
	seasonNo := parseIntDefault(c.Query("season"), 1)
	episodeNo := parseIntDefault(c.Query("episode"), 1)
	var season Season
	if DB.First(&season, "show_id = ? AND number = ?", showID, seasonNo).Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "season not found"})
		return
	}
	var next Episode
	if DB.First(&next, "season_id = ? AND number = ?", season.ID, episodeNo+1).Error == nil {
		c.JSON(http.StatusOK, gin.H{"has_next": true, "season": seasonNo, "episode": episodeNo + 1, "episode_id": next.ID})
		return
	}
	var nextSeason Season
	if DB.First(&nextSeason, "show_id = ? AND number = ?", showID, seasonNo+1).Error == nil {
		if DB.First(&next, "season_id = ? AND number = 1", nextSeason.ID).Error == nil {
			c.JSON(http.StatusOK, gin.H{"has_next": true, "season": seasonNo + 1, "episode": 1, "episode_id": next.ID})
			return
		}
	}
	c.JSON(http.StatusOK, gin.H{"has_next": false})
}

func requireAuth(c *gin.Context) (*User, bool) {
	user, _, ok := requireAuthSession(c)
	return user, ok
}

func requireAuthSession(c *gin.Context) (*User, *SessionToken, bool) {
	auth := strings.TrimSpace(c.GetHeader("Authorization"))
	if !strings.HasPrefix(strings.ToLower(auth), "bearer ") {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing bearer token"})
		return nil, nil, false
	}
	token := strings.TrimSpace(auth[7:])
	hash := sha256.Sum256([]byte(token))
	tokenHash := hex.EncodeToString(hash[:])

	var sess SessionToken
	if DB.First(&sess, "token_hash = ?", tokenHash).Error != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
		return nil, nil, false
	}
	now := time.Now().Unix()
	if sess.RevokedAt > 0 || (sess.ExpiresAt > 0 && now > sess.ExpiresAt) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "session expired"})
		return nil, nil, false
	}
	var user User
	if DB.First(&user, "id = ?", sess.UserID).Error != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
		return nil, nil, false
	}
	return &user, &sess, true
}

func parseProfileID(c *gin.Context) (uint, bool) {
	raw := c.Param("profileId")
	v := parseIntDefault(raw, 0)
	if v <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid profile id"})
		return 0, false
	}
	return uint(v), true
}

func parseProfileIDForUser(c *gin.Context, userID uint) (uint, bool) {
	profileID, ok := parseProfileID(c)
	if !ok {
		return 0, false
	}
	var profile Profile
	if DB.First(&profile, "id = ? AND user_id = ?", profileID, userID).Error != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "profile does not belong to user"})
		return 0, false
	}
	return profileID, true
}

func parseIntDefault(raw string, fallback int) int {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return fallback
	}
	n := 0
	for _, ch := range raw {
		if ch < '0' || ch > '9' {
			return fallback
		}
		n = n*10 + int(ch-'0')
	}
	return n
}

func newSessionToken() (string, string) {
	buf := make([]byte, 32)
	_, _ = rand.Read(buf)
	token := hex.EncodeToString(buf)
	hash := sha256.Sum256([]byte(token))
	return token, hex.EncodeToString(hash[:])
}
