-- +goose Up
-- +goose StatementBegin
CREATE INDEX IF NOT EXISTS idx_shows_lower_title ON shows (LOWER(title));
CREATE INDEX IF NOT EXISTS idx_shows_year ON shows (year);
-- +goose StatementEnd

-- +goose StatementBegin
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
        CREATE INDEX IF NOT EXISTS idx_shows_title_trgm ON shows USING gin (title gin_trgm_ops);
    END IF;
END $$;
-- +goose StatementEnd

-- +goose StatementBegin
CREATE INDEX IF NOT EXISTS idx_shows_search_tsv
ON shows USING gin (to_tsvector('simple', COALESCE(title,'') || ' ' || COALESCE(description,'')));
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS idx_shows_search_tsv;
DROP INDEX IF EXISTS idx_shows_title_trgm;
DROP INDEX IF EXISTS idx_shows_year;
DROP INDEX IF EXISTS idx_shows_lower_title;
-- +goose StatementEnd
