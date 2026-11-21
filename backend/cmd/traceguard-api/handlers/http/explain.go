package tracehttp

import (
	"context"
	"net/http"
	"reflect"
	"slices"
	"strings"

	"github.com/labstack/echo/v4"
	api "github.com/peyrone/traceguard-ai/backend/cmd/traceguard-api/handlers/http/api_gen"
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/entities"
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/services/investigation"
)

func (s *server) Explain(c echo.Context) error {
	var request api.ExplainRequest
	if !decodeRequest(c, &request) {
		return fail(c, http.StatusBadRequest, "INVALID_REQUEST", "Expected one JSON request object.")
	}
	finding := request.Finding
	status := entities.Status(finding.Status)
	switch status {
	case entities.VerifiedViolation, entities.PotentialViolation, entities.Inconclusive, entities.NoViolationObserved:
	default:
		return fail(c, http.StatusBadRequest, "INVALID_REQUEST", "Finding status must be a contract value.")
	}
	if strings.TrimSpace(finding.Id) == "" || strings.TrimSpace(finding.RuleId) == "" ||
		strings.TrimSpace(finding.Message) == "" || strings.TrimSpace(request.RuleSummary) == "" ||
		finding.EvidenceEventIds == nil || finding.MissingEvidence == nil || request.Evidence == nil {
		return fail(c, http.StatusBadRequest, "INVALID_REQUEST", "Supply the selected finding, rule summary, and evidence array.")
	}
	evidence := make([]investigation.Evidence, 0, len(request.Evidence))
	for _, event := range request.Evidence {
		if strings.TrimSpace(event.EventId) == "" {
			return fail(c, http.StatusBadRequest, "INVALID_REQUEST", "Each evidence summary requires an opaque event ID.")
		}
		evidence = append(evidence, investigation.Evidence{EventID: event.EventId, Action: optional(event.Action), Outcome: optional(event.Outcome)})
	}
	ctx := c.Request().Context()
	selected := entities.Finding{
		ID: finding.Id, RuleID: finding.RuleId, Status: status, Message: finding.Message,
		EvidenceEventIDs: finding.EvidenceEventIds, MissingEvidence: finding.MissingEvidence,
	}
	var result investigation.Result
	var err error
	if facts := s.fixtureFacts(ctx, selected, evidence); facts != nil {
		result, err = s.investigation.ExplainFixture(ctx, selected, *facts)
	} else {
		result, err = s.investigation.Explain(ctx, selected, evidence)
	}
	if err != nil {
		return fail(c, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
	}
	return c.JSON(http.StatusOK, api.ExplainResponse{
		Explanation: result.Explanation, NextSteps: result.NextSteps, EvidenceEventIds: result.EvidenceEventIDs,
		Mode: api.ExplainResponseMode(result.Mode),
	})
}

// Match the existing finding payload against server-owned analysis. Equivalent
// fixtures (such as the shuffled replay) can share the same explanation facts.
func (s *server) fixtureFacts(ctx context.Context, selected entities.Finding, evidence []investigation.Evidence) *investigation.FixtureFacts {
	if s.fixtures == nil || s.lineage == nil || s.detector == nil {
		return nil
	}
	var matched *investigation.FixtureFacts
	for _, fixture := range s.fixtures.List() {
		events, policy, err := s.fixtures.Load(ctx, fixture.ID)
		if err != nil {
			return nil
		}
		events, graph, findings, err := s.analyze(ctx, events, policy)
		if err != nil {
			return nil
		}
		for _, finding := range findings {
			if !reflect.DeepEqual(finding, selected) {
				continue
			}
			facts := investigation.NewFixtureFacts(finding, events, graph, policy)
			for _, trusted := range facts.Evidence {
				// Preserve existing caller validation for missing or contradictory summaries.
				index := slices.IndexFunc(evidence, func(item investigation.Evidence) bool {
					return item.EventID == trusted.EventID
				})
				if index < 0 {
					return nil
				}
				for _, item := range evidence[index:] {
					if item.EventID == trusted.EventID && (item.Action != "" && item.Action != trusted.Action ||
						item.Outcome != "" && item.Outcome != trusted.Outcome) {
						return nil
					}
				}
			}
			if matched != nil && !reflect.DeepEqual(*matched, facts) {
				return nil
			}
			matched = &facts
		}
	}
	return matched
}
