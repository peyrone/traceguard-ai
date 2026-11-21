# Deploy TraceGuard AI to Vercel

Import `peyrone/traceguard-ai` twice in the same Vercel account. The two
projects use the same Git repository and have independent root directories
and production deployments. Set the **Production Branch** to `main` in both.
Use Hobby if the account, repository and project are eligible. [Monorepo setup](https://vercel.com/docs/monorepos)

1. Create the **API** project with Root Directory `backend` and Framework
   Preset **Other**. Leave install, build, and output overrides unset.
   The configuration serves an empty static output directory alongside the
   API. Vercel discovers the Go HTTP functions in `backend/api/` and reads Go
   1.25.0 from `backend/go.mod`. After deploying, copy the production HTTPS
   origin and check `/healthz`. [Go runtime](https://vercel.com/docs/functions/runtimes/go)
2. Create the **UI** project with Root Directory `frontend`, Framework
   Preset **Vite**, and Node.js **24.x**. The project configuration runs
   `npm ci`, then `npm run build`, and publishes `dist` with an SPA rewrite.
   Before deploying, set `VITE_API_BASE_URL` to the API's production HTTPS
   origin in the **Production** environment. Copy the UI's assigned
   production HTTPS origin after deploying. [Vite setup](https://vercel.com/docs/frameworks/frontend/vite)
3. In the API project's **Settings → Environment Variables**, set
   `TRACEGUARD_FRONTEND_ORIGIN` to that exact UI origin, including
   `https://` and without a trailing slash. Redeploy the API. Browser
   previews require their own explicitly allowed origin and API project
   configuration if you want to test cross-origin traffic from previews.
4. For deterministic fallback, leave the AI settings absent. To enable
   live AI, set both `OPENAI_API_KEY` and `TRACEGUARD_OPENAI_MODEL` only
   in the API project and redeploy. Live AI uses the OpenAI account's API
   quota.

The local Go command remains `go run ./cmd/traceguard-api` from `backend/`.
The UI defaults to `http://localhost:8080` and retains the offline preview
when the API is unreachable. Vercel invokes the same HTTP router through
function entry points.

## Smoke test

Replace the sample origins with the production domains from Vercel.

```sh
api=https://traceguard-ai-api.vercel.app
ui=https://traceguard-ai-ui.vercel.app

curl --fail-with-body "$api/healthz"
curl --fail-with-body "$api/api/v1/scenarios"
curl --fail-with-body "$ui/"
curl --fail-with-body "$ui/lineage/demo"
curl --fail-with-body -i -X OPTIONS "$api/api/v1/analyze" \
  -H "Origin: $ui" \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type'

analysis=$(curl --fail-with-body "$api/api/v1/analyze" \
  -H "Origin: $ui" -H 'Content-Type: application/json' \
  --data '{"scenario_id":"unauthorized_transfer"}')
printf '%s\n' "$analysis" | jq '.summary, .findings[0]'

printf '%s\n' "$analysis" | jq '{
  finding: .findings[0],
  rule_summary: "PII transfers require an allowed destination and purpose.",
  evidence: [{event_id:"evt-u-003"}]
}' | curl --fail-with-body "$api/api/v1/explain" \
  -H "Origin: $ui" -H 'Content-Type: application/json' --data-binary @-
```

Expect health `{"status":"ok"}`, four scenarios, the configured CORS origin,
and a verified finding citing `evt-u-003`. Explain should cite the same ID and
return `mode: "fallback"` with AI unset. Open the UI and select each scenario
to confirm browser requests and graph rendering.
