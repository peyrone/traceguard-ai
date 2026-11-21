package config

import (
	"net"
	"os"
	"strings"
)

type Config struct {
	Address        string
	AllowedOrigins []string
}

func Load() Config {
	address := os.Getenv("TRACEGUARD_ADDR")
	if port := os.Getenv("PORT"); port != "" {
		address = net.JoinHostPort("0.0.0.0", port)
	} else if address == "" {
		address = ":8080"
	}

	origins := []string{
		"http://localhost:5173", "http://127.0.0.1:5173",
		"http://localhost:4173", "http://127.0.0.1:4173",
	}
	if origin := strings.TrimSpace(os.Getenv("TRACEGUARD_FRONTEND_ORIGIN")); origin != "" {
		origins = []string{origin}
	}

	return Config{Address: address, AllowedOrigins: origins}
}
