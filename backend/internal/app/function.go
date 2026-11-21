package app

import (
	"net/http"
	"sync"

	"github.com/peyrone/traceguard-ai/backend/internal/config"
)

var functionRouter = sync.OnceValue(func() http.Handler {
	return Router(config.Load())
})

// ServeFunction binds a Vercel function to its public API route, including
// requests whose path was rewritten before reaching the function.
func ServeFunction(w http.ResponseWriter, r *http.Request, path string) {
	request := r.Clone(r.Context())
	request.URL.Path = path
	request.URL.RawPath = ""
	functionRouter().ServeHTTP(w, request)
}
