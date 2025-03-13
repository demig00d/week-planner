package config

import (
	"errors"
	"log/slog"
	"strings"

	"github.com/ilyakaznacheev/cleanenv"
)

const DateFormat = "2006-01-02"

type Config struct {
	Host     string `env:"HOST" env-default:"localhost"`
	Port     int    `env:"PORT" env-default:"5000"`
	LogLevel string `env:"LOGLEVEL" env-default:"error"`
}

// NewConfig returns app config.
func NewConfig() (Config, error) {
	var errFile error

	cfg := &Config{}
	errEnv := cleanenv.ReadEnv(cfg)

	// fallback to .env file
	if errEnv != nil {
		errFile = cleanenv.ReadConfig(".env", cfg)
	}

	if errFile != nil {
		return *cfg, errors.Join(errEnv, errFile)
	}

	return *cfg, nil
}

func (c *Config) GetLogLevel() slog.Level {
	switch strings.ToLower(c.LogLevel) {
	case "debug":
		return slog.LevelDebug
	case "info":
		return slog.LevelInfo
	case "warn":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelError
	}
}
