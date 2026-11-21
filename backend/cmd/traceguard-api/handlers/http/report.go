package tracehttp

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/labstack/echo/v4"
	api "github.com/peyrone/traceguard-ai/backend/cmd/traceguard-api/handlers/http/api_gen"
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/entities"
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/ports"
)

func (s *server) CreateReportSummary(c echo.Context) error {
	var request api.ReportSummaryRequest
	reader := http.MaxBytesReader(c.Response(), c.Request().Body, 2<<20)
	decoder := json.NewDecoder(reader)
	decoder.DisallowUnknownFields()
	if decoder.Decode(&request) != nil || decoder.Decode(new(any)) != io.EOF || !entities.Meaningful(request.ScenarioId) ||
		(request.Audience != api.Executive && request.Audience != api.Engineering) || (request.Language != api.En && request.Language != api.Th) {
		return fail(c, http.StatusBadRequest, "INVALID_REQUEST", "Supply a scenario ID, supported audience and report language.")
	}
	ctx := c.Request().Context()
	if s.fixtures == nil {
		return fail(c, http.StatusNotFound, "SCENARIO_NOT_FOUND", "Unknown scenario.")
	}
	events, policy, err := s.fixtures.Load(ctx, request.ScenarioId)
	if errors.Is(err, ports.ErrScenarioNotFound) {
		return fail(c, http.StatusNotFound, "SCENARIO_NOT_FOUND", "Unknown scenario.")
	}
	if err != nil {
		return fail(c, http.StatusInternalServerError, "ANALYSIS_FAILED", "Could not load the scenario.")
	}
	events, graph, findings, err := s.analyze(ctx, events, policy)
	if err != nil {
		return fail(c, http.StatusInternalServerError, "ANALYSIS_FAILED", "Could not evaluate the policy.")
	}
	status := caseStatus(len(events), findings)
	sections, mode := s.investigation.Report(ctx, string(request.Audience), string(request.Language), status, graph, findings, events)
	result := api.ReportSummary{ScenarioId: request.ScenarioId, Audience: request.Audience, Language: request.Language, Status: api.Status(status), Mode: api.ReportSummaryMode(mode)}
	for _, section := range sections {
		item := api.ReportSection{Kind: api.ReportSectionKind(section.Kind), Text: section.Text, EvidenceEventIds: append([]string{}, section.EvidenceEventIDs...)}
		if section.RuleID != "" {
			item.RuleId = &section.RuleID
		}
		result.Sections = append(result.Sections, item)
	}
	return c.JSON(http.StatusOK, result)
}
