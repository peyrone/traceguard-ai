package app

import (
	"net/http"
	"os"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	tracehttp "github.com/peyrone/traceguard-ai/backend/cmd/traceguard-api/handlers/http"
	"github.com/peyrone/traceguard-ai/backend/internal/adapters/ai"
	"github.com/peyrone/traceguard-ai/backend/internal/adapters/fixtures"
	"github.com/peyrone/traceguard-ai/backend/internal/config"
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/services/detection"
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/services/investigation"
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/services/lineage"
)

// Router builds the same HTTP API for local and serverless entry points.
func Router(settings config.Config) *echo.Echo {
	router := echo.New()
	router.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: settings.AllowedOrigins,
		AllowMethods: []string{http.MethodGet, http.MethodPost, http.MethodOptions},
		AllowHeaders: []string{echo.HeaderContentType},
	}))
	graph := lineage.Service{NodeKinds: map[string]string{
		"customer-api": "internal",
		"sales-api":    "internal",
		"external-crm": "external",
	}}
	var provider investigation.Provider
	apiKey := strings.TrimSpace(os.Getenv("OPENAI_API_KEY"))
	model := strings.TrimSpace(os.Getenv("TRACEGUARD_OPENAI_MODEL"))
	if apiKey != "" && model != "" {
		provider = ai.New(apiKey, model, 0, nil)
	}
	tracehttp.Register(router, fixtures.Store{}, graph, detection.Evaluator{}, investigation.New(provider))
	return router
}
