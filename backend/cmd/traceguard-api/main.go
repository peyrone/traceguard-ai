package main

import (
	"os"
	"strings"

	"github.com/labstack/echo/v4"
	tracehttp "github.com/peyrone/traceguard-ai/backend/cmd/traceguard-api/handlers/http"
	"github.com/peyrone/traceguard-ai/backend/internal/adapters/ai"
	"github.com/peyrone/traceguard-ai/backend/internal/adapters/fixtures"
	"github.com/peyrone/traceguard-ai/backend/internal/config"
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/services/detection"
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/services/investigation"
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/services/lineage"
)

func main() {
	router := echo.New()
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
	router.Logger.Fatal(router.Start(config.Load().Address))
}
