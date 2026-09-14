package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	DBHost     string
	DBPort     int
	DBUser     string
	DBPassword string
	DBName     string

	ListenAddr string
	APIKey     string
	BaseURL    string

	PlumberURL   string
	SyncInterval time.Duration

	StravaClientID     string
	StravaClientSecret string

	FatSecretKey    string
	FatSecretSecret string
}

func Load() *Config {
	return &Config{
		DBHost:     getStr("WINTERARC_DB_HOST", "localhost"),
		DBPort:     getInt("WINTERARC_DB_PORT", 5432),
		DBUser:     getStr("WINTERARC_DB_USER", "winterarc"),
		DBPassword: getStr("WINTERARC_DB_PASSWORD", ""),
		DBName:     getStr("WINTERARC_DB_NAME", "winterarc"),

		ListenAddr: getStr("WINTERARC_LISTEN_ADDR", ":8080"),
		APIKey:     getStr("WINTERARC_API_KEY", ""),
		BaseURL:    getStr("WINTERARC_BASE_URL", "http://localhost:8080"),

		PlumberURL:   getStr("WINTERARC_PLUMBER_URL", "http://localhost:8002"),
		SyncInterval: getDur("WINTERARC_SYNC_INTERVAL", time.Hour),

		StravaClientID:     getStr("STRAVA_CLIENT_ID", ""),
		StravaClientSecret: getStr("STRAVA_CLIENT_SECRET", ""),

		FatSecretKey:    getStr("FATSECRET_KEY", ""),
		FatSecretSecret: getStr("FATSECRET_SECRET", ""),
	}
}

func getStr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}

func getDur(key string, fallback time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			return d
		}
	}
	return fallback
}