package tracehttp

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"
	"unicode"

	"github.com/labstack/echo/v4"
	api "github.com/peyrone/traceguard-ai/backend/cmd/traceguard-api/handlers/http/api_gen"
	"github.com/peyrone/traceguard-ai/backend/internal/adapters/fixtures"
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/services/detection"
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/services/investigation"
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/services/lineage"
)

func reportRouter(provider investigation.Provider) *echo.Echo {
	router := echo.New()
	Register(router, fixtures.Store{}, lineage.Service{}, detection.Evaluator{}, investigation.New(provider))
	return router
}
func postReport(router *echo.Echo, body string) *httptest.ResponseRecorder {
	res := httptest.NewRecorder()
	router.ServeHTTP(res, httptest.NewRequest(http.MethodPost, "/api/v1/report-summary", strings.NewReader(body)))
	return res
}
func TestReportEditions(t *testing.T) {
	store := fixtures.Store{}
	router := reportRouter(nil)
	statuses := map[string]api.Status{"allowed_transfer": api.NOVIOLATIONOBSERVED, "missing_intermediate": api.POTENTIALVIOLATION,
		"unauthorized_transfer": api.VERIFIEDVIOLATION, "shuffled_transfer": api.VERIFIEDVIOLATION, "partial_evidence_confirmed": api.VERIFIEDVIOLATION}
	for _, caseInfo := range store.List() {
		for _, audience := range []string{"executive", "engineering"} {
			for _, lang := range []string{"en", "th"} {
				t.Run(caseInfo.ID+"/"+audience+"/"+lang, func(t *testing.T) {
					events, _, err := store.Load(t.Context(), caseInfo.ID)
					if err != nil {
						t.Fatal(err)
					}
					valid := map[string]bool{}
					for _, e := range events {
						valid[e.EventID] = true
					}
					res := postReport(router, fmt.Sprintf(`{"scenario_id":%q,"audience":%q,"language":%q}`, caseInfo.ID, audience, lang))
					var report api.ReportSummary
					if err := json.Unmarshal(res.Body.Bytes(), &report); err != nil || res.Code != 200 || report.Mode != "fallback" || report.Status != statuses[caseInfo.ID] ||
						report.ScenarioId != caseInfo.ID || string(report.Language) != lang || string(report.Audience) != audience {
						t.Fatal(res.Body)
					}
					kinds := map[api.ReportSectionKind]bool{}
					var sawExport, sawReceipt bool
					for _, item := range report.Sections {
						kinds[item.Kind] = true
						if item.Text == "" || strings.ContainsFunc(item.Text, func(r rune) bool { return unicode.Is(unicode.Thai, r) }) != (lang == "th") {
							t.Fatal(item)
						}
						for _, id := range item.EvidenceEventIds {
							if !valid[id] {
								t.Fatal("foreign citation", id)
							}
						}
						if item.Kind == "conclusion" && strings.Contains(item.Text, "sales-api → external-crm") && slices.Equal(item.EvidenceEventIds, []string{"evt-e-002"}) {
							sawExport = true
						}
						if item.Kind == "uncertainty" && strings.Contains(item.Text, "customer-api → sales-api") && slices.Equal(item.EvidenceEventIds, []string{"evt-e-001"}) {
							sawReceipt = true
						}
					}
					if !kinds["conclusion"] || !kinds["uncertainty"] || !kinds["action"] || kinds["route"] != (audience == "engineering") {
						t.Fatal(kinds)
					}
					if caseInfo.ID == "partial_evidence_confirmed" && !(sawExport && sawReceipt) {
						t.Fatal(report)
					}
				})
			}
		}
	}
}

func TestReportModelRanking(t *testing.T) {
	for _, name := range []string{"accepted", "wrong status", "unknown ref", "duplicate action", "timeout"} {
		t.Run(name, func(t *testing.T) {
			calls := 0
			provider := explanationProvider(func(_ context.Context, req investigation.Request) (investigation.Suggestion, error) {
				calls++
				wire, _ := json.Marshal(req)
				if strings.Contains(string(wire), "evt-") || strings.Contains(string(wire), "sales-api") || req.Audience != "engineering" {
					t.Fatal(string(wire))
				}
				pick := investigation.Suggestion{Status: req.Status, StepIDs: slices.Clone(req.ApplicableStepIDs)}
				for _, ref := range req.Evidence {
					pick.EvidenceRefs = append(pick.EvidenceRefs, ref.Ref)
				}
				slices.Reverse(pick.StepIDs)
				switch name {
				case "wrong status":
					pick.Status = "INCONCLUSIVE"
				case "unknown ref":
					pick.EvidenceRefs[0] = "E999"
				case "duplicate action":
					pick.StepIDs[0] = pick.StepIDs[1]
				case "timeout":
					return pick, context.DeadlineExceeded
				}
				return pick, nil
			})
			res := postReport(reportRouter(provider), `{"scenario_id":"partial_evidence_confirmed","audience":"engineering","language":"en"}`)
			var report api.ReportSummary
			if err := json.Unmarshal(res.Body.Bytes(), &report); err != nil || calls != 1 || report.Status != api.VERIFIEDVIOLATION || (report.Mode == "ai") != (name == "accepted") {
				t.Fatal(report, err, calls)
			}
			first := slices.IndexFunc(report.Sections, func(s api.ReportSection) bool { return s.Kind == "action" })
			if first < 0 || strings.HasPrefix(report.Sections[first].Text, "Policy maintainer") != (name == "accepted") {
				t.Fatal(report.Sections)
			}
		})
	}
}

func TestReportRejectsInvalidInput(t *testing.T) {
	for _, tc := range []struct {
		body string
		code int
	}{
		{`{"scenario_id":"unknown","audience":"executive","language":"en"}`, 404},
		{`{"scenario_id":"allowed_transfer","audience":"all","language":"en"}`, 400},
		{`{"scenario_id":"allowed_transfer","audience":"engineering","language":"xx"}`, 400},
		{`{"scenario_id":"allowed_transfer","audience":"engineering","language":"th","status":"VERIFIED_VIOLATION"}`, 400},
	} {
		if res := postReport(reportRouter(nil), tc.body); res.Code != tc.code {
			t.Fatal(res.Code, res.Body)
		}
	}
}
