package sync

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Health struct {
	Source      string
	LastSuccess time.Time
	LastAttempt time.Time
	LastError   string
	LastErrorAt time.Time
	TokenStatus string
}

// Provider is implemented by each data source integration.
type Provider interface {
	Name() string
	// Run performs one full sync pass for the source.
	Run(ctx context.Context) error
	// TokenStatus reports whether the source credentials look healthy. Returns
	// "ok" or a human-readable problem string.
	TokenStatus(ctx context.Context) (string, error)
}

// Manager runs provider syncs on a schedule and tracks per-source health.
type Manager struct {
	pool     *pgxpool.Pool
	providers map[string]Provider
	interval time.Duration
	log      *slog.Logger
}

func NewManager(pool *pgxpool.Pool, interval time.Duration, log *slog.Logger) *Manager {
	return &Manager{
		pool:      pool,
		providers: map[string]Provider{},
		interval:  interval,
		log:       log,
	}
}

func (m *Manager) Register(p Provider) {
	m.providers[p.Name()] = p
}

func (m *Manager) Providers() []string {
	out := make([]string, 0, len(m.providers))
	for name := range m.providers {
		out = append(out, name)
	}
	return out
}

// Run triggers a sync for a single source. Unconfigured providers report an
// error so the source-health indicator shows the failure.
func (m *Manager) Run(ctx context.Context, name string) error {
	p, ok := m.providers[name]
	if !ok {
		return fmt.Errorf("unknown source %q", name)
	}
	return m.syncOne(ctx, p)
}

func (m *Manager) syncOne(ctx context.Context, p Provider) error {
	tok, err := p.TokenStatus(ctx)
	if err != nil {
		tok = "error"
	}
	if tok != "ok" {
		msg := "source not configured or token missing"
		if err := m.recordFailure(ctx, p.Name(), tok, msg); err != nil {
			m.log.Error("record failure", "source", p.Name(), "error", err)
		}
		return fmt.Errorf("%s: %s: %s", p.Name(), msg, tok)
	}

	if err := p.Run(ctx); err != nil {
		_ = m.recordFailure(ctx, p.Name(), tok, err.Error())
		return err
	}
	return m.recordSuccess(ctx, p.Name())
}

// RunAll syncs every registered provider sequentially.
func (m *Manager) RunAll(ctx context.Context) {
	for name, p := range m.providers {
		if err := m.syncOne(ctx, p); err != nil {
			m.log.Warn("sync failed", "source", name, "error", err)
		}
	}
}

// Start launches the hourly loop. Returns a cancel func.
func (m *Manager) Start(parent context.Context) func() {
	ctx, cancel := context.WithCancel(parent)
	go func() {
		t := time.NewTicker(m.interval)
		defer t.Stop()
		m.RunAll(ctx)
		for {
			select {
			case <-ctx.Done():
				return
			case <-t.C:
				m.RunAll(ctx)
			}
		}
	}()
	return cancel
}

func (m *Manager) HealthAll(ctx context.Context) ([]Health, error) {
	rows, err := m.pool.Query(ctx, `
		SELECT source, last_success, last_attempt, last_error, last_error_at, token_status
		FROM source_health ORDER BY source`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]Health, 0)
	for rows.Next() {
		var h Health
		var lastSuccess, lastAttempt, lastErrorAt *time.Time
		if err := rows.Scan(&h.Source, &lastSuccess, &lastAttempt,
			&h.LastError, &lastErrorAt, &h.TokenStatus); err != nil {
			return nil, err
		}
		if lastSuccess != nil {
			h.LastSuccess = *lastSuccess
		}
		if lastAttempt != nil {
			h.LastAttempt = *lastAttempt
		}
		if lastErrorAt != nil {
			h.LastErrorAt = *lastErrorAt
		}
		out = append(out, h)
	}
	return out, rows.Err()
}

func (m *Manager) recordFailure(ctx context.Context, source, token, errMsg string) error {
	_, err := m.pool.Exec(ctx, `
		UPDATE source_health
		SET last_attempt = $1, last_error = $2, last_error_at = $1, token_status = $3,
			updated_at = $1
		WHERE source = $4`,
		time.Now().UTC(), errMsg, token, source)
	return err
}

func (m *Manager) recordSuccess(ctx context.Context, source string) error {
	_, err := m.pool.Exec(ctx, `
		UPDATE source_health
		SET last_success = $1, last_error = NULL, last_error_at = NULL,
			token_status = 'ok', updated_at = $1
		WHERE source = $2`,
		time.Now().UTC(), source)
	return err
}