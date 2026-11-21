// Package vercelapi exposes the HTTP adapter to Vercel's generated handler module.
package vercelapi

import (
	"net/http"

	"github.com/peyrone/traceguard-ai/backend/internal/app"
)

// ServeFunction forwards a Vercel function request to its public API route.
func ServeFunction(w http.ResponseWriter, r *http.Request, path string) {
	app.ServeFunction(w, r, path)
}
