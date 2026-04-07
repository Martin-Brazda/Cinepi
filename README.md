# Cinepi

## Database setup

The backend supports:

- SQLite (default): uses `server/cinepi.db`
- Postgres (recommended for larger catalogs): uses goose migrations

### Run Postgres locally

From repo root:

```bash
docker compose up -d postgres
```

### Run backend against Postgres

From `server`:

```bash
export DATABASE_URL="postgres://cinepi:cinepi@localhost:5432/cinepi?sslmode=disable"
go run main.go
```

On startup, goose migrations in `server/migrations` are applied automatically.

If `DATABASE_URL` is not set, the backend falls back to SQLite and `AutoMigrate`.
