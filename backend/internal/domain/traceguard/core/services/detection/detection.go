// Package detection evaluates transfer policies against audit evidence.
package detection

import (
	"context"
	"encoding/base64"
	"fmt"
	"slices"
	"sort"
	"strings"

	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/entities"
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/ports"
)

type Evaluator struct{}

var _ ports.Detector = Evaluator{}

type endpoints struct{ source, target string }

func (Evaluator) Detect(ctx context.Context, events []entities.Event, graph entities.Graph, policy entities.Policy) ([]entities.Finding, error) {
	observed := make(map[string]map[endpoints]bool)
	for _, edge := range graph.Edges {
		if edge.EvidenceStatus != entities.Observed {
			continue
		}
		for _, id := range edge.EvidenceEventIDs {
			if observed[id] == nil {
				observed[id] = make(map[endpoints]bool)
			}
			observed[id][endpoints{edge.Source, edge.Target}] = true
		}
	}

	byID := make(map[string]entities.Event, len(events))
	conflicts := make(map[string]bool)
	for _, event := range events {
		if event.EventID == "" || conflicts[event.EventID] {
			continue
		}
		event.OccurredAt = event.OccurredAt.UTC()
		event.ObservedAt = event.OccurredAt // Receipt time may differ between retries.
		if previous, exists := byID[event.EventID]; exists && event != previous {
			delete(byID, event.EventID)
			conflicts[event.EventID] = true
			continue
		}
		byID[event.EventID] = event
	}
	ids := make([]string, 0, len(byID))
	for id := range byID {
		ids = append(ids, id)
	}
	sort.Strings(ids)

	findings := []entities.Finding{}
	allowedIDs := []string{}
	for _, id := range ids {
		if err := ctx.Err(); err != nil {
			return nil, fmt.Errorf("evaluate transfer policy: %w", err)
		}
		event := byID[id]
		if event.Action != "DATA_SENT" && event.Action != "DATA_RECEIVED" {
			continue
		}
		if event.Classification != "" && policy.Classification != "" && event.Classification != policy.Classification {
			continue
		}
		target := event.DestinationService
		if target == "" && event.Action == "DATA_RECEIVED" {
			target = event.Service
		}
		confirmed := event.Action == "DATA_SENT" && event.Outcome == "COMPLETED" &&
			event.SourceService != "" && target != "" && observed[id][endpoints{event.SourceService, target}]
		finding := evaluate(event, target, confirmed, policy)
		if finding.Status == entities.NoViolationObserved {
			allowedIDs = append(allowedIDs, id)
			continue
		}
		findings = append(findings, finding)
	}
	if err := ctx.Err(); err != nil {
		return nil, fmt.Errorf("evaluate transfer policy: %w", err)
	}
	if len(findings) > 0 {
		return findings, nil
	}
	if len(allowedIDs) > 0 {
		return []entities.Finding{{
			ID: "transfer-policy-summary", RuleID: "TRANSFER_POLICY", Status: entities.NoViolationObserved,
			Message:          "Observed in-scope transfers satisfied the destination and purpose rules.",
			EvidenceEventIDs: allowedIDs, MissingEvidence: []string{},
		}}, nil
	}
	return []entities.Finding{{
		ID: "transfer-policy-summary", RuleID: "TRANSFER_POLICY", Status: entities.Inconclusive,
		Message:          "The audit contains no usable in-scope transfer evidence.",
		EvidenceEventIDs: []string{}, MissingEvidence: []string{"in-scope transfer evidence"},
	}}, nil
}

func evaluate(event entities.Event, target string, confirmed bool, policy entities.Policy) entities.Finding {
	finding := entities.Finding{
		ID:     "transfer-" + base64.RawURLEncoding.EncodeToString([]byte(event.EventID)),
		RuleID: "TRANSFER_POLICY", Status: entities.Inconclusive,
		EvidenceEventIDs: []string{event.EventID}, MissingEvidence: []string{},
	}
	var denials []string
	if target == "" {
		finding.MissingEvidence = append(finding.MissingEvidence, "destination service")
	} else if !slices.Contains(policy.AllowedDestinations, target) {
		finding.RuleID = "DENY_EXTERNAL_PII"
		denials = append(denials, "destination is outside the policy allowlist")
	}
	if event.Purpose == "" {
		finding.MissingEvidence = append(finding.MissingEvidence, "transfer purpose")
	} else if !slices.Contains(policy.AllowedPurposes, event.Purpose) {
		if len(denials) == 0 {
			finding.RuleID = "DENY_PURPOSE"
		}
		denials = append(denials, "purpose is outside the policy allowlist")
	}
	classified := event.Classification != "" && policy.Classification != ""
	if !classified {
		finding.MissingEvidence = append(finding.MissingEvidence, "applicable data classification")
	}
	if !confirmed {
		finding.MissingEvidence = append(finding.MissingEvidence, "observed completed send with matching endpoints")
	}
	switch {
	case len(denials) > 0 && confirmed && classified:
		finding.Status = entities.VerifiedViolation
		finding.MissingEvidence = []string{}
		finding.Message = "Observed completed transfer: " + strings.Join(denials, "; ") + "."
	case len(denials) > 0 && classified:
		finding.Status = entities.PotentialViolation
		finding.Message = "Transfer evidence indicates a policy concern: " + strings.Join(denials, "; ") + "."
	case len(finding.MissingEvidence) == 0:
		finding.Status = entities.NoViolationObserved
	default:
		finding.Message = "Missing evidence prevents a conclusion under the transfer policy."
		if len(denials) > 0 {
			finding.Message = "Cannot establish policy applicability. Indicators: " + strings.Join(denials, "; ") + "."
		}
	}
	return finding
}
