# TraceGuard AI frontend

## Local development

Use Node.js 24. From the repository root, run:

```sh
cd frontend
npm ci
npm run dev
```

Run `npm test` for the evidence mapping test and `npm run build` for the TypeScript check and production bundle.

The shell and its synthetic preview live in `src/app/`. The React Flow graph lives in `src/features/lineage/`. FE2 can add its investigation panels in `src/features/investigation/` and its API client and fixtures in `src/lib/api/` and `src/lib/fixtures/`.

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

The browser bundle currently uses synthetic data. The Go API is a separate service.

See the [Cloudflare Pages configuration reference](https://developers.cloudflare.com/pages/functions/wrangler-configuration/).
