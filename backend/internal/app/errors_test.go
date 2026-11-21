package app_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	functions "github.com/peyrone/traceguard-ai/backend/api"
	api "github.com/peyrone/traceguard-ai/backend/api/v1"
	"github.com/peyrone/traceguard-ai/backend/internal/app"
	"github.com/peyrone/traceguard-ai/backend/internal/config"
)

func TestHTTPErrorEnvelope(t *testing.T) {
	const origin = "https://traceguard-ui.vercel.app"
	t.Setenv("TRACEGUARD_FRONTEND_ORIGIN", origin)
	router := app.Router(config.Load())
	for _, tc := range []struct {
		name, method, path, input, want string
		status                          int
	}{
		{"missing route", "GET", "/api/v1/unknown", "", `{"code":"NOT_FOUND","message":"Not Found"}`, 404},
		{"wrong method", "GET", "/api/v1/analyze", "", `{"code":"METHOD_NOT_ALLOWED","message":"Method Not Allowed"}`, 405},
		{"invalid JSON", "POST", "/api/v1/analyze", "{", `{"code":"INVALID_REQUEST","message":"Expected one JSON request object."}`, 400},
		{"unknown scenario", "POST", "/api/v1/analyze", `{"scenario_id":"unknown"}`, `{"code":"SCENARIO_NOT_FOUND","message":"Unknown scenario."}`, 404},
	} {
		t.Run(tc.name, func(t *testing.T) {
			function := api.Analyze
			if tc.path == "/api/v1/unknown" {
				function = functions.NotFound
			}
			for _, entry := range []struct {
				name  string
				serve http.HandlerFunc
			}{
				{"echo", router.ServeHTTP},
				{"vercel handler", function},
			} {
				t.Run(entry.name, func(t *testing.T) {
					req := httptest.NewRequest(tc.method, tc.path, strings.NewReader(tc.input))
					req.Header.Set("Origin", origin)
					rec := httptest.NewRecorder()
					entry.serve(rec, req)
					if rec.Code != tc.status || strings.TrimSpace(rec.Body.String()) != tc.want ||
						rec.Header().Get("Access-Control-Allow-Origin") != origin {
						t.Fatalf("got %d %v %s", rec.Code, rec.Header(), rec.Body.String())
					}
				})
			}
		})
	}
}
