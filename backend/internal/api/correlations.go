package api

import (
	"encoding/json"
	"net/http"
	"time"

	"winterarc/internal/plumber"
)

type correlateRequest struct {
	XMetric string `json:"xMetric"`
	YMetric string `json:"yMetric"`
	From    string `json:"from"`
	To      string `json:"to"`
}

func (s *Server) handleCorrelate(w http.ResponseWriter, r *http.Request) {
	var req correlateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.XMetric == "" || req.YMetric == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "xMetric and yMetric required"})
		return
	}
	if req.From == "" {
		req.From = time.Now().AddDate(0, -6, 0).UTC().Format(time.RFC3339)
	}
	if req.To == "" {
		req.To = time.Now().UTC().Format(time.RFC3339)
	}

	result, err := s.plumb.Correlate(r.Context(), plumber.CorrelateRequest{
		XMetric: req.XMetric,
		YMetric: req.YMetric,
		From:    req.From,
		To:      req.To,
	})
	if err != nil {
		writeJSON(w, http.StatusServiceUnavailable,
			map[string]string{"error": err.Error(), "hint": "R analysis service unavailable; showing stale results"})
		return
	}
	writeJSON(w, http.StatusOK, result)
}