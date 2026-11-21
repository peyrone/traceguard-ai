package config

import (
	"reflect"
	"testing"
)

func TestLoad(t *testing.T) {
	for _, tc := range []struct {
		name, port, address, origin, wantAddress string
		wantOrigins                              []string
	}{
		{"local defaults", "", "", "", ":8080", []string{"http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:4173", "http://127.0.0.1:4173"}},
		{"local override", "", "127.0.0.1:9000", "", "127.0.0.1:9000", []string{"http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:4173", "http://127.0.0.1:4173"}},
		{"Render port and origin", "10000", ":9000", "https://traceguard-ai-ui.onrender.com", "0.0.0.0:10000", []string{"https://traceguard-ai-ui.onrender.com"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("PORT", tc.port)
			t.Setenv("TRACEGUARD_ADDR", tc.address)
			t.Setenv("TRACEGUARD_FRONTEND_ORIGIN", tc.origin)
			got := Load()
			if got.Address != tc.wantAddress || !reflect.DeepEqual(got.AllowedOrigins, tc.wantOrigins) {
				t.Fatalf("Load() = %+v, want address %q and origins %v", got, tc.wantAddress, tc.wantOrigins)
			}
		})
	}
}
