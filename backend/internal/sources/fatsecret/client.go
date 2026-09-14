package fatsecret

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"winterarc/internal/ingest"
)

const apiURL = "https://platform.fatsecret.com/rest/server.api"

type Client struct {
	pool       *pgxpool.Pool
	store      *ingest.Store
	consumerKey   string
	consumerSecret string
	httpc      *http.Client
}

func New(pool *pgxpool.Pool, store *ingest.Store, key, secret string) *Client {
	return &Client{
		pool:           pool,
		store:          store,
		consumerKey:    key,
		consumerSecret: secret,
		httpc:          &http.Client{Timeout: 30 * time.Second},
	}
}

func (c *Client) Name() string { return "fatsecret" }

func (c *Client) TokenStatus(ctx context.Context) (string, error) {
	if c.consumerKey == "" || c.consumerSecret == "" {
		return "unconfigured", nil
	}
	return "ok", nil
}

// Run pulls monthly nutrition summaries and body-weight entries since the last
// successful sync.
func (c *Client) Run(ctx context.Context) error {
	var last time.Time
	err := c.pool.QueryRow(ctx, `
		SELECT GREATEST(COALESCE(last_sync, TIMESTAMPTZ 'epoch'),
		                COALESCE((SELECT MAX(ts_start) FROM metrics WHERE source = 'fatsecret' AND metric_type = 'calories'), TIMESTAMPTZ 'epoch'))
		FROM sync_state WHERE source = 'fatsecret'`).Scan(&last)
	if err != nil && err.Error() != "no rows in result set" {
		return err
	}

	now := time.Now().UTC()
	if last.IsZero() {
		last = now.AddDate(0, -1, 0).Add(-24 * time.Hour)
	}

	for m := monthStart(last); m.Before(monthStart(now).AddDate(0, 1, 0)); m = m.AddDate(0, 1, 0) {
		if err := c.syncDietMonth(ctx, m); err != nil {
			return err
		}
		if err := c.syncWeightMonth(ctx, m); err != nil {
			return err
		}
	}

	_, err = c.pool.Exec(ctx, `
		INSERT INTO sync_state (source, last_sync) VALUES ('fatsecret', now())
		ON CONFLICT (source) DO UPDATE SET last_sync = now()`)
	return err
}

func monthStart(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, time.UTC)
}

func (c *Client) apiGet(ctx context.Context, params map[string]string) ([]byte, error) {
	p := url.Values{}
	p.Set("oauth_consumer_key", c.consumerKey)
	p.Set("oauth_nonce", nonce())
	p.Set("oauth_signature_method", "HMAC-SHA1")
	p.Set("oauth_timestamp", strconv.FormatInt(time.Now().Unix(), 10))
	p.Set("oauth_version", "1.0")
	p.Set("format", "json")
	for k, v := range params {
		p.Set(k, v)
	}
	p.Set("oauth_signature", c.signature("GET", apiURL, p))

	u := apiURL + "?" + p.Encode()
	resp, err := c.httpc.Get(u)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	buf := make([]byte, 0, 4096)
	b := make([]byte, 4096)
	for {
		n, err := resp.Body.Read(b)
		buf = append(buf, b[:n]...)
		if err != nil {
			break
		}
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("fatsecret %d: %s", resp.StatusCode, string(buf))
	}
	return buf, nil
}

func (c *Client) signature(method, baseURL string, params url.Values) string {
	keys := make([]string, 0, len(params))
	for k := range params {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, k := range keys {
		parts = append(parts, url.QueryEscape(k)+"="+url.QueryEscape(params.Get(k)))
	}
	base := strings.ToUpper(method) + "&" + url.QueryEscape(baseURL) + "&" + url.QueryEscape(strings.Join(parts, "&"))
	mac := hmac.New(sha1.New, []byte(c.consumerSecret+"&"))
	mac.Write([]byte(base))
	return base64.StdEncoding.EncodeToString(mac.Sum(nil))
}

func nonce() string {
	b := make([]byte, 16)
	rand.Read(b)
	return fmt.Sprintf("%x", b)
}

type dietEntry struct {
	Date     string `json:"date"`
	Calories string `json:"calories"`
	Carbs    string `json:"carbohydrate"`
	Fat      string `json:"fat"`
	Protein  string `json:"protein"`
}

func (c *Client) syncDietMonth(ctx context.Context, m time.Time) error {
	body, err := c.apiGet(ctx, map[string]string{
		"method": "diet_entries.get_month",
		"month":  fmt.Sprintf("%d-%d", m.Year(), int(m.Month())),
	})
	if err != nil {
		return err
	}
	var resp struct {
		Month struct {
			Entries []dietEntry `json:"diet_entry"`
		} `json:"month"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return fmt.Errorf("fatsecret decode: %w", err)
	}
	for _, e := range resp.Month.Entries {
		if err := c.ingestDietDay(ctx, e); err != nil {
			return err
		}
	}
	return nil
}

func (c *Client) ingestDietDay(ctx context.Context, e dietEntry) error {
	day, err := time.Parse("2006-01-02", e.Date)
	if err != nil {
		return fmt.Errorf("fatsecret date %q: %w", e.Date, err)
	}
	start := day
	end := day.Add(24*time.Hour - time.Second)

	type kv struct {
		metric string
		val    string
		unit   string
	}
	rows := []kv{
		{"calories", e.Calories, "kcal"},
		{"carbohydrates", e.Carbs, "g"},
		{"protein", e.Protein, "g"},
		{"fat", e.Fat, "g"},
	}
	for _, r := range rows {
		f, err := strconv.ParseFloat(r.val, 64)
		if err != nil || (f == 0 && r.val == "") {
			continue
		}
		v := f
		key := "fatsecret_diet_" + r.metric + "_" + e.Date
		if _, err := c.store.Ingest(ctx, ingest.Metric{
			Source:     "fatsecret",
			SourceKey:  key,
			MetricType: r.metric,
			Value:      &v,
			Unit:       r.unit,
			TStart:     start,
			TEnd:       end,
		}); err != nil && err != ingest.ErrDuplicate {
			return err
		}
	}
	return nil
}

type weightEntry struct {
	Date   string `json:"date"`
	Weight string `json:"weight"`
}

func (c *Client) syncWeightMonth(ctx context.Context, m time.Time) error {
	body, err := c.apiGet(ctx, map[string]string{
		"method": "weight.get_month",
		"month":  fmt.Sprintf("%d-%d", m.Year(), int(m.Month())),
	})
	if err != nil {
		return err
	}
	var resp struct {
		Month struct {
			Entries []weightEntry `json:"weight"`
		} `json:"month"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return fmt.Errorf("fatsecret decode weight: %w", err)
	}
	for _, e := range resp.Month.Entries {
		day, err := time.Parse("2006-01-02", e.Date)
		if err != nil {
			continue
		}
		f, err := strconv.ParseFloat(e.Weight, 64)
		if err != nil {
			continue
		}
		v := f
		if _, err := c.store.Ingest(ctx, ingest.Metric{
			Source:     "fatsecret",
			SourceKey:  "fatsecret_weight_" + e.Date,
			MetricType: "body_weight",
			Value:      &v,
			Unit:       "kg",
			TStart:     day,
			TEnd:       day.Add(24*time.Hour - time.Second),
		}); err != nil && err != ingest.ErrDuplicate {
			return err
		}
	}
	return nil
}