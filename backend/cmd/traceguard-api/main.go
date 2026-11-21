package main

import (
	"github.com/labstack/echo/v4"
	tracehttp "github.com/peyrone/traceguard-ai/backend/cmd/traceguard-api/handlers/http"
	"github.com/peyrone/traceguard-ai/backend/internal/config"
)

func main() {
	router := echo.New()
	tracehttp.Register(router, nil, nil, nil)
	router.Logger.Fatal(router.Start(config.Load().Address))
}
