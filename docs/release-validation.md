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

After publishing, obtain the live URL from deployment metadata and run:

```sh
PRODUCTION_URL="https://the-published-url.example" \
  pnpm run release:smoke:production
```

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
   its `primaryUrl`. Do not infer the URL from the Repl name, a development
   domain, or an environment variable.
2. Run:

   ```sh
   PRODUCTION_URL="<primaryUrl from deployment metadata>" pnpm run release:smoke:production
   ```

3. Keep the prior release active or roll back if the command fails.

The smoke check uses Chromium against the published HTTPS URL. It requires
`GET /api/healthz` to return `{ "status": "ok" }`, waits for the usable Coastwise
start screen, and fails if the global error boundary appears, the page raises
an uncaught error, or the browser emits a console error. Record its output with
the release evidence.
