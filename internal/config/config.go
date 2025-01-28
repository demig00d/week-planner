package config

import (
	"errors"

	"github.com/ilyakaznacheev/cleanenv"
)

const DateFormat = "2006-01-02"

type Config struct {
	Host string `env:"HOST" env-default:"localhost"`
	Port int    `env:"PORT" env-default:"5000"`
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
