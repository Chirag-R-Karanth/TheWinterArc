package api

import (
	"fmt"
	"net/http"
	"strconv"
	"time"
)

func (s *Server) handleStravaOAuthStart(w http.ResponseWriter, r *http.Request) {
	state := strconv.FormatInt(time.Now().UnixMilli(), 36)
	http.SetCookie(w, &http.Cookie{
		Name:     "strava_oauth_state",
		Value:    state,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   300,
	})
	http.Redirect(w, r, s.strava.AuthURL(state), http.StatusFound)
}

func (s *Server) handleStravaOAuthCallback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	if code == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing code"})
		return
	}
	if err := s.strava.ExchangeCode(r.Context(), code); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": fmt.Sprintf("strava exchange failed: %v", err)})
		return
	}
	http.Redirect(w, r, "/", http.StatusFound)
}