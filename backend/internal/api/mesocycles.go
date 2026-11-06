package api

import (
    "encoding/json"
    "errors"
    "net/http"
    "strconv"
    "strings"
    "time"

    "github.com/go-chi/chi/v5"
)

type mesocycleInput struct {
    Name string `json:"name"`
    Goal string `json:"goal"`
    StartDate string `json:"startDate"`
    DurationWeeks int `json:"durationWeeks"`
    DeloadWeek *int `json:"deloadWeek"`
    Notes string `json:"notes"`
    Weeks []mesocycleWeekInput `json:"weeks"`
}
type mesocycleWeekInput struct {
    WeekNumber int `json:"weekNumber"`
    Focus string `json:"focus"`
    VolumeMultiplier float64 `json:"volumeMultiplier"`
    TargetRIR *float64 `json:"targetRir"`
    IsDeload bool `json:"isDeload"`
}

func (in mesocycleInput) validate() (time.Time, error) {
    start, err := time.Parse("2006-01-02", in.StartDate)
    if err != nil { return time.Time{}, errors.New("startDate must use YYYY-MM-DD") }
    if strings.TrimSpace(in.Name) == "" || len(in.Name) > 120 {
        return time.Time{}, errors.New("name is required and must be at most 120 characters")
    }
    if in.DurationWeeks < 1 || in.DurationWeeks > 52 {
        return time.Time{}, errors.New("durationWeeks must be between 1 and 52")
    }
    if in.DeloadWeek != nil && (*in.DeloadWeek < 1 || *in.DeloadWeek > in.DurationWeeks) {
        return time.Time{}, errors.New("deloadWeek must fall within the mesocycle")
    }
    seen := map[int]bool{}
    for _, w := range in.Weeks {
        if w.WeekNumber < 1 || w.WeekNumber > in.DurationWeeks || seen[w.WeekNumber] {
            return time.Time{}, errors.New("week numbers must be unique and within the mesocycle")
        }
        if w.VolumeMultiplier < 0.25 || w.VolumeMultiplier > 2 {
            return time.Time{}, errors.New("volumeMultiplier must be between 0.25 and 2.0")
        }
        if w.TargetRIR != nil && (*w.TargetRIR < 0 || *w.TargetRIR > 10) {
            return time.Time{}, errors.New("targetRir must be between 0 and 10")
        }
        seen[w.WeekNumber] = true
    }
    return start, nil
}

func (s *Server) handleListMesocycles(w http.ResponseWriter, r *http.Request) {
    rows, err := s.db.Pool.Query(r.Context(), `
        SELECT id, name, goal, status, start_date, duration_weeks,
               deload_week, notes, created_at, updated_at
        FROM mesocycles ORDER BY start_date DESC, id DESC`)
    if err != nil { writeJSON(w, 500, map[string]string{"error":"could not list mesocycles"}); return }
    defer rows.Close()
    out := make([]map[string]any, 0)
    for rows.Next() {
        var id int64; var name, goal, status, notes string
        var start time.Time; var duration int; var deload *int
        var created, updated time.Time
        if err := rows.Scan(&id,&name,&goal,&status,&start,&duration,&deload,&notes,&created,&updated); err != nil {
            writeJSON(w,500,map[string]string{"error":"could not read mesocycles"}); return
        }
        out = append(out, map[string]any{"id":id,"name":name,"goal":goal,"status":status,
            "startDate":start.Format("2006-01-02"),"durationWeeks":duration,"deloadWeek":deload,
            "notes":notes,"createdAt":created.UTC().Format(time.RFC3339),"updatedAt":updated.UTC().Format(time.RFC3339)})
    }
    if err := rows.Err(); err != nil { writeJSON(w,500,map[string]string{"error":"could not read mesocycles"}); return }
    writeJSON(w,200,map[string]any{"mesocycles":out})
}

func (s *Server) handleCreateMesocycle(w http.ResponseWriter, r *http.Request) {
    var in mesocycleInput
    dec := json.NewDecoder(r.Body); dec.DisallowUnknownFields()
    if err := dec.Decode(&in); err != nil { writeJSON(w,400,map[string]string{"error":"invalid request body"}); return }
    start, err := in.validate()
    if err != nil { writeJSON(w,400,map[string]string{"error":err.Error()}); return }

    if len(in.Weeks) == 0 { in.Weeks = defaultMesocycleWeeks(in.DurationWeeks, in.DeloadWeek) }\n\n    tx, err := s.db.Pool.Begin(r.Context())
    if err != nil { writeJSON(w,500,map[string]string{"error":"could not start transaction"}); return }
    defer tx.Rollback(r.Context())
    var id int64
    err = tx.QueryRow(r.Context(), `
        INSERT INTO mesocycles(name,goal,start_date,duration_weeks,deload_week,notes)
        VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
        strings.TrimSpace(in.Name), strings.TrimSpace(in.Goal), start, in.DurationWeeks, in.DeloadWeek, in.Notes).Scan(&id)
    if err != nil { writeJSON(w,500,map[string]string{"error":"could not create mesocycle"}); return }
    for _, week := range in.Weeks {
        _, err = tx.Exec(r.Context(), `
            INSERT INTO mesocycle_weeks(mesocycle_id,week_number,focus,volume_multiplier,target_rir,is_deload)
            VALUES($1,$2,$3,$4,$5,$6)`,
            id,week.WeekNumber,week.Focus,week.VolumeMultiplier,week.TargetRIR,week.IsDeload)
        if err != nil { writeJSON(w,400,map[string]string{"error":"invalid weekly prescription"}); return }
    }
    if err = tx.Commit(r.Context()); err != nil { writeJSON(w,500,map[string]string{"error":"could not commit mesocycle"}); return }
    writeJSON(w,http.StatusCreated,map[string]any{"id":id,"status":"created"})
}

func (s *Server) handleGetMesocycle(w http.ResponseWriter, r *http.Request) {
    id, err := strconv.ParseInt(chi.URLParam(r,"id"),10,64)
    if err != nil || id < 1 { writeJSON(w,400,map[string]string{"error":"invalid mesocycle id"}); return }
    var out struct {
        ID int64 `json:"id"`; Name string `json:"name"`; Goal string `json:"goal"`
        Status string `json:"status"`; StartDate string `json:"startDate"`
        DurationWeeks int `json:"durationWeeks"`; DeloadWeek *int `json:"deloadWeek"`; Notes string `json:"notes"`
        Weeks []mesocycleWeekInput `json:"weeks"`
    }
    var start time.Time
    err = s.db.Pool.QueryRow(r.Context(),`
        SELECT id,name,goal,status,start_date,duration_weeks,deload_week,notes
        FROM mesocycles WHERE id=$1`,id).Scan(&out.ID,&out.Name,&out.Goal,&out.Status,&start,&out.DurationWeeks,&out.DeloadWeek,&out.Notes)
    if err != nil { writeJSON(w,http.StatusNotFound,map[string]string{"error":"mesocycle not found"}); return }
    out.StartDate = start.Format("2006-01-02")
    rows, err := s.db.Pool.Query(r.Context(),`
        SELECT week_number,focus,volume_multiplier,target_rir,is_deload
        FROM mesocycle_weeks WHERE mesocycle_id=$1 ORDER BY week_number`,id)
    if err != nil { writeJSON(w,500,map[string]string{"error":"could not read weekly plan"}); return }
    defer rows.Close()
    out.Weeks = make([]mesocycleWeekInput,0)
    for rows.Next() {
        var wk mesocycleWeekInput
        if err := rows.Scan(&wk.WeekNumber,&wk.Focus,&wk.VolumeMultiplier,&wk.TargetRIR,&wk.IsDeload); err != nil {
            writeJSON(w,500,map[string]string{"error":"could not read weekly plan"}); return
        }
        out.Weeks = append(out.Weeks,wk)
    }
    writeJSON(w,200,out)
}


// defaultMesocycleWeeks creates a conservative linear build with an optional
// deload. It is a starting prescription, not an auto-regulated medical or
// coaching recommendation; users can supply their own weekly targets.
func defaultMesocycleWeeks(duration int, deload *int) []mesocycleWeekInput {
    weeks := make([]mesocycleWeekInput, 0, duration)
    for n := 1; n <= duration; n++ {
        multiplier := 1.0 + float64(n-1)*0.05
        rir := 3.0
        focus := "Progressive overload"
        isDeload := deload != nil && n == *deload
        if isDeload {
            multiplier = 0.6
            rir = 4
            focus = "Deload — reduce fatigue"
        } else if n == duration {
            focus = "Peak / performance"
            rir = 1
        }
        weeks = append(weeks, mesocycleWeekInput{
            WeekNumber:n, Focus:focus, VolumeMultiplier:multiplier,
            TargetRIR:&rir, IsDeload:isDeload,
        })
    }
    return weeks
}
