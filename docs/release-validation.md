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

## Release evidence

Record the command output, commit SHA, pack versions, reviewer approvals, and
the generated web/native artifact identifiers with the release. Confirm that
the public web manifest matches the bundled six-pack manifest before
publication. If any check is unavailable, keep the prior release active and
record the reason rather than weakening the gate.