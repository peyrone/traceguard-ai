package tracehttp

import (
	"errors"
	"net/http"
	"slices"

	"github.com/labstack/echo/v4"
	api "github.com/peyrone/traceguard-ai/backend/cmd/traceguard-api/handlers/http/api_gen"
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/entities"
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/ports"
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/services/enforcement"
)

func (s *server) CreatePrivacyDecision(c echo.Context) error {
	var input *api.PrivacyDecisionRequest
	if !decodeRequest(c, &input) || input == nil {
		return fail(c, http.StatusBadRequest, "INVALID_REQUEST", "Expected one privacy decision request object.")
	}
	if input.ScenarioId != nil || input.CandidateId != nil {
		return s.createScenarioPrivacyDecision(c, input)
	}
	request := enforcement.Request{
		SourceService: optional(input.SourceService), DestinationService: optional(input.DestinationService),
		Purpose: optional(input.Purpose), PolicyID: optional(input.PolicyId),
	}
	if input.DataCategories != nil {
		request.DataCategories = *input.DataCategories
	}

	ctx := c.Request().Context()
	var policy *entities.Policy
	// Keep the original server-owned policy for legacy explicit requests.
	if request.PolicyID == "policy-001" && s.fixtures != nil {
		if _, loaded, err := s.fixtures.Load(ctx, "allowed_transfer"); err == nil {
			policy = &loaded
		}
	}
	return privacyResponse(c, enforcement.Simulate(ctx, request, policy))
}

func privacyResponse(c echo.Context, result enforcement.Result) error {
	return c.JSON(http.StatusOK, api.PrivacyDecisionResponse{
		Decision: api.PrivacyDecisionResponseDecision(result.Decision), RuleId: result.RuleID,
		Reason: result.Reason, TransferExecuted: result.TransferExecuted,
	})
}

func (s *server) createScenarioPrivacyDecision(c echo.Context, input *api.PrivacyDecisionRequest) error {
	scenarioID, candidateID := optional(input.ScenarioId), optional(input.CandidateId)
	if !entities.Meaningful(scenarioID) || !entities.Meaningful(candidateID) ||
		input.SourceService != nil || input.DestinationService != nil || input.Purpose != nil ||
		input.DataCategories != nil || input.PolicyId != nil {
		return fail(c, http.StatusBadRequest, "INVALID_REQUEST", "Supply only a scenario ID and candidate ID for a scenario transfer.")
	}
	if s.fixtures == nil {
		return fail(c, http.StatusNotFound, "SCENARIO_NOT_FOUND", "Unknown scenario.")
	}
	ctx := c.Request().Context()
	events, policy, err := s.fixtures.Load(ctx, scenarioID)
	if errors.Is(err, ports.ErrScenarioNotFound) {
		return fail(c, http.StatusNotFound, "SCENARIO_NOT_FOUND", "Unknown scenario.")
	}
	if err != nil || s.lineage == nil {
		return privacyResponse(c, enforcement.Result{
			Decision: enforcement.Indeterminate, RuleID: "TRANSFER_POLICY", Reason: "Scenario evidence or policy is unavailable.",
		})
	}
	events, graph := s.lineage.Reconstruct(events)
	candidates := enforcement.Candidates(scenarioID, events, graph, policy)
	index := slices.IndexFunc(candidates, func(candidate enforcement.Candidate) bool { return candidate.ID == candidateID })
	if index < 0 {
		return fail(c, http.StatusNotFound, "CANDIDATE_NOT_FOUND", "No such transfer candidate belongs to this scenario.")
	}
	return privacyResponse(c, enforcement.SimulateCandidate(ctx, candidates[index], policy))
}
