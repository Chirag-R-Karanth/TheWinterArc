package api

import (
	"encoding/json"
	"net/http"
	"strings"
)

type sourceHealthDTO struct {
	Source       string `json:"source"`
	LastSuccess  string `json:"lastSuccess"`
	LastAttempt  string `json:"lastAttempt"`
	LastError    string `json:"lastError"`
	LastErrorAt  string `json:"lastErrorAt"`
	TokenStatus  string `json:"tokenStatus"`
}

func (s *Server) handleSourceHealth(w http.ResponseWriter, r *http.Request) {
	rows, err := s.sync.HealthAll(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	out := make([]sourceHealthDTO, 0, len(rows))
	for _, h := range rows {
		out = append(out, sourceHealthDTO{
			Source:      h.Source,
			LastSuccess: fmtTime(h.LastSuccess),
			LastAttempt: fmtTime(h.LastAttempt),
			LastError:   h.LastError,
			LastErrorAt: fmtTime(h.LastErrorAt),
			TokenStatus: h.TokenStatus,
		})
	}
	if out == nil {
		out = []sourceHealthDTO{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"sources": out})
}

func (s *Server) handleSyncRun(w http.ResponseWriter, r *http.Request) {
	source := r.URL.Query().Get("source")
	if source == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "source query param required"})
		return
	}
	if err := s.sync.Run(r.Context(), strings.ToLower(source)); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "source": source})
}

func (s *Server) handleListInsights(w http.ResponseWriter, r *http.Request) {
	rows, err := s.plumb.ListInsights(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if rows == nil {
		rows = []json.RawMessage{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"insights": rows})
}