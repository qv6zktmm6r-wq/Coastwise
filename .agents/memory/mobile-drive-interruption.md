---
name: Mobile drive interruption
description: Defines the safety and recovery behavior for interrupted native Coastwise drive sessions.
---

Native coached drives must pause location and recording whenever Coastwise leaves the foreground. Persist the unfinished session locally and require an explicit user action to resume, end and save, or discard it.

**Why:** Coastwise must not imply that coaching continues reliably while backgrounded, and it must not encourage phone interaction while a vehicle is moving. Local recovery prevents progress loss without adding background tracking.

**How to apply:** Preserve this behavior across iOS and Android session, navigation, recording, and lifecycle changes. Finalize any recording before saving or resuming the session. Bind recording metadata to the drive ID captured when recording starts, and ignore active-drive updates whose ID no longer matches, so late callbacks cannot alter a completed or newer drive. Resume controls must be framed for use while parked.