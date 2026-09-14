package ingest

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrDuplicate = errors.New("duplicate")

// primarySource maps a metric type to its authoritative source. Resolution is
// per metric type, never global: for example Lyfta wins for strength work while
// Health Connect wins for steps, even when both overlap in time.
var primarySource = map[string]string{
	"sleep":            "healthconnect",
	"steps":            "healthconnect",
	"heart_rate":       "healthconnect",
	"hrv":              "healthconnect",
	"calories":         "fatsecret",
	"body_weight":      "fatsecret",
	"carbohydrates":    "fatsecret",
	"protein":          "fatsecret",
	"fat":              "fatsecret",
	"workout_strength": "lyfta",
	"workout_cardio":   "strava",
	"workout_flex":     "bend",
	"mood":             "howwefeel",
}

// rankFor computes the precedence rank of a source for a metric type. Higher
// wins. Unknown pairings default to rank 1, in which case the incumbent primary
// wins ties (first-come-first-served) to avoid flip-flopping.
func rankFor(metricType, source string) int {
	if primarySource[metricType] == source {
		return 10
	}
	return 1
}

type Metric struct {
	Source     string
	SourceKey  string
	MetricType string
	Value      *float64
	Unit       string
	TStart     time.Time
	TEnd       time.Time
	Raw        json.RawMessage
}

type Result struct {
	Inserted bool
	Primary  bool
	ID       int64
	DupeID   int64
	Demoted  int
}

type Row struct {
	ID         int64
	Source     string
	SourceKey  string
	MetricType string
	Value      *float64
	Unit       string
	TStart     time.Time
	TEnd       time.Time
	IsPrimary  bool
	Raw        json.RawMessage
}

type Store struct {
	pool *pgxpool.Pool
}

func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

// Ingest stores one normalized metric, resolving source precedence and
// deduplicating overlaps. Duplicates are retained but never marked primary.
// Source+SourceKey provides idempotency: re-ingesting the same source record is
// a no-op.
func (s *Store) Ingest(ctx context.Context, m Metric) (Result, error) {
	var res Result

	var dupeID int64
	var primary bool
	err := s.pool.QueryRow(ctx,
		`SELECT id, is_primary FROM metrics WHERE source = $1 AND source_key = $2`,
		m.Source, m.SourceKey,
	).Scan(&dupeID, &primary)
	switch {
	case err == nil:
		return Result{Inserted: false, Primary: primary, DupeID: dupeID}, ErrDuplicate
	case !errors.Is(err, pgx.ErrNoRows):
		return res, fmt.Errorf("dup check: %w", err)
	}

	if m.TEnd.IsZero() {
		m.TEnd = m.TStart
	}
	if m.Unit == "" {
		m.Unit = ""
	}

	incomingRank := rankFor(m.MetricType, m.Source)

	type clash struct {
		id     int64
		source string
	}
	var clashes []clash
	rows, err := s.pool.Query(ctx, `
		SELECT id, source FROM metrics
		WHERE metric_type = $1
		  AND is_primary = TRUE
		  AND ts_start < $2
		  AND ts_end > $3`,
		m.MetricType, m.TEnd, m.TStart)
	if err != nil {
		return res, fmt.Errorf("overlap scan: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var c clash
		if err := rows.Scan(&c.id, &c.source); err != nil {
			return res, err
		}
		clashes = append(clashes, c)
	}
	if err := rows.Err(); err != nil {
		return res, err
	}

	winner := true
	for _, c := range clashes {
		if incomingRank <= rankFor(m.MetricType, c.source) {
			winner = false
			break
		}
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return res, err
	}
	defer tx.Rollback(ctx)

	demoted := 0
	if winner {
		for _, c := range clashes {
			tag, err := tx.Exec(ctx,
				`UPDATE metrics SET is_primary = FALSE WHERE id = $1`, c.id)
			if err != nil {
				return res, err
			}
			demoted += int(tag.RowsAffected())
		}
	}

	var raw any
	if len(m.Raw) > 0 && string(m.Raw) != "null" {
		raw = json.RawMessage(m.Raw)
	}

	err = tx.QueryRow(ctx, `
		INSERT INTO metrics (source, source_key, metric_type, value, unit, ts_start, ts_end, is_primary, raw_payload)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id`,
		m.Source, m.SourceKey, m.MetricType, m.Value, m.Unit,
		m.TStart.UTC(), m.TEnd.UTC(), winner, raw,
	).Scan(&res.ID)
	if err != nil {
		return res, fmt.Errorf("insert: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return res, err
	}

	res.Inserted = true
	res.Primary = winner
	res.Demoted = demoted
	return res, nil
}

type QueryOpts struct {
	MetricType string
	Source     string
	From       time.Time
	To         time.Time
	PrimaryOnly bool
	Limit      int
}

func (s *Store) Query(ctx context.Context, o QueryOpts) ([]Row, error) {
	stmt := `
		SELECT id, source, source_key, metric_type, value, unit, ts_start, ts_end, is_primary, raw_payload
		FROM metrics
		WHERE TRUE`
	var args []any
	i := 1
	if o.MetricType != "" {
		stmt += fmt.Sprintf(` AND metric_type = $%d`, i)
		args = append(args, o.MetricType)
		i++
	}
	if o.Source != "" {
		stmt += fmt.Sprintf(` AND source = $%d`, i)
		args = append(args, o.Source)
		i++
	}
	if !o.From.IsZero() {
		stmt += fmt.Sprintf(` AND ts_start >= $%d`, i)
		args = append(args, o.From.UTC())
		i++
	}
	if !o.To.IsZero() {
		stmt += fmt.Sprintf(` AND ts_start <= $%d`, i)
		args = append(args, o.To.UTC())
		i++
	}
	if o.PrimaryOnly {
		stmt += ` AND is_primary = TRUE`
	}
	if o.Limit > 0 {
		stmt += fmt.Sprintf(` ORDER BY ts_start DESC LIMIT %d`, o.Limit)
	} else {
		stmt += ` ORDER BY ts_start ASC`
	}

	rows, err := s.pool.Query(ctx, stmt, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]Row, 0)
	for rows.Next() {
		var r Row
		var raw []byte
		if err := rows.Scan(&r.ID, &r.Source, &r.SourceKey, &r.MetricType,
			&r.Value, &r.Unit, &r.TStart, &r.TEnd, &r.IsPrimary, &raw); err != nil {
			return nil, err
		}
		if len(raw) > 0 {
			r.Raw = json.RawMessage(raw)
		}
		out = append(out, r)
	}
	return out, rows.Err()
}