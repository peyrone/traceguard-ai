package handler

import (
	"net/http"

	"github.com/peyrone/traceguard-ai/backend/vercelapi"
)

func Explain(w http.ResponseWriter, r *http.Request) {
	vercelapi.ServeFunction(w, r, "/api/v1/explain")
}
