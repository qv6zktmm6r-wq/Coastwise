---
name: GitHub push authentication
description: Distinguishes GitHub connector API access from shell Git transport authentication in this Replit workspace.
---

The GitHub connector's authenticated REST API does not supply credentials to shell `git push`. Connecting GitHub in the Git pane did not make HTTPS shell Git push work here; the GitHub CLI and SSH transport were also unauthenticated.

**Why:** Creating a fresh commit via the connector API on an empty remote would publish the current files but give that remote unrelated history. A local branch with existing commits could not then fast-forward to it, complicating handoffs to other Git clients.

**How to apply:** For GitHub sync, check shell Git authentication with a dry-run. If it fails, prefer the Git pane's authenticated Push action or a supported Git credential connection over an API-only snapshot. Verify the remote commit after a push; do not mistake connector access for Git transport access.