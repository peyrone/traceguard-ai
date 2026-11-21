package tracehttp

import (
	"net/http"
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
	result, err := s.investigation.Explain(c.Request().Context(), entities.Finding{
		Status: status, EvidenceEventIDs: finding.EvidenceEventIds,
	}, evidence)
	if err != nil {
		return fail(c, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
	}
	return c.JSON(http.StatusOK, api.ExplainResponse{
		Explanation: result.Explanation, NextSteps: result.NextSteps, EvidenceEventIds: result.EvidenceEventIDs,
		Mode: api.ExplainResponseMode(result.Mode),
	})
}
