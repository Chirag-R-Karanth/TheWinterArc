package sources

import (
	"context"
	"fmt"

	"winterarc/internal/sync"
)

// UnconfiguredProvider is a placeholder for sources where an API isn't yet
// available. It satisfies the Provider interface and immediately reports
// status "unconfigured" so the sync-health indicator is accurate.
func UnconfiguredProvider(name string) sync.Provider {
	return &unconfigured{source: name}
}

type unconfigured struct {
	source string
}

func (u *unconfigured) Name() string { return u.source }
func (u *unconfigured) Run(ctx context.Context) error {
	return fmt.Errorf("%s: no data source configured", u.source)
}
func (u *unconfigured) TokenStatus(ctx context.Context) (string, error) {
	return "unconfigured", nil
}