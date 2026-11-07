package web

import (
	"embed"
	"html/template"
	"io/fs"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"winterarc/internal/config"
	"winterarc/internal/db"
	"winterarc/internal/ingest"
	"winterarc/internal/sync"
)

//go:embed templates static
var FS embed.FS

type Server struct {
	tmpl   *template.Template
	cfg    *config.Config
	db     *db.DB
	store  *ingest.Store
	mgr    *sync.Manager
	log    *slog.Logger
}

func New(cfg *config.Config, pg *db.DB, store *ingest.Store, mgr *sync.Manager, log *slog.Logger) (*Server, error) {
	t, err := template.ParseFS(FS, "templates/*.html", "templates/partials/*.html")
	if err != nil {
		return nil, err
	}
	return &Server{tmpl: t, cfg: cfg, db: pg, store: store, mgr: mgr, log: log}, nil
}

func (s *Server) Routes() http.Handler {
	r := chi.NewRouter()

	r.Get("/", s.overviewPage)
	r.Get("/overview", s.overviewPage)
	r.Get("/trends", s.trendsPage)
	r.Get("/trends/{category}", s.trendsPage)
	r.Get("/correlations", s.correlationsPage)

	staticFS, err := fs.Sub(FS, "static")
	if err != nil {
		panic(err)
	}
	r.Handle("/static/*", http.StripPrefix("/static/", http.FileServer(http.FS(staticFS))))

	return r
}

func (s *Server) render(w http.ResponseWriter, name string, data any) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if err := s.tmpl.ExecuteTemplate(w, name, data); err != nil {
		s.log.Error("template render", "name", name, "error", err)
		http.Error(w, "render error", http.StatusInternalServerError)
	}
}

func (s *Server) html(name string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		s.render(w, name, map[string]any{})
	}
}

type pageData struct {
	Title      string
	Category   string
	Categories []cat
	TitleSet   bool
	Scripts    []string
}

type cat struct {
	Key   string
	Label string
}

var categories = []cat{
	{"training", "Training"},
	{"cardio", "Cardio"},
	{"nutrition", "Nutrition"},
	{"recovery", "Recovery"},
	{"mental", "Mental"},
	{"flexibility", "Flexibility"},
}

func (s *Server) baseData(title, category string) pageData {
	return pageData{
		Title:      title,
		Category:   category,
		TitleSet:   true,
		Categories: categories,
	}
}

func (s *Server) overviewPage(w http.ResponseWriter, r *http.Request) {
	s.render(w, "overview.html", s.pageDataWithScripts("Overview - Winter Arc", "", "/static/js/overview.js"))
}

func (s *Server) trendsPage(w http.ResponseWriter, r *http.Request) {
	category := chi.URLParam(r, "category")
	if category == "" {
		category = "training"
	}
	valid := false
	for _, c := range categories {
		if c.Key == category {
			valid = true
			break
		}
	}
	if !valid {
		http.NotFound(w, r)
		return
	}
	s.render(w, "trends.html", s.pageDataWithScripts("Trends - "+labelFor(category)+" - Winter Arc", category, "/static/js/trends.js"))
}

func labelFor(key string) string {
	for _, c := range categories {
		if c.Key == key {
			return c.Label
		}
	}
	return key
}

func (s *Server) correlationsPage(w http.ResponseWriter, r *http.Request) {
	s.render(w, "correlations.html", s.pageDataWithScripts("Correlations - Winter Arc", "", "/static/js/correlations.js"))
}

func (s *Server) pageDataWithScripts(title, category string, scripts ...string) pageData {
	d := s.baseData(title, category)
	d.Scripts = scripts
	return d
}