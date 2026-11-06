package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"winterarc/internal/ingest"
)

type metricDTO struct {
	Source     string  `json:"source"`
	SourceKey  string  `json:"sourceKey"`
	MetricType string  `json:"metricType"`
	Value      *float64 `json:"value"`
	Unit       string  `json:"unit"`
	Start      string  `json:"start"`
	StartMS    int64   `json:"startMs"`
	End        string  `json:"end"`
	IsPrimary  bool    `json:"isPrimary"`
}

type ingestRequest struct {
	Source     string  `json:"source"`
	SourceKey  string  `json:"sourceKey"`
	MetricType string  `json:"metricType"`
	Value      *float64 `json:"value"`
	Unit       string  `json:"unit"`
	Start      string  `json:"start"`
	End        string  `json:"end"`
	Raw        json.RawMessage `json:"raw"`
}

func (s *Server) handleIngest(w http.ResponseWriter, r *http.Request) {
	var req ingestRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	if req.Source == "" || req.MetricType == "" || req.Start == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "source, metricType, start required"})
		return
	}
	start, err := time.Parse(time.RFC3339, req.Start)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "start must be RFC3339"})
		return
	}
	end := start
	if req.End != "" {
		end, err = time.Parse(time.RFC3339, req.End)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "end must be RFC3339"})
			return
		}
	}

	res, err := s.store.Ingest(r.Context(), ingest.Metric{
		Source:     req.Source,
		SourceKey:  req.SourceKey,
		MetricType: req.MetricType,
		Value:      req.Value,
		Unit:       req.Unit,
		TStart:     start,
		TEnd:       end,
		Raw:        req.Raw,
	})
	if err != nil {
		if err == ingest.ErrDuplicate {
			writeJSON(w, http.StatusOK, map[string]any{
				"status": "duplicate", "id": res.DupeID, "primary": res.Primary})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status": "ingested", "id": res.ID,
		"primary": res.Primary, "demoted": res.Demoted})
}

func (s *Server) handleListMetrics(w http.ResponseWriter, r *http.Request) {
	opts := ingest.QueryOpts{
		MetricType:  r.URL.Query().Get("metricType"),
		Source:      r.URL.Query().Get("source"),
		From:        parseTime(r.URL.Query().Get("from")),
		To:          parseTime(r.URL.Query().Get("to")),
		PrimaryOnly: r.URL.Query().Get("primaryOnly") != "false",
	}
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			opts.Limit = n
		}
	}
	rows, err := s.store.Query(r.Context(), opts)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	out := make([]metricDTO, 0, len(rows))
	for _, row := range rows {
		out = append(out, metricDTO{
			Source:     row.Source,
			SourceKey:  row.SourceKey,
			MetricType: row.MetricType,
			Value:      row.Value,
			Unit:       row.Unit,
			Start:      row.TStart.UTC().Format(time.RFC3339),
			StartMS:    row.TStart.UTC().UnixMilli(),
			End:        row.TEnd.UTC().Format(time.RFC3339),
			IsPrimary:  row.IsPrimary,
		})
	}
	if out == nil {
		out = []metricDTO{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"metrics": out, "count": len(out)})
}