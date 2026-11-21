package handler

import (
	"net/http"

	"github.com/peyrone/traceguard-ai/backend/internal/app"
)

func NotFound(w http.ResponseWriter, r *http.Request) {
	app.ServeFunction(w, r, "/api/v1/unknown")
}
