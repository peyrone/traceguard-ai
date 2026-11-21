package handler

import (
	"net/http"

	"github.com/peyrone/traceguard-ai/backend/vercelapi"
)

func Healthz(w http.ResponseWriter, r *http.Request) {
	vercelapi.ServeFunction(w, r, "/healthz")
}
