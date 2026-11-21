// Package investigation explains policy findings using redacted evidence.
package investigation

import (
	"context"
	"errors"
	"log"
	"slices"
	"strconv"
	"time"

	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/entities"
)

type Evidence struct {
	EventID string
	Action  string
	Outcome string
}

type EvidenceMetadata struct {
	Ref      string                  `json:"ref"`
	Action   string                  `json:"action,omitempty"`
	Outcome  string                  `json:"outcome,omitempty"`
	Transfer entities.EvidenceStatus `json:"transfer,omitempty"`
}

type Request struct {
	Status            entities.Status    `json:"status"`
	Evidence          []EvidenceMetadata `json:"evidence"`
	Rule              string             `json:"rule,omitempty"`
	Classification    string             `json:"classification,omitempty"`
	MissingEvidence   []evidenceGap      `json:"missing_evidence,omitempty"`
	Review            *reviewPrompt      `json:"review,omitempty"`
	ApplicableStepIDs []string           `json:"applicable_step_ids"`
}

type Suggestion struct {
	Status       entities.Status `json:"status"`
	EvidenceRefs []string        `json:"evidence_refs"`
	StepIDs      []string        `json:"step_ids"`
	Review       *ReviewRanking  `json:"review,omitempty"`
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
	Review           EvidenceReview  `json:"-"`
}

var ErrInsufficientEvidence = errors.New("the verified finding requires all cited evidence and a supporting send")

type Service struct{ provider Provider }

func New(provider Provider) Service { return Service{provider: provider} }

func (s Service) Explain(ctx context.Context, finding entities.Finding, supplied []Evidence) (Result, error) {
	steps := []string{"review_events", "check_policy"}
	if finding.Status == entities.PotentialViolation || finding.Status == entities.Inconclusive {
		steps = []string{"collect_records", "check_policy"}
	}
	return s.explain(ctx, finding, supplied, Request{
		ApplicableStepIDs: steps,
	}, nil, steps, EvidenceReview{})
}

func (s Service) explain(ctx context.Context, finding entities.Finding, supplied []Evidence, request Request, transfers map[string]entities.EvidenceStatus, fallbackSteps []string, review EvidenceReview) (Result, error) {
	byID := make(map[string]Evidence, len(supplied))
	for _, item := range supplied {
		if item.EventID != "" {
			byID[item.EventID] = item
		}
	}
	citations := []string{}
	request.Status = finding.Status
	request.Evidence = []EvidenceMetadata{}
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
			Ref:      "E" + strconv.Itoa(len(citations)),
			Action:   knownValue(event.Action, "DATA_SENT", "DATA_RECEIVED"),
			Outcome:  knownValue(event.Outcome, "COMPLETED", "ATTEMPTED", "FAILED"),
			Transfer: transfers[id],
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
	result := Result{Status: finding.Status, Explanation: explanation, NextSteps: renderSteps(fallbackSteps), EvidenceEventIDs: citations, Mode: "fallback", Review: review}
	if s.provider == nil || ctx.Err() != nil || !knownStatus(finding.Status) {
	result := Result{Status: finding.Status, Explanation: explanation, NextSteps: renderSteps(fallbackSteps), EvidenceEventIDs: citations, Mode: "fallback"}
	if len(citations) == 0 || s.provider == nil || ctx.Err() != nil || !knownStatus(finding.Status) {
		return result, nil
	}
	if len(review.Insights) > 0 || len(review.Mappings) > 0 {
		aliases := make(map[string]string)
		for _, id := range citations {
			aliases[id] = "E" + strconv.Itoa(len(aliases)+1)
		}
		for _, item := range review.Insights {
			for _, id := range item.EvidenceEventIDs {
				if _, exists := aliases[id]; !exists {
					aliases[id] = "E" + strconv.Itoa(len(aliases)+1)
				}
			}
		}
		choices := reviewChoices(review, aliases)
		request.Review = &choices
	}
	start := time.Now()
	suggestion, err := s.provider.Suggest(ctx, request)
	duration := time.Since(start)
	category := "none"
	defer func() {
		log.Printf("investigation provider duration_ms=%d fallback_category=%s", duration.Milliseconds(), category)
	}()
	switch {
	case errors.Is(err, context.Canceled) || errors.Is(ctx.Err(), context.Canceled):
		category = "canceled"
	case errors.Is(err, context.DeadlineExceeded) || errors.Is(ctx.Err(), context.DeadlineExceeded):
		category = "timeout"
	case err != nil:
		category = "provider_error"
	case suggestion.Status != finding.Status:
		category = "classification_mismatch"
	}
	if category != "none" {
		return result, nil
	}
	expectedRefs := make([]string, 0, len(request.Evidence))
	for _, item := range request.Evidence {
		expectedRefs = append(expectedRefs, item.Ref)
	}
	if !slices.Equal(sortedCopy(expectedRefs), sortedCopy(suggestion.EvidenceRefs)) {
		category = "citation_mismatch"
		return result, nil
	}
	for _, id := range suggestion.StepIDs {
		if !slices.Contains(request.ApplicableStepIDs, id) {
			category = "invalid_actions"
			return result, nil
		}
	}
	steps := renderSteps(suggestion.StepIDs)
	if len(steps) == 0 {
		category = "invalid_actions"
		return result, nil
	}
	if request.Review != nil {
		if suggestion.Review == nil {
			category = "missing_review"
			return result, nil
		}
		ranked, valid := rankReview(review, *request.Review, *suggestion.Review)
		if !valid {
			category = "invalid_review"
			return result, nil
		}
		result.Review = ranked
	} else if suggestion.Review != nil {
		category = "unexpected_review"
		return result, nil
	}
	result.NextSteps, result.Mode = steps, "ai"
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
	"review_export":          "Review the logged completed export and its destination.",
	"collect_completed_send": "Obtain the completed send record with matching transfer endpoints.",
	"review_events":          "Review the supporting audit events.",
	"collect_records":        "Collect missing send and receipt records.",
	"check_policy":           "Check the destination and purpose against the policy allowlists.",
}

func renderSteps(ids []string) []string {
	if len(ids) == 0 || len(ids) > 3 {
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
