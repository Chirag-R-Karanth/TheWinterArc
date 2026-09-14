package strava

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"strconv"
	"time"

	"winterarc/internal/ingest"
)

type Activity struct {
	ID                 int64   `json:"id"`
	Name               string  `json:"name"`
	Type               string  `json:"type"`
	WorkoutType        *int    `json:"workout_type"`
	StartDate          string  `json:"start_date"`
	Distance           float64 `json:"distance"`
	MovingTime         int     `json:"moving_time"`
	ElapsedTime        int     `json:"elapsed_time"`
	TotalElevationGain float64 `json:"total_elevation_gain"`
	AverageSpeed       float64 `json:"average_speed"`
	MaxSpeed           float64 `json:"max_speed"`
	AverageWatts       float64 `json:"average_watts"`
	AverageHeartrate   float64 `json:"average_heartrate"`
	MaxHeartrate       float64 `json:"max_heartrate"`
	SufferScore        float64 `json:"suffer_score"`
	Map                struct {
		SummaryPolyline string `json:"summary_polyline"`
	} `json:"map"`
}

// Run syncs Strava activities since the last successful sync (or the last 30
// days on first sync), storing detail rows and normalized metrics.
func (c *Client) Run(ctx context.Context) error {
	after := time.Now().UTC().Add(-30 * 24 * time.Hour)
	var last time.Time
	err := c.pool.QueryRow(ctx, `SELECT COALESCE(MAX(start_date), TIMESTAMPTZ 'epoch') FROM strava_activities`).Scan(&last)
	if err != nil {
		return err
	}
	if !last.IsZero() && last.After(after) {
		after = last.Add(-time.Hour)
	}

	var newCount int
	for page := 1; ; page++ {
		q := url.Values{}
		q.Set("per_page", "100")
		q.Set("after", strconv.FormatInt(after.Unix(), 10))
		q.Set("page", strconv.Itoa(page))

		body, err := c.get(ctx, "/athlete/activities", q)
		if err != nil {
			if errors.Is(err, ErrNotAuthed) {
				return err
			}
			// Rate-limit or transient failure: keep what we have.
			if page == 1 && errors.Is(err, errRateLimit) {
				return err
			}
			break
		}

		var acts []Activity
		if err := json.Unmarshal(body, &acts); err != nil {
			return fmt.Errorf("strava decode: %w", err)
		}
		if len(acts) == 0 {
			break
		}
		for i := range acts {
			if err := c.storeActivity(ctx, &acts[i]); err != nil {
				if errors.Is(err, errRateLimit) {
					return nil
				}
				return err
			}
			newCount++
		}
		if len(acts) < 100 {
			break
		}
	}

	_, err = c.pool.Exec(ctx, `
		INSERT INTO sync_state (source, last_sync, extra)
		VALUES ('strava', now(), NULL)
		ON CONFLICT (source) DO UPDATE SET last_sync = now()`)
	if err != nil {
		return err
	}
	if newCount == 0 {
		return nil
	}
	return nil
}

var errRateLimit = errors.New("strava rate limit")

func (c *Client) storeActivity(ctx context.Context, a *Activity) error {
	start, err := time.Parse(time.RFC3339, a.StartDate)
	if err != nil {
		return fmt.Errorf("strava bad start_date %q: %w", a.StartDate, err)
	}

	raw, _ := json.Marshal(a)

	// Full detail adds polyline + split data; best-effort, rate limits may halt it.
	polyline := a.Map.SummaryPolyline
	if body, err := c.get(ctx, "/activities/"+strconv.FormatInt(a.ID, 10), nil); err == nil {
		var full struct {
			Map struct {
				SummaryPolyline string `json:"summary_polyline"`
				Polyline        string `json:"polyline"`
			} `json:"map"`
		}
		if json.Unmarshal(body, &full) == nil {
			if full.Map.Polyline != "" {
				polyline = full.Map.Polyline
			} else if full.Map.SummaryPolyline != "" {
				polyline = full.Map.SummaryPolyline
			}
		}
	}

	_, err = c.pool.Exec(ctx, `
		INSERT INTO strava_activities
			(strava_id, name, activity_type, workout_type, start_date, distance_m,
			 moving_time_s, elapsed_time_s, total_elevation_gain_m, average_speed_ms,
			 max_speed_ms, average_watts, average_heartrate, max_heartrate,
			 suffer_score, summary_polyline, full_polyline, raw_payload)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
		ON CONFLICT (strava_id) DO UPDATE SET
			name                = EXCLUDED.name,
			activity_type       = EXCLUDED.activity_type,
			start_date          = EXCLUDED.start_date,
			distance_m          = EXCLUDED.distance_m,
			moving_time_s       = EXCLUDED.moving_time_s,
			elapsed_time_s      = EXCLUDED.elapsed_time_s,
			total_elevation_gain_m = EXCLUDED.total_elevation_gain_m,
			average_speed_ms    = EXCLUDED.average_speed_ms,
			max_speed_ms        = EXCLUDED.max_speed_ms,
			average_watts       = EXCLUDED.average_watts,
			average_heartrate   = EXCLUDED.average_heartrate,
			max_heartrate       = EXCLUDED.max_heartrate,
			suffer_score        = EXCLUDED.suffer_score,
			summary_polyline    = EXCLUDED.summary_polyline,
			full_polyline       = EXCLUDED.full_polyline,
			raw_payload         = EXCLUDED.raw_payload`,
		a.ID, a.Name, a.Type, a.WorkoutType, start, a.Distance,
		a.MovingTime, a.ElapsedTime, a.TotalElevationGain, a.AverageSpeed,
		a.MaxSpeed, a.AverageWatts, a.AverageHeartrate, a.MaxHeartrate,
		a.SufferScore, a.Map.SummaryPolyline, polyline, raw,
	)
	if err != nil {
		return err
	}

	end := start.Add(time.Duration(a.ElapsedTime) * time.Second)
	dist := a.Distance
	if _, err := c.store.Ingest(ctx, ingest.Metric{
		Source:     "strava",
		SourceKey:  fmt.Sprintf("strava_activity_%d", a.ID),
		MetricType: "workout_cardio",
		Value:      &dist,
		Unit:       "m",
		TStart:     start,
		TEnd:       end,
		Raw:        raw,
	}); err != nil && !errors.Is(err, ingest.ErrDuplicate) {
		return fmt.Errorf("strava ingest cardio: %w", err)
	}

	dur := float64(a.MovingTime)
	if _, err := c.store.Ingest(ctx, ingest.Metric{
		Source:     "strava",
		SourceKey:  fmt.Sprintf("strava_activity_dur_%d", a.ID),
		MetricType: "workout_duration",
		Value:      &dur,
		Unit:       "s",
		TStart:     start,
		TEnd:       end,
		Raw:        raw,
	}); err != nil && !errors.Is(err, ingest.ErrDuplicate) {
		return fmt.Errorf("strava ingest duration: %w", err)
	}

	return nil
}