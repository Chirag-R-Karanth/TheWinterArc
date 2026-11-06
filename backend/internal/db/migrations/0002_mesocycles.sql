-- 0002_mesocycles.sql
-- Structured periodization. Existing metrics and source records are untouched.
CREATE TABLE IF NOT EXISTS mesocycles (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
    goal TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'planned'
        CHECK (status IN ('planned', 'active', 'completed', 'archived')),
    start_date DATE NOT NULL,
    duration_weeks SMALLINT NOT NULL CHECK (duration_weeks BETWEEN 1 AND 52),
    deload_week SMALLINT CHECK (deload_week IS NULL OR deload_week BETWEEN 1 AND duration_weeks),
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (start_date + duration_weeks * 7 > start_date)
);
CREATE INDEX IF NOT EXISTS idx_mesocycles_start ON mesocycles(start_date DESC);

CREATE TABLE IF NOT EXISTS mesocycle_weeks (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mesocycle_id BIGINT NOT NULL REFERENCES mesocycles(id) ON DELETE CASCADE,
    week_number SMALLINT NOT NULL CHECK (week_number BETWEEN 1 AND 52),
    focus TEXT NOT NULL DEFAULT '',
    volume_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.00
        CHECK (volume_multiplier BETWEEN 0.25 AND 2.00),
    target_rir NUMERIC(3,1) CHECK (target_rir BETWEEN 0 AND 10),
    is_deload BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (mesocycle_id, week_number)
);
CREATE INDEX IF NOT EXISTS idx_mesocycle_weeks_cycle
    ON mesocycle_weeks(mesocycle_id, week_number);
