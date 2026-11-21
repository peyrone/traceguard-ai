package main

import (
	"github.com/labstack/echo/v4"
	tracehttp "github.com/peyrone/traceguard-ai/backend/cmd/traceguard-api/handlers/http"
	"github.com/peyrone/traceguard-ai/backend/internal/adapters/fixtures"
	"github.com/peyrone/traceguard-ai/backend/internal/config"
	"github.com/peyrone/traceguard-ai/backend/internal/domain/traceguard/core/services/lineage"
)

func main() {
	router := echo.New()
	graph := lineage.Service{NodeKinds: map[string]string{
		"customer-api": "internal",
		"sales-api":    "internal",
		"external-crm": "external",
	}}
	tracehttp.Register(router, fixtures.Store{}, graph, nil)
	router.Logger.Fatal(router.Start(config.Load().Address))
}
