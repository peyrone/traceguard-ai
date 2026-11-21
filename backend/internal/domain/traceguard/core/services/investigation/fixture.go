package investigation

import (
	"context"
	"slices"

	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/entities"
)

type evidenceGap string

const (
	completedSend evidenceGap = "completed_send"
	destination   evidenceGap = "destination"
	purpose       evidenceGap = "purpose"
	dataClass     evidenceGap = "classification"
	transfer      evidenceGap = "in_scope_transfer"
)

// FixtureFacts contains only the facts needed to explain a server-owned finding.
type FixtureFacts struct {
	Evidence       []Evidence
	transfers      map[string]entities.EvidenceStatus
	classification string
	gaps           []evidenceGap
}

func NewFixtureFacts(finding entities.Finding, events []entities.Event, graph entities.Graph, policy entities.Policy) FixtureFacts {
	facts := FixtureFacts{
		classification: knownValue(policy.Classification, "PII"),
		transfers:      make(map[string]entities.EvidenceStatus),
	}
	for _, event := range events {
		if slices.Contains(finding.EvidenceEventIDs, event.EventID) {
			facts.Evidence = append(facts.Evidence, Evidence{EventID: event.EventID, Action: event.Action, Outcome: event.Outcome})
		}
	}
	for _, edge := range graph.Edges {
		for _, id := range edge.EvidenceEventIDs {
			if slices.Contains(finding.EvidenceEventIDs, id) && facts.transfers[id] != entities.Observed {
				facts.transfers[id] = edge.EvidenceStatus
			}
		}
	}
	for _, gap := range finding.MissingEvidence {
		switch gap {
		case "observed completed send with matching endpoints":
			facts.gaps = append(facts.gaps, completedSend)
		case "destination service":
			facts.gaps = append(facts.gaps, destination)
		case "transfer purpose":
			facts.gaps = append(facts.gaps, purpose)
		case "applicable data classification":
			facts.gaps = append(facts.gaps, dataClass)
		case "in-scope transfer evidence":
			facts.gaps = append(facts.gaps, transfer)
		}
	}
	return facts
}

func (s Service) ExplainFixture(ctx context.Context, finding entities.Finding, facts FixtureFacts) (Result, error) {
	steps := []string{"review_events", "check_policy"}
	if finding.Status == entities.VerifiedViolation {
		steps = []string{"review_export", "check_policy"}
	} else if slices.Contains(facts.gaps, completedSend) {
		steps = []string{"collect_completed_send", "review_events"}
	}
	return s.explain(ctx, finding, facts.Evidence, Request{
		Rule:           knownValue(finding.RuleID, "DENY_EXTERNAL_PII", "DENY_PURPOSE", "TRANSFER_POLICY"),
		Classification: facts.classification, MissingEvidence: facts.gaps, ApplicableStepIDs: steps,
	}, facts.transfers, steps)
}
