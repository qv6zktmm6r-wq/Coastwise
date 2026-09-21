# Six-state release validation

Coastwise uses `pnpm run release:validate:six-state` as the release gate for
California (`US-CA`), Texas (`US-TX`), Florida (`US-FL`), New York (`US-NY`),
Ohio (`US-OH`), and Illinois (`US-IL`).

The command runs, in order:

1. Workspace and artifact TypeScript checks.
2. Web unit, content, migration, privacy, sync, and manifest tests.
3. The web production build.
4. Chromium, Firefox, and WebKit browser regressions.
5. API typecheck and tests.
6. The native mobile release check, including Expo Doctor and iOS/Android
   JavaScript exports.
7. `git diff --check`.

The gate must run in a writable checkout. A failed source, content-pack,
privacy, browser, API, native, or diff check blocks publication. Real-device
screen-reader validation, route-departure behavior, storage-quota warnings,
Node-version matrices, and warning-as-error checks are separate follow-up
work and are not silently substituted by this command.

## Published-environment smoke check

After publishing, read the current deployment metadata with Replit's
deployment-info lookup. Require a successful deployment with a successful
current build, and copy both `primaryUrl` and `visibility`. Do not infer either
value from the Repl name, a development domain, or an environment variable.

For a public deployment, run:

```sh
PRODUCTION_URL="https://the-published-url.example" \
  PRODUCTION_DEPLOYMENT_VISIBILITY="public" \
  pnpm run release:smoke:production
```

For a private deployment, create a **Production** external-access token in
Publishing → Adjust settings → Security → External access tokens. Store it in a
secret named `PRODUCTION_EXTERNAL_ACCESS_TOKEN`, then run:

```sh
PRODUCTION_URL="https://the-published-url.example" \
  PRODUCTION_DEPLOYMENT_VISIBILITY="private" \
  pnpm run release:smoke:production
```

The check sends that secret as an `Authorization: Bearer` header only to
requests whose origin exactly matches the published deployment. Cross-origin
requests never receive it, and Playwright tracing is disabled for private
checks so failure artifacts cannot retain it. Never put the token in the
command, URL, query string, release evidence, screenshots, traces, or logs. A
Production token is tied to the current published deployment, so replace the
secret after publishing a fresh deployment.

Password-protected deployments cannot use this non-interactive smoke check.
Before promotion, change the deployment to private and use a Production
external-access token, or make it public. Do not treat the password gate as a
successful Coastwise check.

The command requires an explicit HTTPS URL and never derives one from the
project name or development-domain environment variables. It checks the
published `/api/healthz` endpoint, opens the published web app in Chromium,
rejects the global error boundary, requires visible Coastwise content, and
fails on uncaught page errors or console errors. A failed or skipped production
smoke check blocks promotion of the published build.

## Release evidence

Record the command output, commit SHA, pack versions, reviewer approvals, and
the generated web/native artifact identifiers with the release. Confirm that
the public web manifest matches the bundled six-pack manifest before
publication. If any check is unavailable, keep the prior release active and
record the reason rather than weakening the gate.

## Post-publish production smoke check

Publishing is not complete until the live deployment passes the Chromium smoke
check. After publishing:

1. Read the current deployment metadata with Replit's deployment-info lookup.
   Require a successful deployment with a successful current build, and copy
   its `primaryUrl` and `visibility`. Do not infer them from the Repl name, a
   development domain, or an environment variable.
2. Follow the visibility-specific setup above. For a public deployment, run:

   ```sh
   PRODUCTION_URL="<primaryUrl from deployment metadata>" \
     PRODUCTION_DEPLOYMENT_VISIBILITY="<visibility from deployment metadata>" \
     pnpm run release:smoke:production
   ```

   For a private deployment, make sure the
   `PRODUCTION_EXTERNAL_ACCESS_TOKEN` secret contains a Production token before
   running the same command with visibility set to `private`.
3. Keep the prior release active or roll back if the command fails or the
   deployment is password-protected.

The smoke check uses Chromium against the published HTTPS URL. It requires
`GET /api/healthz` to return `{ "status": "ok" }`, waits for the usable Coastwise
start screen, rejects redirects away from the published app, and fails if the
global error boundary appears, the page raises an uncaught error, or the
browser emits a console error. Record its output with the release evidence.
