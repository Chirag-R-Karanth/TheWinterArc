package lyfta

import (
    "context"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "net/url"
    "strconv"
    "strings"
    "time"

    "github.com/jackc/pgx/v5/pgxpool"
    "winterarc/internal/ingest"
)

// Client uses Lyfta's documented personal API key endpoint. API keys are
// user-generated at my.lyfta.app/community/api and are never logged.
type Client struct {
    pool *pgxpool.Pool
    store *ingest.Store
    key string
    http *http.Client
}
func New(pool *pgxpool.Pool, store *ingest.Store, key string) *Client {
    return &Client{pool:pool,store:store,key:strings.TrimSpace(key),http:&http.Client{Timeout:25*time.Second}}
}
func (c *Client) Name() string { return "lyfta" }
func (c *Client) TokenStatus(context.Context) (string,error) {
    if c.key=="" { return "unconfigured",nil }; return "ok",nil
}
func (c *Client) Run(ctx context.Context) error {
    var last time.Time
    err:=c.pool.QueryRow(ctx,`SELECT COALESCE(last_sync,TIMESTAMPTZ 'epoch') FROM sync_state WHERE source='lyfta'`).Scan(&last)
    if err!=nil && !strings.Contains(err.Error(),"no rows") { return err }
    if last.IsZero() || last.Equal(time.Unix(0,0).UTC()) { last=time.Now().UTC().AddDate(0,-3,0) }
    now:=time.Now().UTC()
    u,_:=url.Parse("https://my.lyfta.app/api/v1/workouts")
    q:=u.Query(); q.Set("from",last.Format("2006-01-02")); q.Set("to",now.Format("2006-01-02")); u.RawQuery=q.Encode()
    req,err:=http.NewRequestWithContext(ctx,http.MethodGet,u.String(),nil); if err!=nil{return err}
    req.Header.Set("Authorization","Bearer "+c.key); req.Header.Set("Accept","application/json")
    resp,err:=c.http.Do(req); if err!=nil{return fmt.Errorf("lyfta request: %w",err)}
    defer resp.Body.Close()
    body,err:=io.ReadAll(io.LimitReader(resp.Body,20<<20)); if err!=nil{return err}
    if resp.StatusCode!=http.StatusOK { return fmt.Errorf("lyfta API returned HTTP %d",resp.StatusCode) }
    var envelope map[string]json.RawMessage
    if err:=json.Unmarshal(body,&envelope); err!=nil{return fmt.Errorf("decode Lyfta response: %w",err)}
    var workouts []json.RawMessage
    for _,key:=range []string{"workouts","data","results"} {
        if raw:=envelope[key];len(raw)>0 { _=json.Unmarshal(raw,&workouts); if workouts!=nil {break} }
    }
    if workouts==nil { _=json.Unmarshal(body,&workouts) }
    for _,raw:=range workouts {
        var w map[string]any
        if err:=json.Unmarshal(raw,&w);err!=nil{continue}
        id:=stringValue(w,"id","workout_id","uuid")
        if id=="" { continue } // Do not create unstable IDs from mutable payloads.
        started,ok:=timeValue(w,"started_at","start_time","date","created_at")
        if !ok { continue }
        ended,_:=timeValue(w,"ended_at","end_time","completed_at")
        if ended.IsZero() || ended.Before(started) { if seconds:=numberValue(w,"duration_seconds","duration");seconds>0 {ended=started.Add(time.Duration(seconds)*time.Second)} else {ended=started} }
        title:=stringValue(w,"name","title")
        if title=="" {title="Lyfta workout"}
        duration:=ended.Sub(started).Seconds()
        v:=duration
        if _,err:=c.store.Ingest(ctx,ingest.Metric{Source:"lyfta",SourceKey:"lyfta_workout_"+id,MetricType:"workout_strength",Value:&v,Unit:"s",TStart:started,TEnd:ended,Raw:raw});err!=nil && err!=ingest.ErrDuplicate{return err}
        exercises,_:=json.Marshal(w["exercises"])
        _,err=c.pool.Exec(ctx,`
            INSERT INTO lyfta_sessions(source_id,started_at,ended_at,title,exercises,raw_payload)
            VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb)
            ON CONFLICT(source_id) DO UPDATE SET started_at=EXCLUDED.started_at,ended_at=EXCLUDED.ended_at,
              title=EXCLUDED.title,exercises=EXCLUDED.exercises,raw_payload=EXCLUDED.raw_payload`,
            id,started,ended,title,string(exercises),string(raw))
        if err!=nil{return fmt.Errorf("store Lyfta workout %s: %w",id,err)}
    }
    _,err=c.pool.Exec(ctx,`INSERT INTO sync_state(source,last_sync) VALUES('lyfta',now())
        ON CONFLICT(source) DO UPDATE SET last_sync=EXCLUDED.last_sync`)
    return err
}
func stringValue(m map[string]any, keys ...string) string {
    for _,k:=range keys { if v,ok:=m[k];ok && v!=nil { if s,ok:=v.(string);ok{return s}; return fmt.Sprint(v) } }
    return ""
}
func numberValue(m map[string]any, keys ...string) float64 {
    for _,k:=range keys { if v,ok:=m[k];ok { switch n:=v.(type) {case float64:return n;case string:f,_:=strconv.ParseFloat(n,64);return f} } }
    return 0
}
func timeValue(m map[string]any, keys ...string) (time.Time,bool) {
    for _,k:=range keys { if raw:=stringValue(m,k);raw!="" {
        for _,layout:=range []string{time.RFC3339Nano,"2006-01-02 15:04:05","2006-01-02"} {
            if t,err:=time.Parse(layout,raw);err==nil{return t.UTC(),true}
        }
    } }
    return time.Time{},false
}
