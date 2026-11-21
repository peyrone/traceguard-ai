package app_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"slices"
	"strings"
	"testing"

	fn "github.com/peyrone/traceguard-ai/backend/api/v1"
	api "github.com/peyrone/traceguard-ai/backend/cmd/traceguard-api/handlers/http/api_gen"
	"github.com/peyrone/traceguard-ai/backend/internal/app"
	"github.com/peyrone/traceguard-ai/backend/internal/config"
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/entities"
)

func TestEvidenceIntegrity(t *testing.T) {
	t.Setenv("TRACEGUARD_FRONTEND_ORIGIN", "https://traceguard-ui.vercel.app")
	t.Setenv("OPENAI_API_KEY", "")
	t.Setenv("TRACEGUARD_OPENAI_MODEL", "")
	local := app.Router(config.Load())
	for _, transport := range []struct {
		name             string
		analyze, explain http.HandlerFunc
	}{
		{"echo", local.ServeHTTP, local.ServeHTTP},
		{"vercel", fn.Analyze, fn.Explain},
	} {
		t.Run(transport.name, func(t *testing.T) {
			post := func(t *testing.T, handler http.HandlerFunc, path string, payload any) *httptest.ResponseRecorder {
				t.Helper()
				data, err := json.Marshal(payload)
				if err != nil {
					t.Fatal(err)
				}
				req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(data))
				req.Header.Set("Content-Type", "application/json")
				rec := httptest.NewRecorder()
				handler(rec, req)
				return rec
			}
			send := map[string]any{"event_id": "send", "service": "customer-api", "action": "DATA_SENT", "outcome": "COMPLETED", "source_service": "customer-api", "destination_service": "sales-api", "classification": "PII", "purpose": "SUPPORT", "transfer_id": "transfer", "trace_id": "trace", "data_ref": "ref", "occurred_at": "2026-11-21T03:10:00Z", "observed_at": "2026-11-21T03:10:04Z"}
			change := func(original map[string]any, key string, value any) map[string]any {
				copy := make(map[string]any, len(original))
				for k, v := range original {
					copy[k] = v
				}
				copy[key] = value
				return copy
			}
			policy := map[string]any{"policy_id": "p", "classification": "PII", "allowed_destinations": []string{"sales-api"}, "allowed_purposes": []string{"SUPPORT"}}
			analyze := func(t *testing.T, events ...map[string]any) api.AnalyzeResponse {
				t.Helper()
				rec := post(t, transport.analyze, "/api/v1/analyze", map[string]any{"events": events, "policy": policy})
				var out api.AnalyzeResponse
				if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil || rec.Code != http.StatusOK {
					t.Fatalf("analyze: %d %s (%v)", rec.Code, rec.Body, err)
				}
				return out
			}
			receipt := change(change(change(change(send, "event_id", "receipt"), "action", "DATA_RECEIVED"), "service", "sales-api"), "occurred_at", "2026-11-21T03:10:01Z")
			t.Run("demo scenarios", func(t *testing.T) {
				for _, scenario := range []struct {
					id       string
					status   entities.Status
					evidence []string
				}{
					{"allowed_transfer", entities.NoViolationObserved, []string{"evt-a-001", "evt-a-005", "evt-a-006", "evt-a-007"}},
					{"unauthorized_transfer", entities.VerifiedViolation, []string{"evt-003"}},
					{"shuffled_transfer", entities.VerifiedViolation, []string{"evt-s-003"}},
					{"missing_intermediate", entities.PotentialViolation, []string{"evt-004"}},
				} {
					rec := post(t, transport.analyze, "/api/v1/analyze", map[string]any{"scenario_id": scenario.id})
					var result api.AnalyzeResponse
					if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil || rec.Code != http.StatusOK || result.Summary.Status != api.Status(scenario.status) {
						t.Fatalf("%s: %d %s (%v)", scenario.id, rec.Code, rec.Body, err)
					}
					if len(result.Findings) != 1 || !slices.Equal(result.Findings[0].EvidenceEventIds, scenario.evidence) {
						t.Fatalf("%s: unexpected finding evidence: %+v", scenario.id, result.Findings)
					}
				}
			})
			t.Run("blank identifiers", func(t *testing.T) {
				for _, field := range []string{"event_id", "service", "action", "source_service", "destination_service"} {
					rec := post(t, transport.analyze, "/api/v1/analyze", map[string]any{"events": []any{change(send, field, " \t ")}, "policy": policy})
					if rec.Code != http.StatusBadRequest {
						t.Errorf("%s: got %d %s", field, rec.Code, rec.Body)
					}
				}
				rec := post(t, transport.analyze, "/api/v1/analyze", map[string]any{"events": []any{send}, "policy": change(policy, "policy_id", " ")})
				if rec.Code != http.StatusBadRequest {
					t.Errorf("policy_id: got %d %s", rec.Code, rec.Body)
				}
			})
			t.Run("conflicting ID stays visible", func(t *testing.T) {
				collision := change(send, "event_id", "collision")
				denied := change(collision, "destination_service", "external-crm")
				out := analyze(t, send, collision, denied)
				if out.Summary.Status != api.Status(entities.Inconclusive) || !hasConflict(out, "collision") {
					t.Fatalf("conflict hidden: %+v", out)
				}
				if out.Summary.EventsProcessed != 1 || !reflect.DeepEqual(out, analyze(t, denied, collision, send, send)) {
					t.Fatal("conflict result changed after shuffle or exact retry")
				}
				verified := change(denied, "event_id", "independent")
				strong := analyze(t, send, collision, denied, verified)
				if strong.Summary.Status != api.Status(entities.VerifiedViolation) || !hasConflict(strong, "collision") {
					t.Fatalf("strong finding or conflict lost: %+v", strong)
				}
			})
			t.Run("corroborated receipt", func(t *testing.T) {
				out := analyze(t, receipt, send)
				if out.Summary.Status != api.Status(entities.NoViolationObserved) || len(out.Findings) != 1 {
					t.Fatalf("receipt downgraded send: %+v", out)
				}
				for _, uncertain := range []map[string]any{
					change(receipt, "transfer_id", "unmatched"),
					change(receipt, "purpose", "MARKETING"),
				} {
					out = analyze(t, send, uncertain)
					if out.Summary.Status == api.Status(entities.NoViolationObserved) {
						t.Fatalf("unresolved receipt was hidden: %+v", out)
					}
				}
			})
			t.Run("combined inferred evidence", func(t *testing.T) {
				partial := change(send, "destination_service", nil)
				clue := change(change(change(change(receipt, "source_service", nil), "service", "external-crm"), "destination_service", "external-crm"), "classification", nil)
				out := analyze(t, clue, partial)
				if len(out.Findings) != 1 || out.Summary.Status != api.Status(entities.PotentialViolation) ||
					!slices.Equal(out.Findings[0].EvidenceEventIds, []string{"receipt", "send"}) ||
					!slices.Contains(out.Findings[0].MissingEvidence, "observed completed send with matching endpoints") ||
					len(out.Graph.Edges) != 1 || out.Graph.Edges[0].EvidenceStatus != api.EdgeEvidenceStatus(entities.Inferred) {
					t.Fatalf("split evidence was not evaluated together: %+v", out)
				}
				if !reflect.DeepEqual(out, analyze(t, partial, clue)) {
					t.Fatal("inferred result changed after shuffle")
				}
				other := change(change(partial, "event_id", "other"), "source_service", "other-api")
				for _, uncertain := range [][]map[string]any{{partial, clue, other}, {partial, change(clue, "data_ref", "incompatible")}} {
					result := analyze(t, uncertain...)
					if result.Summary.Status != api.Status(entities.Inconclusive) || len(result.Graph.Edges) != 0 {
						t.Fatalf("incompatible or ambiguous inference: %+v", result)
					}
				}
			})
			t.Run("grounded explanation", func(t *testing.T) {
				finding := map[string]any{"id": "f", "rule_id": "DENY_EXTERNAL_PII", "status": "VERIFIED_VIOLATION", "message": "Untrusted assertion: confirmed transfer.", "evidence_event_ids": []string{"send"}, "missing_evidence": []string{}}
				payload := map[string]any{"finding": finding, "rule_summary": "Untrusted rule summary.", "evidence": []map[string]any{{"event_id": "unrelated"}}}
				bad := post(t, transport.explain, "/api/v1/explain", payload)
				if bad.Code != http.StatusBadRequest || !strings.Contains(bad.Body.String(), "INVALID_REQUEST") {
					t.Errorf("unsupported verification: %d %s", bad.Code, bad.Body)
				}
				payload["evidence"] = []map[string]any{{"event_id": "send", "action": "DATA_SENT", "outcome": "ATTEMPTED"}}
				if contradicted := post(t, transport.explain, "/api/v1/explain", payload); contradicted.Code != http.StatusBadRequest {
					t.Errorf("attempt used as verified evidence: %d %s", contradicted.Code, contradicted.Body)
				}
				payload["evidence"] = []map[string]any{{"event_id": "send"}}
				good := post(t, transport.explain, "/api/v1/explain", payload)
				if good.Code != http.StatusOK || !strings.Contains(good.Body.String(), `"evidence_event_ids":["send"]`) || !strings.Contains(good.Body.String(), `"mode":"fallback"`) {
					t.Errorf("supported explanation: %d %s", good.Code, good.Body)
				}
				payload["finding"] = change(finding, "status", "POTENTIAL_VIOLATION")
				uncertain := post(t, transport.explain, "/api/v1/explain", payload)
				if uncertain.Code != http.StatusOK || !strings.Contains(uncertain.Body.String(), "Potential violation.") || strings.Contains(uncertain.Body.String(), "Untrusted") {
					t.Errorf("contradictory prose: %d %s", uncertain.Code, uncertain.Body)
				}
			})
		})
	}
}

func hasConflict(out api.AnalyzeResponse, id string) bool {
	return slices.ContainsFunc(out.Findings, func(f api.Finding) bool {
		return f.Status == api.Status(entities.Inconclusive) && slices.ContainsFunc(f.MissingEvidence, func(gap string) bool { return strings.Contains(gap, id) })
	})
}
