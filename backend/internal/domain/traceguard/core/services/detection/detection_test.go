package detection_test

import (
	"context"
	"reflect"
	"testing"

	"github.com/peyrone/traceguard-ai/backend/internal/adapters/fixtures"
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/entities"
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/services/detection"
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/services/lineage"
)

func TestDemoScenarios(t *testing.T) {
	var direct entities.Finding
	for _, tc := range []struct {
		id       string
		want     entities.Status
		evidence string
	}{
		{"allowed_transfer", entities.NoViolationObserved, "evt-a-001"},
		{"unauthorized_transfer", entities.VerifiedViolation, "evt-003"},
		{"shuffled_transfer", entities.VerifiedViolation, "evt-s-003"},
		{"missing_intermediate", entities.PotentialViolation, "evt-004"},
	} {
		t.Run(tc.id, func(t *testing.T) {
			input, policy, err := (fixtures.Store{}).Load(t.Context(), tc.id)
			if err != nil {
				t.Fatal(err)
			}
			events, graph := (lineage.Service{}).Reconstruct(input)
			got, err := (detection.Evaluator{}).Detect(t.Context(), events, graph, policy)
			if err != nil || len(got) != 1 || got[0].Status != tc.want || !reflect.DeepEqual(got[0].EvidenceEventIDs, []string{tc.evidence}) {
				t.Fatalf("findings=%+v err=%v", got, err)
			}
			if tc.id == "unauthorized_transfer" {
				direct = got[0]
			}
			if tc.id == "shuffled_transfer" {
				direct.ID = got[0].ID
				direct.EvidenceEventIDs = []string{tc.evidence}
				if !reflect.DeepEqual(direct, got[0]) {
					t.Fatalf("shuffled finding = %+v, want %+v", got[0], direct)
				}
			}
		})
	}
}

func TestEvidenceAndPolicy(t *testing.T) {
	event := entities.Event{EventID: "evt-test", Action: "DATA_SENT", Outcome: "COMPLETED", SourceService: "sales", DestinationService: "crm", Classification: "PII", Purpose: "SUPPORT"}
	policy := entities.Policy{Classification: "PII", AllowedDestinations: []string{"crm"}, AllowedPurposes: []string{"SUPPORT"}}
	for _, tc := range []struct {
		name, destination, purpose, outcome string
		edgeStatus                          entities.EvidenceStatus
		edgeSource, evidenceID              string
		want                                entities.Status
		rule                                string
	}{
		{"denied purpose", "crm", "MARKETING", "COMPLETED", entities.Observed, "sales", event.EventID, entities.VerifiedViolation, "DENY_PURPOSE"},
		{"denied destination", "external", "SUPPORT", "COMPLETED", entities.Observed, "sales", event.EventID, entities.VerifiedViolation, "DENY_EXTERNAL_PII"},
		{"inferred only", "external", "SUPPORT", "COMPLETED", entities.Inferred, "sales", event.EventID, entities.PotentialViolation, "DENY_EXTERNAL_PII"},
		{"attempted", "external", "SUPPORT", "ATTEMPTED", entities.Observed, "sales", event.EventID, entities.PotentialViolation, "DENY_EXTERNAL_PII"},
		{"failed", "external", "SUPPORT", "FAILED", entities.Observed, "sales", event.EventID, entities.PotentialViolation, "DENY_EXTERNAL_PII"},
		{"wrong edge endpoints", "external", "SUPPORT", "COMPLETED", entities.Observed, "other", event.EventID, entities.PotentialViolation, "DENY_EXTERNAL_PII"},
		{"wrong evidence id", "external", "SUPPORT", "COMPLETED", entities.Observed, "sales", "absent", entities.PotentialViolation, "DENY_EXTERNAL_PII"},
		{"unknown purpose", "crm", "", "COMPLETED", entities.Observed, "sales", event.EventID, entities.Inconclusive, "TRANSFER_POLICY"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			input := event
			input.DestinationService, input.Purpose, input.Outcome = tc.destination, tc.purpose, tc.outcome
			graph := entities.Graph{Edges: []entities.Edge{{Source: tc.edgeSource, Target: tc.destination, EvidenceStatus: tc.edgeStatus, EvidenceEventIDs: []string{tc.evidenceID}}}}
			got, err := (detection.Evaluator{}).Detect(t.Context(), []entities.Event{input, input}, graph, policy)
			if err != nil || len(got) != 1 || got[0].Status != tc.want || got[0].RuleID != tc.rule || !reflect.DeepEqual(got[0].EvidenceEventIDs, []string{event.EventID}) {
				t.Fatalf("findings=%+v err=%v", got, err)
			}
			if (tc.want != entities.VerifiedViolation) != (len(got[0].MissingEvidence) > 0) {
				t.Fatalf("missing evidence = %v", got[0].MissingEvidence)
			}
		})
	}
	got, err := (detection.Evaluator{}).Detect(context.Background(), nil, entities.Graph{}, policy)
	if err != nil || len(got) != 1 || got[0].Status != entities.Inconclusive || len(got[0].EvidenceEventIDs) != 0 {
		t.Fatalf("empty audit findings=%+v err=%v", got, err)
	}
}

func TestBlankEndpointCannotVerifyTransfer(t *testing.T) {
	event := entities.Event{EventID: "send", Action: "DATA_SENT", Outcome: "COMPLETED", SourceService: "sales-api", DestinationService: " 	 ", Classification: "PII"}
	graph := entities.Graph{Edges: []entities.Edge{{Source: event.SourceService, Target: event.DestinationService, EvidenceStatus: entities.Observed, EvidenceEventIDs: []string{event.EventID}}}}
	findings, err := (detection.Evaluator{}).Detect(t.Context(), []entities.Event{event}, graph, entities.Policy{Classification: "PII"})
	if err != nil || len(findings) != 1 || findings[0].Status != entities.Inconclusive {
		t.Fatalf("findings = %+v, err = %v", findings, err)
	}
}
