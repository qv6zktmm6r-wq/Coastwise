# Content-pack rollback

Every release retains the last-known-good web bundle, native bundle, and
six-state content manifest together with its commit SHA and review evidence.
Rollback is a content release operation, not a request to silently reinterpret
stored progress.

## Procedure

1. Stop promotion of the suspect release and record the affected jurisdiction,
   pack version, source claim, and incident time.
2. Restore the previous signed web/native artifacts and public
   `content-manifest.json` as one release unit.
3. Confirm that the restored manifest contains exactly one known-good pack per
   supported jurisdiction and that no pack is older than the installed
   bundle's approved version.
4. Run the manifest, state migration, family-sync boundary, AI privacy, web
   browser, API, and mobile release checks before reopening promotion.
5. Keep the affected jurisdiction's new pack pending until the source matrix
   is corrected and a named accountable reviewer signs it again.

Offline clients retain their bundled or cached last-known-good manifest when
an update is malformed, stale, rolled back, or unavailable. Progress is
scoped by exact `jurisdiction:contentPackVersion:questionId`; rollback must
not merge answers from a different jurisdiction or pack version. Material
changes require an in-app notice and the notice's official source link.