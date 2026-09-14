package strava

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/oauth2"

	"winterarc/internal/config"
	"winterarc/internal/ingest"
)

var Endpoint = oauth2.Endpoint{
	AuthURL:  "https://www.strava.com/oauth/authorize",
	TokenURL: "https://www.strava.com/oauth/token",
}

var ErrNotAuthed = errors.New("strava not authenticated")

const apiBase = "https://www.strava.com/api/v3"

// Limits we trust when deciding to pause a sync run. 150/15min leaves a wide
// margin below Strava's hard 200/15min ceiling.
const shortRateCeiling = 150

type Client struct {
	pool       *pgxpool.Pool
	clientID   string
	clientSecret string
	baseURL    string
	store      *ingest.Store
	httpc      *http.Client
}

func New(pool *pgxpool.Pool, store *ingest.Store, cfg *config.Config) *Client {
	return &Client{
		pool:         pool,
		clientID:     cfg.StravaClientID,
		clientSecret: cfg.StravaClientSecret,
		baseURL:      cfg.BaseURL,
		store:        store,
		httpc:        &http.Client{Timeout: 30 * time.Second},
	}
}

func (c *Client) Name() string { return "strava" }

func (c *Client) OAuthConfig() *oauth2.Config {
	return &oauth2.Config{
		ClientID:     c.clientID,
		ClientSecret: c.clientSecret,
		Endpoint:     Endpoint,
		RedirectURL:  strings.TrimRight(c.baseURL, "/") + "/api/v1/oauth/strava/callback",
		Scopes:       []string{"read", "activity:read_all"},
	}
}

// AuthURL returns the URL to start the browser OAuth dance.
func (c *Client) AuthURL(state string) string {
	return c.OAuthConfig().AuthCodeURL(state, oauth2.SetAuthURLParam("approval_prompt", "auto"))
}

// ExchangeCode swaps an authorization code for tokens and persists them.
func (c *Client) ExchangeCode(ctx context.Context, code string) error {
	tok, err := c.OAuthConfig().Exchange(ctx, code)
	if err != nil {
		return fmt.Errorf("exchange: %w", err)
	}
	return c.persistToken(ctx, tok, 0)
}

type tokenRow struct {
	Access  string
	Refresh string
	Expiry  time.Time
}

func (c *Client) persistToken(ctx context.Context, tok *oauth2.Token, athleteID int64) error {
	exp := time.Now()
	if !tok.Expiry.IsZero() {
		exp = tok.Expiry
	}
	_, err := c.pool.Exec(ctx, `
		INSERT INTO oauth_tokens (source, access_token, refresh_token, expires_at, scope, athlete_id, updated_at)
		VALUES ('strava', $1, $2, $3, $4, $5, now())
		ON CONFLICT (source) DO UPDATE SET
			access_token = EXCLUDED.access_token,
			refresh_token = EXCLUDED.refresh_token,
			expires_at    = EXCLUDED.expires_at,
			scope         = EXCLUDED.scope,
			athlete_id    = EXCLUDED.athlete_id,
			updated_at    = now()`,
		tok.AccessToken, tok.RefreshToken, exp, strings.Join(c.OAuthConfig().Scopes, ","), athleteID)
	return err
}

func (c *Client) loadToken(ctx context.Context) (tokenRow, error) {
	var t tokenRow
	var expires time.Time
	err := c.pool.QueryRow(ctx, `
		SELECT access_token, COALESCE(refresh_token, ''), expires_at
		FROM oauth_tokens WHERE source = 'strava'`).Scan(&t.Access, &t.Refresh, &expires)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return t, ErrNotAuthed
		}
		return t, err
	}
	t.Expiry = expires
	return t, nil
}

// ensureToken returns a valid access token, refreshing and persisting if needed.
func (c *Client) ensureToken(ctx context.Context) (string, error) {
	t, err := c.loadToken(ctx)
	if err != nil {
		return "", err
	}
	if time.Until(t.Expiry) > 5*time.Minute {
		return t.Access, nil
	}
	if t.Refresh == "" {
		return "", errors.New("strava refresh token missing")
	}

	form := url.Values{
		"client_id":     {c.clientID},
		"client_secret": {c.clientSecret},
		"grant_type":    {"refresh_token"},
		"refresh_token": {t.Refresh},
	}
	resp, err := c.httpc.PostForm(Endpoint.TokenURL, form)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		var e struct {
			Message string `json:"message"`
		}
		json.NewDecoder(resp.Body).Decode(&e)
		return "", fmt.Errorf("strava refresh %d: %s", resp.StatusCode, e.Message)
	}
	var tok oauth2.Token
	respBody := struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		ExpiresAt    int64  `json:"expires_at"`
		TokenType    string `json:"token_type"`
		Scope        string `json:"scope"`
		ExpiresIn    int64  `json:"expires_in"`
	}{}
	if err := json.NewDecoder(resp.Body).Decode(&respBody); err != nil {
		return "", err
	}
	tok.AccessToken = respBody.AccessToken
	tok.RefreshToken = respBody.RefreshToken
	tok.Expiry = time.Unix(respBody.ExpiresAt, 0)
	if err := c.persistToken(ctx, &tok, 0); err != nil {
		return "", err
	}
	return tok.AccessToken, nil
}

func (c *Client) TokenStatus(ctx context.Context) (string, error) {
	if c.clientID == "" || c.clientSecret == "" {
		return "unconfigured", nil
	}
	if _, err := c.ensureToken(ctx); err != nil {
		if errors.Is(err, ErrNotAuthed) {
			return "missing", nil
		}
		return "expired", err
	}
	return "ok", nil
}

// get performs an authenticated GET, respecting rate-limit headers. Returns
// the raw body. An error with shortRateExhausted=true tells the caller to stop
// the current run.
func (c *Client) get(ctx context.Context, path string, query url.Values) ([]byte, error) {
	access, err := c.ensureToken(ctx)
	if err != nil {
		return nil, err
	}
	q := url.Values{}
	for k, v := range query {
		q[k] = v
	}
	q.Set("access_token", access)
	u := apiBase + path + "?" + q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.httpc.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	shortUsed, shortLimit, _ := parseRate(resp.Header.Get("X-RateLimit-Usage"), resp.Header.Get("X-RateLimit-Limit"))
	if shortLimit > 0 && shortUsed+5 > shortLimit && shortLimit <= shortRateCeiling {
		return nil, fmt.Errorf("%w: short limit %d/%d", errRateLimit, shortUsed, shortLimit)
	}

	if resp.StatusCode == http.StatusTooManyRequests {
		return nil, fmt.Errorf("%w: 429", errRateLimit)
	}
	if resp.StatusCode == http.StatusUnauthorized {
		return nil, ErrNotAuthed
	}
	if resp.StatusCode != http.StatusOK {
		var e struct {
			Message string `json:"message"`
		}
		json.NewDecoder(resp.Body).Decode(&e)
		return nil, fmt.Errorf("strava %d: %s", resp.StatusCode, e.Message)
	}
	buf := make([]byte, 0, 4096)
	b := make([]byte, 4096)
	for {
		n, err := resp.Body.Read(b)
		buf = append(buf, b[:n]...)
		if err != nil {
			break
		}
	}
	return buf, nil
}

func parseRate(usageHeader, limitHeader string) (used, limit int, err error) {
	u := strings.Split(usageHeader, ",")[0]
	l := strings.Split(limitHeader, ",")[0]
	used, err = strconv.Atoi(strings.TrimSpace(u))
	if err != nil {
		return 0, 0, err
	}
	limit, err = strconv.Atoi(strings.TrimSpace(l))
	if err != nil {
		return 0, 0, err
	}
	return used, limit, nil
}