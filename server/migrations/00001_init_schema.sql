-- +goose Up
CREATE TABLE IF NOT EXISTS shows (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    year BIGINT NOT NULL DEFAULT 2024,
    categories JSONB NOT NULL DEFAULT '[]'::jsonb,
    poster_url TEXT NOT NULL DEFAULT '',
    hero_url TEXT NOT NULL DEFAULT '',
    scrape_url TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS seasons (
    id BIGSERIAL PRIMARY KEY,
    show_id TEXT NOT NULL REFERENCES shows(id) ON UPDATE CASCADE ON DELETE CASCADE,
    number BIGINT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_seasons_show_number
    ON seasons(show_id, number);

CREATE INDEX IF NOT EXISTS idx_seasons_show_id
    ON seasons(show_id);

CREATE TABLE IF NOT EXISTS episodes (
    id BIGSERIAL PRIMARY KEY,
    season_id BIGINT NOT NULL REFERENCES seasons(id) ON UPDATE CASCADE ON DELETE CASCADE,
    number BIGINT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    duration TEXT NOT NULL DEFAULT '',
    watched BOOLEAN NOT NULL DEFAULT FALSE,
    progress BIGINT NOT NULL DEFAULT 0,
    scrape_url TEXT NOT NULL DEFAULT ''
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_episodes_season_number
    ON episodes(season_id, number);

CREATE INDEX IF NOT EXISTS idx_episodes_season_id
    ON episodes(season_id);

-- +goose Down
DROP TABLE IF EXISTS episodes;
DROP TABLE IF EXISTS seasons;
DROP TABLE IF EXISTS shows;
