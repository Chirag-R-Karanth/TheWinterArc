package plumber

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrUnavailable = errors.New("analysis service unavailable")

type Client struct {
	baseURL string
	httpc   *http.Client
	pool    *pgxpool.Pool
}

func New(baseURL string, pool *pgxpool.Pool) *Client {
	return &Client{
		baseURL: baseURL,
		httpc:   &http.Client{Timeout: 60 * time.Second},
		pool:    pool,
	}
}

type CorrelateRequest struct {
	XMetric string `json:"xMetric"`
	YMetric string `json:"yMetric"`
	From    string `json:"from"`
	To      string `json:"to"`
}

type CorrelateResult struct {
	N      int       `json:"n"`
	R      float64   `json:"r"`
	P      float64   `json:"p"`
	Slope  float64   `json:"slope"`
	Intercept float64 `json:"intercept"`
	Points []CorPoint `json:"points"`
}

type CorPoint struct {
	Date   string  `json:"date"`
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
}

// UnmarshalJSON tolerates plumber's serializer, which wraps scalar metrics in
// single-element arrays and renders R's NA as the string "NA" (or null).
func (r *CorrelateResult) UnmarshalJSON(data []byte) error {
	var aux struct {
		N         json.RawMessage `json:"n"`
		R         json.RawMessage `json:"r"`
		P         json.RawMessage `json:"p"`
		Slope     json.RawMessage `json:"slope"`
		Intercept json.RawMessage `json:"intercept"`
		Points    []CorPoint      `json:"points"`
	}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}
	*r = CorrelateResult{
		N:         int(numOrNaN(aux.N)),
		R:         numOrNaN(aux.R),
		P:         numOrNaN(aux.P),
		Slope:     numOrNaN(aux.Slope),
		Intercept: numOrNaN(aux.Intercept),
		Points:    aux.Points,
	}
	return nil
}

// MarshalJSON is NaN-safe: R returns NA when the sample is too small, and
// encoding/json cannot represent NaN/Inf, so those become JSON null.
func (r CorrelateResult) MarshalJSON() ([]byte, error) {
	type flat struct {
		N         int       `json:"n"`
		R         *float64  `json:"r"`
		P         *float64  `json:"p"`
		Slope     *float64  `json:"slope"`
		Intercept *float64  `json:"intercept"`
		Points    []CorPoint `json:"points"`
	}
	fptr := func(v float64) *float64 {
		if math.IsNaN(v) || math.IsInf(v, 0) {
			return nil
		}
		return &v
	}
	return json.Marshal(flat{
		N:         r.N,
		R:         fptr(r.R),
		P:         fptr(r.P),
		Slope:     fptr(r.Slope),
		Intercept: fptr(r.Intercept),
		Points:    r.Points,
	})
}

// numOrNaN parses a plumber-serialized scalar: bare number, single-element
// number array, "NA" string, or null. Anything missing becomes NaN.
func numOrNaN(raw json.RawMessage) float64 {
	if len(raw) == 0 || string(raw) == "null" {
		return math.NaN()
	}
	var s string
	if json.Unmarshal(raw, &s) == nil {
		if s == "NA" {
			return math.NaN()
		}
		if v, err := strconv.ParseFloat(s, 64); err == nil {
			return v
		}
		return math.NaN()
	}
	var arr []float64
	if json.Unmarshal(raw, &arr) == nil {
		if len(arr) > 0 {
			return arr[0]
		}
		return math.NaN()
	}
	var f float64
	if err := json.Unmarshal(raw, &f); err != nil {
		return math.NaN()
	}
	return f
}

// Correlate calls the R service and stores the result as an insight. R is
// treated as unreliable: any failure returns ErrUnavailable so callers never
// block the dashboard.
func (c *Client) Correlate(ctx context.Context, req CorrelateRequest) (*CorrelateResult, error) {
	params := map[string]string{
		"xMetric": req.XMetric,
		"yMetric": req.YMetric,
		"from":    req.From,
		"to":      req.To,
	}
	body, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost,
		c.baseURL+"/correlate", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpc.Do(httpReq)
	if err != nil {
		_ = c.storeInsight(ctx, "correlation", params, nil, "analysis unavailable: "+err.Error())
		return nil, fmt.Errorf("%w: %v", ErrUnavailable, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		_ = c.storeInsight(ctx, "correlation", params, nil,
			fmt.Sprintf("analysis returned %d", resp.StatusCode))
		return nil, fmt.Errorf("%w: status %d", ErrUnavailable, resp.StatusCode)
	}

	var result CorrelateResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		_ = c.storeInsight(ctx, "correlation", params, nil, "bad analysis response")
		return nil, fmt.Errorf("%w: %v", ErrUnavailable, err)
	}
	err = c.storeInsight(ctx, "correlation", params, result, "")
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// ListInsights returns the most recent stored results for the dashboard.
func (c *Client) ListInsights(ctx context.Context) ([]json.RawMessage, error) {
	rows, err := c.pool.Query(ctx, `
		SELECT coalesce(result, '{}'::jsonb)
		FROM insights
		WHERE status = 'ok'
		ORDER BY computed_at DESC
		LIMIT 50`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]json.RawMessage, 0, 16)
	for rows.Next() {
		var b []byte
		if err := rows.Scan(&b); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

func (c *Client) storeInsight(ctx context.Context, kind string, params any, result any, errMsg string) error {
	pb, err := json.Marshal(params)
	if err != nil {
		return err
	}
	status := "ok"
	if errMsg != "" {
		status = "failed"
	}
	var rb []byte
	if result != nil {
		rb, _ = json.Marshal(result)
	}
	_, err = c.pool.Exec(ctx, `
		INSERT INTO insights (insight_type, params, result, status, error, computed_at)
		VALUES ($1, $2, $3, $4, $5, now())
		ON CONFLICT (insight_type, params, status) DO UPDATE SET
			result = EXCLUDED.result,
			error = EXCLUDED.error,
			computed_at = now()`,
		kind, pb, rb, status, errMsg)
	return err
}