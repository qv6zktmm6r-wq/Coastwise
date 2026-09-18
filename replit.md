# California Teen Driver Coach

A responsive study and supervised-practice coach that helps California teens prepare for the permit and behind-the-wheel tests.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/california-driver-coach run dev` — run the web app through its managed workflow
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/california-driver-coach/src/App.tsx` — routes, product data, interactions, and local persistence
- `artifacts/california-driver-coach/src/index.css` — visual tokens, typography, and motion

## Architecture decisions

- The initial release is frontend-only and stores progress in localStorage so it is immediately usable without an account.
- California licensing requirements are displayed as educational guidance, with an explicit disclaimer that the app is not the DMV or a licensed instructor.

## Product

- Student dashboard with readiness and next-action guidance
- Adaptive permit questions with explanations and topic mastery
- Real-world judgment scenarios
- Supervised drive missions and a 50-hour practice log
- Parent coaching prompts and readiness summary
- Editable profile, test dates, and support preferences

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
