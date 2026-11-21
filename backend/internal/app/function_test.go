package app_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	health "github.com/peyrone/traceguard-ai/backend/api"
	api "github.com/peyrone/traceguard-ai/backend/api/v1"
)

func TestVercelFunctions(t *testing.T) {
	t.Setenv("TRACEGUARD_FRONTEND_ORIGIN", "https://traceguard-ui.vercel.app")
	t.Setenv("OPENAI_API_KEY", "")
	t.Setenv("TRACEGUARD_OPENAI_MODEL", "")

	for _, tc := range []struct {
		name, method, input, expected string
		handler                       http.HandlerFunc
	}{
		{"health", http.MethodGet, "", `"status":"ok"`, health.Healthz},
		{"scenarios", http.MethodGet, "", `"id":"missing_intermediate"`, api.Scenarios},
		{"analyze", http.MethodPost, `{"scenario_id":"unauthorized_transfer"}`, `"status":"VERIFIED_VIOLATION"`, api.Analyze},
		{"report summary", http.MethodPost, `{"scenario_id":"allowed_transfer","audience":"executive","language":"th"}`, `"status":"NO_VIOLATION_OBSERVED"`, api.ReportSummary},
		{"explain", http.MethodPost, `{
			"finding":{"id":"f","rule_id":"DENY_EXTERNAL_PII","status":"VERIFIED_VIOLATION","message":"Destination denied.",
			"evidence_event_ids":["evt-003"],"missing_evidence":[]},
			"rule_summary":"Destination must be allowed.","evidence":[{"event_id":"evt-003"}]
		}`, `"mode":"fallback"`, api.Explain},
	} {
		t.Run(tc.name, func(t *testing.T) {
			request := httptest.NewRequest(tc.method, "/function-entry", strings.NewReader(tc.input))
			request.Header.Set("Origin", "https://traceguard-ui.vercel.app")
			rec := httptest.NewRecorder()
			tc.handler(rec, request)
			if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), tc.expected) ||
				rec.Header().Get("Access-Control-Allow-Origin") != "https://traceguard-ui.vercel.app" {
				t.Fatalf("unexpected function response: %d %v %s", rec.Code, rec.Header(), rec.Body.String())
			}
		})
	}
}
