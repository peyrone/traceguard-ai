package handler

import (
	"net/http"

	"github.com/peyrone/traceguard-ai/backend/internal/app"
)

func Scenarios(w http.ResponseWriter, r *http.Request) {
	app.ServeFunction(w, r, "/api/v1/scenarios")
}
