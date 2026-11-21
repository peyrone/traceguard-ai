package handler

import (
	"net/http"

	"github.com/peyrone/traceguard-ai/backend/internal/app"
)

func Healthz(w http.ResponseWriter, r *http.Request) {
	app.ServeFunction(w, r, "/healthz")
}
