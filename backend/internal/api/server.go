package api

import (
	"context"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"winterarc/internal/config"
	"winterarc/internal/db"
	"winterarc/internal/ingest"
	"winterarc/internal/plumber"
	"winterarc/internal/sync"
)

type Server struct {
	cfg    *config.Config
	db     *db.DB
	store  *ingest.Store
	sync   *sync.Manager
	plumb  *plumber.Client
	router http.Handler
}

func New(
	cfg *config.Config,
	pg *db.DB,
	store *ingest.Store,
	mgr *sync.Manager,
	plumb *plumber.Client,
	ui http.Handler,
) *Server {
	s := &Server{
		cfg:    cfg,
		db:     pg,
		store:  store,
		sync:   mgr,
		plumb:  plumb,
	}
	s.router = s.routes(ui)
	return s
}

func (s *Server) routes(ui http.Handler) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))

	r.Get("/healthz", s.handleHealthz)

	api := chi.NewRouter()
	api.Use(s.requireKey)
	api.Get("/health", s.handleAPISettings)
	api.Get("/metrics", s.handleListMetrics)
	api.Post("/metrics", s.handleIngest)
	api.Get("/source-health", s.handleSourceHealth)
	api.Post("/sync/run", s.handleSyncRun)
	api.Get("/insights", s.handleListInsights)
	api.Post("/correlations/run", s.handleCorrelate)
	api.Get("/activities", s.handleListActivities)

	r.Mount("/api/v1", api)
	r.Mount("/", ui)
	return r
}

// requireKey gates the API surface with the long-lived shared API key.
func (s *Server) requireKey(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if s.cfg.APIKey == "" {
			next.ServeHTTP(w, r)
			return
		}
		key := r.Header.Get("X-API-Key")
		if key == "" {
			key = r.URL.Query().Get("api_key")
		}
		if key != s.cfg.APIKey {
			w.Header().Set("WWW-Authenticate", "Bearer realm=winterarc")
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.router.ServeHTTP(w, r)
}

func (s *Server) handleHealthz(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()
	if err := s.db.Pool.Ping(ctx); err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "db down", "error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleAPISettings(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "winterarc-backend"})
}