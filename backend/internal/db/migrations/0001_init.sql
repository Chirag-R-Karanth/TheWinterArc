-- 0001_init.sql
-- Unified metrics table + per-source detail tables + operational tables.

CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Core unified metrics table. Every normalized observation lands here.
CREATE TABLE IF NOT EXISTS metrics (
    id          BIGINT GENERATED ALWAYS AS IDENTITY,
    source      TEXT        NOT NULL,
    source_key  TEXT        NOT NULL,
    metric_type TEXT        NOT NULL,
    value       DOUBLE PRECISION,
    unit        TEXT        NOT NULL DEFAULT '',
    ts_start    TIMESTAMPTZ NOT NULL,
    ts_end      TIMESTAMPTZ NOT NULL,
    is_primary  BOOLEAN     NOT NULL DEFAULT TRUE,
    raw_payload JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- TimescaleDB requires the partition column in every unique key.
    PRIMARY KEY (id, ts_start)
);

SELECT create_hypertable('metrics', 'ts_start', if_not_exists => TRUE);

-- Hypertable rules require all unique indexes to include the partition column.
CREATE UNIQUE INDEX IF NOT EXISTS idx_metrics_source_key
    ON metrics (source, source_key, ts_start);
CREATE INDEX IF NOT EXISTS idx_metrics_type_time
    ON metrics (metric_type, ts_start DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_primary_type_time
    ON metrics (metric_type, is_primary, ts_start DESC);

-- Strava activity detail, including GPS polyline and derived stats.
CREATE TABLE IF NOT EXISTS strava_activities (
    id                     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    strava_id              BIGINT       NOT NULL UNIQUE,
    name                   TEXT,
    activity_type          TEXT,
    workout_type           INTEGER,
    start_date             TIMESTAMPTZ,
    distance_m             DOUBLE PRECISION,
    moving_time_s          INTEGER,
    elapsed_time_s         INTEGER,
    total_elevation_gain_m DOUBLE PRECISION,
    average_speed_ms       DOUBLE PRECISION,
    max_speed_ms           DOUBLE PRECISION,
    average_watts          DOUBLE PRECISION,
    average_heartrate      DOUBLE PRECISION,
    max_heartrate          DOUBLE PRECISION,
    suffer_score           DOUBLE PRECISION,
    summary_polyline       TEXT,
    full_polyline          TEXT,
    encoded_streams        JSONB,
    raw_payload            JSONB,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_strava_activities_date
    ON strava_activities (start_date DESC);

-- Lyfta strength session detail: set / rep / weight breakdown.
CREATE TABLE IF NOT EXISTS lyfta_sessions (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source_id  TEXT        UNIQUE,
    started_at TIMESTAMPTZ,
    ended_at   TIMESTAMPTZ,
    title      TEXT,
    exercises  JSONB,
    raw_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lyfta_sessions_date
    ON lyfta_sessions (started_at DESC);

-- Precomputed analysis results produced by the R/Plumber service.
CREATE TABLE IF NOT EXISTS insights (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    insight_type TEXT        NOT NULL,
    params       JSONB       NOT NULL,
    result       JSONB,
    status       TEXT        NOT NULL DEFAULT 'ok'
                 CHECK (status IN ('ok', 'failed', 'stale')),
    error        TEXT,
    computed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (insight_type, params, status)
);

-- Per-source sync health.
CREATE TABLE IF NOT EXISTS source_health (
    source        TEXT PRIMARY KEY,
    last_success  TIMESTAMPTZ,
    last_attempt  TIMESTAMPTZ,
    last_error    TEXT,
    last_error_at TIMESTAMPTZ,
    token_status  TEXT NOT NULL DEFAULT 'unknown'
                      CHECK (token_status IN ('unknown', 'ok', 'expired', 'missing', 'revoked', 'unconfigured')),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO source_health (source, token_status)
VALUES ('strava', 'unconfigured'), ('fatsecret', 'unconfigured'),
       ('lyfta', 'unconfigured'), ('bend', 'unconfigured'),
       ('howwefeel', 'unconfigured'), ('healthconnect', 'unconfigured')
ON CONFLICT (source) DO NOTHING;

-- Companion device API keys. Long-lived, per-device.
CREATE TABLE IF NOT EXISTS api_keys (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    label      TEXT        NOT NULL,
    key_digest TEXT        NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at TIMESTAMPTZ
);

-- OAuth tokens per source. Tokens rotate on refresh, so we persist every refresh.
CREATE TABLE IF NOT EXISTS oauth_tokens (
    source       TEXT        PRIMARY KEY,
    access_token TEXT        NOT NULL,
    refresh_token TEXT,
    expires_at   TIMESTAMPTZ NOT NULL,
    scope        TEXT        NOT NULL DEFAULT '',
    athlete_id   BIGINT,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Generic per-source sync cursor state.
CREATE TABLE IF NOT EXISTS sync_state (
    source     TEXT PRIMARY KEY,
    last_sync  TIMESTAMPTZ,
    extra      JSONB
);