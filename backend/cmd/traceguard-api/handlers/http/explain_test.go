package tracehttp

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/entities"
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/services/investigation"
)

type explanationProvider func(context.Context, investigation.Request) (investigation.Suggestion, error)

func (f explanationProvider) Suggest(ctx context.Context, request investigation.Request) (investigation.Suggestion, error) {
	return f(ctx, request)
}

func TestExplainHTTP(t *testing.T) {
	const payload = `{
		"finding":{"id":"finding-1","rule_id":"DENY_EXTERNAL_PII","status":"POTENTIAL_VIOLATION",
		"message":"The receipt indicates a policy concern.","evidence_event_ids":["evt-004","absent"],"missing_evidence":["completed send"]},
		"rule_summary":"PII destinations must be approved.",
		"evidence":[{"event_id":"evt-004","action":"DATA_RECEIVED","outcome":"COMPLETED"}]
	}`
	type contextKey struct{}
	ctx, cancel := context.WithCancel(context.WithValue(t.Context(), contextKey{}, true))
	defer cancel()
	post := func(service investigation.Service, body string) *httptest.ResponseRecorder {
		router := echo.New()
		Register(router, nil, nil, nil, service)
		req := httptest.NewRequest(http.MethodPost, "/api/v1/explain", strings.NewReader(body)).WithContext(ctx)
		res := httptest.NewRecorder()
		router.ServeHTTP(res, req)
		return res
	}
	fallback := post(investigation.New(nil), payload)
	if fallback.Code != http.StatusOK || !strings.Contains(fallback.Body.String(), `"mode":"fallback"`) ||
		!strings.Contains(fallback.Body.String(), `"evidence_event_ids":["evt-004"]`) ||
		!strings.Contains(fallback.Body.String(), "Potential violation.") {
		t.Fatalf("fallback response: %d %s", fallback.Code, fallback.Body.String())
	}
	providerFailure := investigation.New(explanationProvider(func(ctx context.Context, request investigation.Request) (investigation.Suggestion, error) {
		if ctx.Value(contextKey{}) != true || ctx.Done() == nil || request.Status != entities.PotentialViolation || len(request.Evidence) != 1 {
			t.Fatalf("provider context or request is incorrect: %+v", request)
		}
		return investigation.Suggestion{}, errors.New("provider unavailable")
	}))
	failed := post(providerFailure, payload)
	if failed.Code != fallback.Code || failed.Body.String() != fallback.Body.String() {
		t.Fatalf("provider failure response: %d %s", failed.Code, failed.Body.String())
	}
	providerSuccess := investigation.New(explanationProvider(func(_ context.Context, _ investigation.Request) (investigation.Suggestion, error) {
		return investigation.Suggestion{Status: entities.PotentialViolation, EvidenceRefs: []string{"E1"}, StepIDs: []string{"check_policy"}}, nil
	}))
	if res := post(providerSuccess, payload); res.Code != http.StatusOK || !strings.Contains(res.Body.String(), `"mode":"ai"`) ||
		!strings.Contains(res.Body.String(), "Potential violation.") || !strings.Contains(res.Body.String(), `"evidence_event_ids":["evt-004"]`) {
		t.Fatalf("AI response: %d %s", res.Code, res.Body.String())
	}
	if invalid := post(investigation.New(nil), strings.Replace(payload, "POTENTIAL_VIOLATION", "UNKNOWN", 1)); invalid.Code != http.StatusBadRequest {
		t.Fatalf("invalid classification response: %d %s", invalid.Code, invalid.Body.String())
	}
	canceledProvider := investigation.New(explanationProvider(func(providerCtx context.Context, _ investigation.Request) (investigation.Suggestion, error) {
		cancel()
		if !errors.Is(providerCtx.Err(), context.Canceled) {
			t.Fatal("provider did not receive request cancellation")
		}
		return investigation.Suggestion{}, providerCtx.Err()
	}))
	if res := post(canceledProvider, payload); res.Code != fallback.Code || res.Body.String() != fallback.Body.String() {
		t.Fatalf("canceled response: %d %s", res.Code, res.Body.String())
	}

}
