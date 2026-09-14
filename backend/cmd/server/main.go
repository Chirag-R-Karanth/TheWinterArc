package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"winterarc/internal/api"
	"winterarc/internal/config"
	"winterarc/internal/db"
	"winterarc/internal/ingest"
	"winterarc/internal/plumber"
	"winterarc/internal/sources"
	"winterarc/internal/sources/fatsecret"
	"winterarc/internal/sync"
	"winterarc/internal/web"
)

func main() {
	log := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(log)

	cfg := config.Load()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	pg, err := db.Connect(ctx, cfg.DBHost, cfg.DBPort, cfg.DBUser, cfg.DBPassword, cfg.DBName)
	if err != nil {
		log.Error("db connect failed", "error", err)
		os.Exit(1)
	}
	defer pg.Close()

	if err := pg.Migrate(ctx); err != nil {
		log.Error("migrate failed", "error", err)
		os.Exit(1)
	}

	store := ingest.NewStore(pg.Pool)
	mgr := sync.NewManager(pg.Pool, cfg.SyncInterval, log)

	mgr.Register(fatsecret.New(pg.Pool, store, cfg.FatSecretKey, cfg.FatSecretSecret))
	mgr.Register(sources.UnconfiguredProvider("lyfta"))
	mgr.Register(sources.UnconfiguredProvider("bend"))
	mgr.Register(sources.UnconfiguredProvider("howwefeel"))
	mgr.Register(sources.UnconfiguredProvider("healthconnect"))

	plumb := plumber.New(cfg.PlumberURL, pg.Pool)

	ui, err := web.New(cfg, pg, store, mgr, log)
	if err != nil {
		log.Error("web init failed", "error", err)
		os.Exit(1)
	}

	srv := api.New(cfg, pg, store, mgr, plumb, ui.Routes())

	httpServer := &http.Server{
		Addr:              cfg.ListenAddr,
		Handler:           srv,
		ReadHeaderTimeout: 5 * time.Second,
	}

	stopSync := mgr.Start(ctx)
	defer stopSync()

	go func() {
		log.Info("listening", "addr", cfg.ListenAddr)
		if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Error("http server error", "error", err)
			cancel()
		}
	}()

	// Ongoing-hourly correlation precompute loop. R is optional; failures are
	// recorded as failed insights and never crash the server.
	startInsightLoop(ctx, plumb, log)

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	<-sig

	log.Info("shutting down")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	_ = httpServer.Shutdown(shutdownCtx)
}

func startInsightLoop(ctx context.Context, plumb *plumber.Client, log *slog.Logger) {
	go func() {
		t := time.NewTicker(6 * time.Hour)
		defer t.Stop()
		if err := computeInsights(ctx, plumb); err != nil {
			log.Warn("insights precompute", "error", err)
		}
		for {
			select {
			case <-ctx.Done():
				return
			case <-t.C:
				if err := computeInsights(ctx, plumb); err != nil {
					log.Warn("insights precompute", "error", err)
				}
			}
		}
	}()
}

func computeInsights(ctx context.Context, plumb *plumber.Client) error {
	sets := [][2]string{
		{"sleep", "workout_cardio"},
		{"mood", "workout_duration"},
		{"steps", "mood"},
		{"sleep", "mood"},
	}
	for _, pair := range sets {
		_, err := plumb.Correlate(ctx, plumber.CorrelateRequest{
			XMetric: pair[0],
			YMetric: pair[1],
			From:    time.Now().AddDate(0, -6, 0).UTC().Format(time.RFC3339),
			To:      time.Now().UTC().Format(time.RFC3339),
		})
		if err != nil {
			return err
		}
	}
	return nil
}