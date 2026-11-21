# Build-day OpenAPI Codegen Checklist

Use only public dependencies; do not copy private Makefiles or generated artifacts. The following is a plan, not a finished generator.

1. During the build window, BE1 creates `backend/docs/traceguard-api/doc.yaml` (OpenAPI 3.x) from the reviewed Markdown API blueprint.
2. Install a pinned public `oapi-codegen` version and choose the appropriate Echo bindings/config supported by that version.
3. BE1 creates a build-day Makefile target `gen-api` that runs generation into `backend/cmd/traceguard-api/handlers/http/api_gen/`.
4. BE1 implements handlers separately in `cmd/traceguard-api/handlers/http/` and maps API DTOs to pure domain entities.
5. `api_gen/` must contain only generated Go code; do not hand-edit.
6. Backend's `go test ./...` and `go vet ./...` should pass after regeneration.
7. FE2 authors matching TS client contracts from the reviewed spec. Avoid introducing a second source of truth for API fields.

## Public dependencies only
- Go Echo framework (public)
- oapi-codegen (public)
- Go standard library
- Optional public OpenAI HTTP or SDK client

## Not planned
SQL/sqlc, generated database models, internal tracing SDKs, internal logging middleware, corporate Makefile includes, Kubernetes Helm charts, production security infrastructure.
