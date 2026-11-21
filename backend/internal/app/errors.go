package app

import (
	"errors"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
	api "github.com/peyrone/traceguard-ai/backend/cmd/traceguard-api/handlers/http/api_gen"
)

func handleHTTPError(err error, c echo.Context) {
	if c.Response().Committed {
		return
	}

	status := http.StatusInternalServerError
	var httpErr *echo.HTTPError
	if errors.As(err, &httpErr) {
		status = httpErr.Code
	}

	message := http.StatusText(status)
	code := strings.ReplaceAll(strings.ToUpper(message), " ", "_")
	switch status {
	case http.StatusBadRequest:
		code = "INVALID_REQUEST"
	default:
		if code == "" {
			code, message = "HTTP_ERROR", "HTTP error"
		}
	}

	var writeErr error
	if c.Request().Method == http.MethodHead {
		writeErr = c.NoContent(status)
	} else {
		writeErr = c.JSON(status, api.Error{Code: code, Message: message})
	}
	if writeErr != nil {
		c.Logger().Error(writeErr)
	}
}
