package tracehttp

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
	api "github.com/peyrone/traceguard-ai/backend/cmd/traceguard-api/handlers/http/api_gen"
	"github.com/peyrone/traceguard-ai/backend/internal/adapters/fixtures"
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/services/investigation"
)

func TestPrivacyDecisionHTTP(t *testing.T) {
	router := echo.New()
	Register(router, fixtures.Store{}, nil, nil, investigation.New(nil))
	const valid = `{"source_service":"customer-api","destination_service":"sales-api","data_categories":["PII"],"purpose":"CUSTOMER_SERVICE","policy_id":"policy-001"}`
	for _, tc := range []struct {
		name, body, rule string
		decision         api.PrivacyDecisionResponseDecision
	}{
		{"allowed", valid, "TRANSFER_POLICY", api.ALLOW},
		{"denied destination", strings.Replace(valid, "sales-api", "external-crm", 1), "DENY_EXTERNAL_PII", api.DENY},
		{"denied purpose", strings.Replace(valid, "CUSTOMER_SERVICE", "MARKETING", 1), "DENY_PURPOSE", api.DENY},
		{"unknown policy", strings.Replace(valid, "policy-001", "unknown", 1), "TRANSFER_POLICY", api.INDETERMINATE},
		{"missing attributes", "{}", "TRANSFER_POLICY", api.INDETERMINATE},
		{"wrong type", `{"purpose":42}`, "", ""},
		{"null body", "null", "", ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/v1/privacy/decisions", strings.NewReader(tc.body)))
			if tc.decision == "" {
				var got api.Error
				if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil || rec.Code != http.StatusBadRequest || got.Code != "INVALID_REQUEST" {
					t.Fatalf("expected error envelope, got %d %s", rec.Code, rec.Body)
				}
				return
			}
			var got api.PrivacyDecisionResponse
			if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil || rec.Code != http.StatusOK ||
				got.Decision != tc.decision || got.RuleId != tc.rule || got.Reason == "" ||
				got.TransferExecuted != (tc.decision == api.ALLOW) {
				t.Fatalf("unexpected decision: %d %s", rec.Code, rec.Body)
			}
		})
	}
}
