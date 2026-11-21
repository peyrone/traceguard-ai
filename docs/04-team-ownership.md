# Four-person Parallel Ownership Map

| Member | Role | Exclusive write paths (except approved integration) | Main deliverable |
|---|---|---|---|
| FE1 | Frontend Framework Lead + Graph | `frontend/src/app/`, `frontend/src/features/lineage/`, root frontend setup configs | Bootable UI shell + graph + app composition |
| FE2 | Frontend Investigation Feature | `frontend/src/features/investigation/`, `frontend/src/lib/api/`, `frontend/src/lib/fixtures/` | Typed API client, scenario control, evidence/finding/explanation panels |
| BE1 | Backend Framework Lead + Lineage | `backend/go.mod`, `backend/Makefile`, `backend/cmd/`, `backend/docs/`, `backend/internal/config/`, `backend/internal/domain/traceguard/core/{entities,ports,services/lineage}/`, `backend/internal/adapters/fixtures/` | Bootable Echo server, OpenAPI generation, correlated graph, analyze integration |
| BE2 | Detection & AI Feature | `backend/internal/domain/traceguard/core/services/{detection,investigation}/`, `backend/internal/adapters/ai/`, BE2-specific tests | Rules, evidential findings, explanation + fallback |

**Shared documents** (`docs/02-api-contract.md` / `docs/03-event-schema.md`) are frozen after kickoff; edits require approval by **Release Captain** and notice to all members.

## Why feature developers do not wait for framework owners
- FE2 develops panels with local static props under its own folders; FE1 can assemble once those exports exist.
- BE2 writes pure rule engine tests/functions against the frozen domain data model. BE1 implements matching shared entities while building the bootstrap.
- First 25 minutes are a **bootstrap runway**, not serial handoffs. FE1 and BE1 merge the minimum scaffold early so all four can run and compile.

## Integration ownership
- **FE1:** merges UI components into app shell; FE2 supports API wiring.
- **BE1:** owns server wiring and generated handlers; BE2 exports testable domain service functions/ports.
- **Release Captain:** one member (suggest BE1) controls shared contract changes, merges, timebox decisions, final submission.

## File-level collision prevention
- One task = one issue, one branch, one focused PR.
- Never modify `api_gen/` manually; generated files are regenerated only by BE1.
- FE2 must not edit `App.tsx` or layout; instead export ready-to-consume components.
- BE2 must not edit API spec, `main.go` or `go.mod`; request a change to BE1.
- During the first framework merge, BE2 may need to rebase; merge often to keep conflict small.
