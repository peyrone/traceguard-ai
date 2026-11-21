// Package investigation explains policy findings using redacted evidence.
package investigation

import (
	"context"
	"errors"
	"slices"
	"strconv"

	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/entities"
)

type Evidence struct {
	EventID string
	Action  string
	Outcome string
}

type EvidenceMetadata struct {
	Ref     string `json:"ref"`
	Action  string `json:"action,omitempty"`
	Outcome string `json:"outcome,omitempty"`
}

type Request struct {
	Status   entities.Status    `json:"status"`
	Evidence []EvidenceMetadata `json:"evidence"`
}

type Suggestion struct {
	Status       entities.Status `json:"status"`
	EvidenceRefs []string        `json:"evidence_refs"`
	StepIDs      []string        `json:"step_ids"`
}

type Provider interface {
	Suggest(ctx context.Context, request Request) (Suggestion, error)
}

type Result struct {
	Status           entities.Status `json:"-"`
	Explanation      string          `json:"explanation"`
	NextSteps        []string        `json:"next_steps"`
	EvidenceEventIDs []string        `json:"evidence_event_ids"`
	Mode             string          `json:"mode"`
}

var ErrInsufficientEvidence = errors.New("the verified finding requires all cited evidence and a supporting send")

type Service struct{ provider Provider }

func New(provider Provider) Service { return Service{provider: provider} }

func (s Service) Explain(ctx context.Context, finding entities.Finding, supplied []Evidence) (Result, error) {
	byID := make(map[string]Evidence, len(supplied))
	for _, item := range supplied {
		if item.EventID != "" {
			byID[item.EventID] = item
		}
	}
	citations := []string{}
	request := Request{Status: finding.Status, Evidence: []EvidenceMetadata{}}
	citedIDs := slices.Compact(sortedCopy(finding.EvidenceEventIDs))
	supportsSend := false
	for _, id := range citedIDs {
		event, exists := byID[id]
		if !exists {
			continue
		}
		citations = append(citations, id)
		// Summary metadata is optional. When present it cannot contradict a completed send.
		supportsSend = supportsSend || ((event.Action == "" || event.Action == "DATA_SENT") &&
			(event.Outcome == "" || event.Outcome == "COMPLETED"))
		request.Evidence = append(request.Evidence, EvidenceMetadata{
			Ref:     "E" + strconv.Itoa(len(citations)),
			Action:  knownValue(event.Action, "DATA_SENT", "DATA_RECEIVED"),
			Outcome: knownValue(event.Outcome, "COMPLETED", "ATTEMPTED", "FAILED"),
		})
	}

	var explanation string
	switch finding.Status {
	case entities.VerifiedViolation:
		if len(citations) != len(citedIDs) || !supportsSend {
			return Result{}, ErrInsufficientEvidence
		}
		explanation = "Verified violation. The selected finding cites evidence of a completed transfer that breached the policy."
	case entities.PotentialViolation:
		explanation = "Potential violation. Available evidence indicates a policy concern with gaps in confirmation."
	case entities.NoViolationObserved:
		explanation = "No violation observed in the available evidence."
	default:
		explanation = "Inconclusive. The available evidence is insufficient to determine the policy result."
	}
	result := Result{Status: finding.Status, Explanation: explanation, NextSteps: defaultSteps(finding.Status), EvidenceEventIDs: citations, Mode: "fallback"}
	if s.provider == nil || ctx.Err() != nil || !knownStatus(finding.Status) {
		return result, nil
	}
	suggestion, err := s.provider.Suggest(ctx, request)
	if err != nil || ctx.Err() != nil || suggestion.Status != finding.Status {
		return result, nil
	}
	expectedRefs := make([]string, 0, len(request.Evidence))
	for _, item := range request.Evidence {
		expectedRefs = append(expectedRefs, item.Ref)
	}
	if !slices.Equal(sortedCopy(expectedRefs), sortedCopy(suggestion.EvidenceRefs)) {
		return result, nil
	}
	if steps := renderSteps(suggestion.StepIDs); len(steps) > 0 {
		result.NextSteps, result.Mode = steps, "ai"
	}
	return result, nil
}

func knownValue(value string, allowed ...string) string {
	if slices.Contains(allowed, value) {
		return value
	}
	return ""
}

func sortedCopy(values []string) []string {
	result := slices.Clone(values)
	slices.Sort(result)
	return result
}

func knownStatus(status entities.Status) bool {
	switch status {
	case entities.VerifiedViolation, entities.PotentialViolation, entities.Inconclusive, entities.NoViolationObserved:
		return true
	default:
		return false
	}
}

var stepText = map[string]string{
	"review_events":   "Review the supporting audit events.",
	"collect_records": "Collect missing send and receipt records.",
	"check_policy":    "Check the destination and purpose against the policy allowlists.",
}

func renderSteps(ids []string) []string {
	if len(ids) == 0 || len(ids) > len(stepText) {
		return nil
	}
	steps := make([]string, 0, len(ids))
	for _, id := range ids {
		text, exists := stepText[id]
		if !exists || slices.Contains(steps, text) {
			return nil
		}
		steps = append(steps, text)
	}
	return steps
}

func defaultSteps(status entities.Status) []string {
	if status == entities.PotentialViolation || status == entities.Inconclusive {
		return renderSteps([]string{"collect_records", "check_policy"})
	}
	return renderSteps([]string{"review_events", "check_policy"})
}
