---
name: Content pack update safety
description: Safety rules for accepting and caching jurisdiction content manifests.
---

Only accept a manifest update when it contains the selected jurisdiction, its version is the same as or newer than the installed pack, and every notice matches its enclosing jurisdiction and pack version. Never replace last-known-good content with a rollback or missing-pack response. A jurisdiction must not be enabled until its official-source matrix has an approved, dated review record.

**Why:** A syntactically valid but stale or mismatched manifest can mislabel old content as an update, hide the selected state pack, or display a notice with the wrong legal provenance.

**How to apply:** Validate provenance before caching. Compare canonical jurisdiction pack versions monotonically. Clear any pending material notice whenever jurisdiction/version changes, then derive a new notice only from the active pack. On invalid, missing, or rollback responses, retain a compatible cache or the bundled pack and report update checking as unavailable.