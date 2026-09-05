package platform

import (
	"encoding/base64"
	"errors"
	"os"
	"strings"
	"time"
)

type Config struct {
	Address       string
	DatabasePath  string
	JWTSecret     []byte
	MasterKey     []byte
	AccessTTL     time.Duration
	RefreshTTL    time.Duration
	SecureCookies bool
}

func LoadConfig() (Config, error) {
	cfg := Config{
		Address:       valueOr("SERVER_ADDR", ":8080"),
		DatabasePath:  valueOr("DATABASE_PATH", "./data/enterprise.db"),
		AccessTTL:     15 * time.Minute,
		RefreshTTL:    30 * 24 * time.Hour,
		SecureCookies: valueOr("SECURE_COOKIES", "false") == "true",
	}
	var err error
	if cfg.JWTSecret, err = decodeKey("JWT_SECRET"); err != nil {
		return Config{}, err
	}
	if cfg.MasterKey, err = decodeKey("MASTER_KEY"); err != nil {
		return Config{}, err
	}
	if len(cfg.JWTSecret) < 32 || len(cfg.MasterKey) != 32 {
		return Config{}, errors.New("JWT_SECRET must be at least 32 bytes and MASTER_KEY exactly 32 bytes")
	}
	return cfg, nil
}

func valueOr(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func decodeKey(name string) ([]byte, error) {
	value := strings.TrimSpace(os.Getenv(name))
	if value == "" {
		return nil, errors.New(name + " is required as a base64 encoded key")
	}
	key, err := base64.StdEncoding.DecodeString(value)
	if err != nil {
		return nil, errors.New(name + " must be base64 encoded")
	}
	return key, nil
}
