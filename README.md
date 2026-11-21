# TraceGuard AI

[Live demo](https://traceguard-ai-ui.vercel.app/) · [GitHub Pages](https://peyrone.github.io/traceguard-ai/)

TraceGuard AI reconstructs service-to-service data lineage from synthetic audit events and flags transfers that may breach a privacy policy. The graph and findings cite supporting audit event IDs and show where evidence is missing.

**We built TraceGuard AI from scratch on 21 November 2026 during the Sea × OpenAI Regional Codex Hackathon Thailand.** We wrote all project-specific frontend and backend code during the event. We did not build on any existing application, starter template, or prior work, whether open source or proprietary. The app uses public libraries as dependencies.

The Go API processes synthetic fixtures in memory.

## Run locally

Use Go 1.25 and Node.js 24.15 or later in the 24.x release line. Run each command block from the repository root in a separate terminal.

1. Start the Go API on port 8080.

   ```sh
   cd backend
   go run ./cmd/traceguard-api
   ```

2. Start the React frontend.

   ```sh
   cd frontend
   npm ci
   npm run dev
   ```

3. Open [the dashboard](http://localhost:5173). The dashboard fetches the case catalog and analyses from the running API. To check the API directly, run `curl --fail http://localhost:8080/healthz` and expect `{"status":"ok"}`.

## Try the demo

1. In the **Review queue**, expand **Audit details** to inspect a cited synthetic record. Select **Open case** to view the findings, service lineage graph, and evidence references.
2. Open the **Partial evidence, confirmed violation** case. The outbound send is `OBSERVED` and cites `evt-e-002`. The upstream link is `INFERRED` and cites the receipt `evt-e-001`. Select **Explain finding** for a cited summary and next steps.
3. In **Simulated transfer enforcement**, select a transfer and click **Test transfer**. The unauthorized outbound send returns `DENY`. The inferred upstream link returns `INDETERMINATE`. To try `ALLOW`, open **Allowed transfer** from the dashboard chart or enable **Include cases without violations** in the queue. Only `ALLOW` can execute the in-memory simulation. No data leaves the app during a transfer simulation.
4. Select **View report** to inspect the findings and transfer evidence. Choose **Executive brief** or **Engineering report**, pick English or Thai, and select **Generate summary**. **Print / Save PDF** exports the displayed edition. **View full case report** returns to the detailed findings.

The interface supports English and Thai. The dashboard shows case status and counts of observed and inferred links. **Auto refresh** starts off. Turn it on to refresh every minute while the tab is visible, or select **Refresh cases** to update manually.

| Scenario ID | Analysis result | Evidence to inspect |
| --- | --- | --- |
| `allowed_transfer` | `NO_VIOLATION_OBSERVED` | Four observed links permitted by the scenario policy. |
| `unauthorized_transfer` | `VERIFIED_VIOLATION` | Completed outbound send `evt-u-003`. |
| `shuffled_transfer` | `VERIFIED_VIOLATION` | Shuffled input preserves the graph topology and verdict. The outbound send is `evt-s-003`. |
| `missing_intermediate` | `POTENTIAL_VIOLATION` | The inferred outbound link cites the prior hop `evt-m-001` and receipt `evt-m-004`. |
| `partial_evidence_confirmed` | `VERIFIED_VIOLATION` | The completed outbound send is verified. The upstream finding remains `INCONCLUSIVE`. |

`NO_VIOLATION_OBSERVED` describes the available records. Compliance requires evidence beyond the fixture analysis. [Scenario details](docs/05-scenarios.md)

## API

The Go backend uses Echo and generated OpenAPI bindings. The React and TypeScript frontend uses Vite and React Flow. Local and Vercel API entry points share the same router.

| Method and path | Result |
| --- | --- |
| `GET /healthz` | API health. |
| `GET /api/v1/scenarios` | The five built-in scenario IDs and labels. |
| `POST /api/v1/analyze` | Evidence-linked graph and findings for a fixture or explicit events and policy. Analysis with a fixture's own policy also returns scenario-scoped transfer candidates. |
| `POST /api/v1/report-summary` | Audience-specific report with a canonical verdict, cited evidence, and prioritized follow-up actions in English or Thai. |
| `POST /api/v1/explain` | Cited explanation and next steps for a selected finding. Matched fixture findings can include investigation insights and GDPR considerations for review. |
| `POST /api/v1/privacy/decisions` | Demo policy decision and whether the synthetic transfer executed. The workspace sends the scenario ID and the candidate ID returned by analysis. |

Analyze the unauthorized transfer directly.

```sh
curl --fail-with-body http://localhost:8080/api/v1/analyze \
  -H 'Content-Type: application/json' \
  --data '{"scenario_id":"unauthorized_transfer"}'
```

The response includes `VERIFIED_VIOLATION` and cites `evt-u-003`. [OpenAPI spec](backend/docs/traceguard-api/doc.yaml) · [Event schema](docs/03-event-schema.md)

## Configuration

| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | Frontend API origin. Defaults to `http://localhost:8080`. Set before starting Vite or building for deployment. |
| `TRACEGUARD_ADDR` | Local API listen address. Defaults to `:8080`. |
| `PORT` | Overrides `TRACEGUARD_ADDR` and binds to `0.0.0.0`. |
| `TRACEGUARD_FRONTEND_ORIGIN` | Replaces the default CORS origins. Use the exact frontend origin without a trailing slash. Defaults allow `localhost` and `127.0.0.1` on ports 5173 and 4173. |
| `OPENAI_API_KEY` and `TRACEGUARD_OPENAI_MODEL` | Optional server-side settings. Set both to enable OpenAI prioritization of validated next steps and review considerations. |

The Go backend generates the verdict, citations, and explanation summary. Explanations use deterministic results when AI is disabled, unavailable, or returns a response that fails validation.

For Vercel, deploy `frontend/` and `backend/` as separate projects. The frontend build needs access to the backend fixture JSON for the audit details in the review queue. [Vercel deployment guide](backend/docs/vercel-deployment.md)

## Verify changes

Run Go checks from `backend/`.

```sh
go test ./...
go vet ./...
```

Run frontend checks from `frontend/` after `npm ci`.

```sh
npm test
npm run build
```

Regenerate HTTP bindings with `make gen-api` from `backend/` after an approved OpenAPI change. [Code generation guide](docs/10-codegen-guide.md) · [Team ownership](docs/04-team-ownership.md) · [Hackathon plan](PLANS.md)
