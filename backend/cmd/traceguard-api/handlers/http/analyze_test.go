package tracehttp

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
)

func TestRoutes(t *testing.T) {
	router := echo.New()
	Register(router, nil, nil, nil)
	for _, test := range []struct {
		method, path, input, contains string
		status                        int
	}{
		{http.MethodGet, "/healthz", "", "ok", 200},
		{http.MethodPost, "/api/v1/analyze", "{}", "INVALID_REQUEST", 400},
		{http.MethodPost, "/api/v1/analyze", `{"scenario_id":"unknown"}`, "SCENARIO_NOT_FOUND", 404},
	} {
		req := httptest.NewRequest(test.method, test.path, strings.NewReader(test.input))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		res := httptest.NewRecorder()
		router.ServeHTTP(res, req)
		if res.Code != test.status || !strings.Contains(res.Body.String(), test.contains) {
			t.Errorf("%s %s: got %d %s", test.method, test.path, res.Code, res.Body.String())
		}
	}
}
