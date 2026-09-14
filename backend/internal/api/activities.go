package api

import (
	"net/http"
	"strconv"
	"time"
)

type activityDTO struct {
	ID        int64   `json:"id"`
	Name      string  `json:"name"`
	Type      string  `json:"type"`
	Start     string  `json:"start"`
	StartMS   int64   `json:"startMs"`
	DistanceM float64 `json:"distanceM"`
	MovingSec int     `json:"movingSec"`
	ElevationM float64 `json:"elevationM"`
	AvgHr     float64 `json:"avgHr"`
	Polyline  string  `json:"polyline"`
}

func (s *Server) handleListActivities(w http.ResponseWriter, r *http.Request) {
	from := parseTime(r.URL.Query().Get("from"))
	to := parseTime(r.URL.Query().Get("to"))

	stmt := `
		SELECT strava_id, name, COALESCE(activity_type, ''), start_date,
		       COALESCE(distance_m, 0), COALESCE(moving_time_s, 0),
		       COALESCE(total_elevation_gain_m, 0), COALESCE(average_heartrate, 0),
		       COALESCE(NULLIF(full_polyline, ''), summary_polyline, '')
		FROM strava_activities
		WHERE TRUE`
	var args []any
	i := 1
	if !from.IsZero() {
		stmt += " AND start_date >= $1"
		args = append(args, from.UTC())
		i++
	}
	if !to.IsZero() {
		stmt += " AND start_date <= $2"
		args = append(args, to.UTC())
		i++
	}
	if t := r.URL.Query().Get("type"); t != "" {
		stmt += " AND activity_type = $3"
		args = append(args, t)
		i++
	}
	limit := 500
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			limit = n
		}
	}
	stmt += " ORDER BY start_date DESC LIMIT " + strconv.Itoa(limit)

	rows, err := s.db.Pool.Query(r.Context(), stmt, args...)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()
	var out []activityDTO
	for rows.Next() {
		var a activityDTO
		var start time.Time
		if err := rows.Scan(&a.ID, &a.Name, &a.Type, &start, &a.DistanceM,
			&a.MovingSec, &a.ElevationM, &a.AvgHr, &a.Polyline); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		a.Start = start.UTC().Format(time.RFC3339)
		a.StartMS = start.UTC().UnixMilli()
		out = append(out, a)
	}
	if out == nil {
		out = []activityDTO{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"activities": out, "count": len(out)})
}