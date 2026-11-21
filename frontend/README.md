# TraceGuard AI frontend

## Local development

Use Node.js 24. From the repository root, run:

```sh
cd frontend
npm ci
npm run dev
```

Run `npm test` for the evidence mapping test and `npm run build` for the TypeScript check and production bundle.

Start the Go API on port 8080 to list, analyze, and explain scenarios.
The frontend defaults to `http://localhost:8080`. If it cannot reach the local
API, the standalone graph preview is still available. Set `VITE_API_BASE_URL`
before starting Vite or running the production build to use a different API.
On Vercel, set this variable to the Go project’s public HTTPS URL before building.
See the [Vercel deployment guide](../backend/docs/vercel-deployment.md).

The shell and its synthetic preview live in `src/app/`. The React Flow graph lives in `src/features/lineage/`. The findings and explanation panel lives in `src/features/investigation/`, and the API client lives in `src/lib/api/`.

## Cloudflare Pages

Connect the repository to a Pages project named `traceguard-ai`, or set the matching project name in `wrangler.toml`.

| Pages setting | Value |
| --- | --- |
| Root directory | `frontend` |
| Build command | `npm run build` |
| Build output directory | `dist` |

For a Pages project created for Direct Upload, run these commands from `frontend/` after installing dependencies:

```sh
npm run build
npx wrangler@4.166.0 pages deploy dist
```

<<<<<<< HEAD
The browser bundle currently uses synthetic data. The Go API is a separate service.
=======
Set `VITE_API_BASE_URL` in the Pages build environment to use the deployed Go API.
>>>>>>> main

See the [Cloudflare Pages configuration reference](https://developers.cloudflare.com/pages/functions/wrangler-configuration/).
