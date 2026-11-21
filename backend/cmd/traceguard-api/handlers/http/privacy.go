package tracehttp

import (
	"net/http"

	"github.com/labstack/echo/v4"
	api "github.com/peyrone/traceguard-ai/backend/cmd/traceguard-api/handlers/http/api_gen"
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/entities"
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/services/enforcement"
)

func (s *server) CreatePrivacyDecision(c echo.Context) error {
	var input *api.PrivacyDecisionRequest
	if !decodeRequest(c, &input) || input == nil {
		return fail(c, http.StatusBadRequest, "INVALID_REQUEST", "Expected one privacy decision request object.")
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
	// Only the server-owned demo policy may authorize this simulation.
	if request.PolicyID == "policy-001" && s.fixtures != nil {
		if _, loaded, err := s.fixtures.Load(ctx, "allowed_transfer"); err == nil {
			policy = &loaded
		}
	}
	result := enforcement.Simulate(ctx, request, policy)
	return c.JSON(http.StatusOK, api.PrivacyDecisionResponse{
		Decision: api.PrivacyDecisionResponseDecision(result.Decision), RuleId: result.RuleID,
		Reason: result.Reason, TransferExecuted: result.TransferExecuted,
	})
}
