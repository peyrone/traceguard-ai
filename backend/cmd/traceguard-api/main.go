package main

import (
	"github.com/peyrone/traceguard-ai/backend/internal/app"
	"github.com/peyrone/traceguard-ai/backend/internal/config"
)

func main() {
	settings := config.Load()
	router := app.Router(settings)
	router.Logger.Fatal(router.Start(settings.Address))
}
