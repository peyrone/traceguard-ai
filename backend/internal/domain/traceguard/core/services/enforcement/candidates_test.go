package enforcement

import (
	"slices"
	"testing"

	"github.com/peyrone/traceguard-ai/backend/internal/adapters/fixtures"
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/entities"
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/services/lineage"
)

func TestScenarioCandidates(t *testing.T) {
	for _, tc := range []struct {
		scenario           string
		observed, inferred int
		crmPurpose         string
	}{
		{"allowed_transfer", 4, 0, ""},
		{"unauthorized_transfer", 5, 0, "MARKETING"},
		{"shuffled_transfer", 5, 0, "MARKETING"},
		{"missing_intermediate", 3, 1, ""},
		{"partial_evidence_confirmed", 3, 1, "CUSTOMER_SERVICE"},
	} {
		t.Run(tc.scenario, func(t *testing.T) {
			input, policy, err := (fixtures.Store{}).Load(t.Context(), tc.scenario)
			if err != nil {
				t.Fatal(err)
			}
			events, graph := (lineage.Service{}).Reconstruct(input)
			candidates := Candidates(tc.scenario, events, graph, policy)
			observed, inferred := 0, 0
			crmPurpose := ""
			ids := map[string]bool{}
			for _, candidate := range candidates {
				if candidate.ID == "" || ids[candidate.ID] {
					t.Fatalf("invalid candidate ID: %q", candidate.ID)
				}
				ids[candidate.ID] = true
				request := candidate.Request
				if tc.scenario == "allowed_transfer" {
					result := SimulateCandidate(t.Context(), candidate, policy)
					if result.Decision != Allow || !result.TransferExecuted || result.Transfer == nil {
						t.Fatalf("allowed scenario blocked %v: %+v", candidate.EvidenceEventIDs, result)
					}
				}
				if request.PolicyID != policy.PolicyID || !slices.ContainsFunc(graph.Edges, func(edge entities.Edge) bool {
					return edge.ID == candidate.EdgeID && edge.Source == request.SourceService &&
						edge.Target == request.DestinationService && edge.EvidenceStatus == candidate.EvidenceStatus
				}) {
					t.Fatalf("candidate is outside the selected graph or policy: %+v", candidate)
				}
				for _, endpoint := range []string{request.SourceService, request.DestinationService} {
					if !slices.ContainsFunc(graph.Nodes, func(node entities.Node) bool { return node.ID == endpoint }) {
						t.Fatalf("endpoint %s is not in graph", endpoint)
					}
				}
				if candidate.EvidenceStatus == entities.Inferred {
					inferred++
					result := SimulateCandidate(t.Context(), candidate, policy)
					if result.Decision != Indeterminate || result.TransferExecuted || result.Transfer != nil {
						t.Fatalf("inferred candidate executed: %+v", result)
					}
					continue
				}
				observed++
				if len(candidate.EvidenceEventIDs) != 1 || !slices.ContainsFunc(events, func(event entities.Event) bool {
					return event.EventID == candidate.EvidenceEventIDs[0] && event.SourceService == request.SourceService &&
						event.DestinationService == request.DestinationService && event.Purpose == request.Purpose &&
						slices.Equal(request.DataCategories, []string{event.Classification})
				}) {
					t.Fatalf("candidate attributes do not match the evidence: %+v", candidate)
				}
				if request.DestinationService == "external-crm" {
					crmPurpose = request.Purpose
					purposeOnly := policy
					purposeOnly.AllowedDestinations = []string{"external-crm"}
					if crmPurpose == "MARKETING" {
						result := SimulateCandidate(t.Context(), candidate, purposeOnly)
						if result.Decision != Deny || result.RuleID != "DENY_PURPOSE" || result.TransferExecuted {
							t.Fatalf("purpose-only violation was lost: %+v", result)
						}
					}
				}
			}
			if observed != tc.observed || inferred != tc.inferred || crmPurpose != tc.crmPurpose {
				t.Fatalf("observed=%d inferred=%d crm purpose=%q", observed, inferred, crmPurpose)
			}
		})
	}
}
