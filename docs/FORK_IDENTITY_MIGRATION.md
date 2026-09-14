# Fork identity migration readiness

This document inventories state that must be handled if Meetily Improved adopts
a public identifier distinct from upstream Meetily. It does not approve an
identifier change. The release identifier remains `com.meetily.ai` until the
CS-2011 product and data decision is explicit.

## Current state boundaries

| Boundary | Active state | Migration requirement |
| --- | --- | --- |
| Tauri app-data directory | `meeting_minutes.sqlite` plus WAL/SHM, Whisper/Parakeet/summary models, `onboarding-status.json`, `recording_preferences.json`, `preferences.json`, `app-preferences.json`, `analytics.json`, and `store.json` | Copy as one closed directory while the app is stopped; preserve the source for rollback. |
| WebKit website data | `MeetilyRecoveryDB` IndexedDB transcript recovery plus local/session storage for theme, languages, provider/model selection, beta flags, and in-flight progress | Must be exported and restored through WebKit-aware code or an app-level handoff; copying only Tauri app data is incomplete. |
| Name-keyed shared state | Custom templates under the platform `Meetily/templates` data path and notification consent under the platform `meetily/notifications.json` config path | Inventory separately. These paths do not follow the Tauri identifier and can collide even after an identifier change. |
| Recordings | Default `~/Movies/hush-recordings` for new installs on macOS; existing persisted paths may remain `meetily-recordings` or a user-selected folder persisted in settings | Preserve the configured path; do not duplicate large recordings during identity migration. Validate that every database reference remains inside the configured recording root. |
| macOS identity and permissions | Bundle identifier, Dock/single-instance identity, microphone, screen recording, Audio Capture, notifications, signing, and updater state | Treat permissions as identity-bound and guide the user through any required re-approval. Never claim that permission grants migrate. |
| Distribution | Fork-owned updater endpoint/key, release assets, Developer ID/notarization, uninstall/reinstall behavior | A new identifier needs an updater transition plan and coexistence tests; updater state must not be copied blindly. |

## Transaction contract

`identity_migration::migrate_directory` is deliberately not wired into app
startup. A future approved caller must resolve explicit old/new app-data paths,
ensure the app and SQLite pool are closed, and then invoke it.

The helper:

1. refuses missing sources, symlinks, destination collisions, and stale staging;
2. copies into an adjacent staging directory on the destination filesystem;
3. compares the complete source and staging trees byte-for-byte;
4. writes a completion marker and atomically renames staging into place; and
5. leaves the source untouched as rollback material.

Repeated migration returns `AlreadyMigrated` only for a marked, byte-identical
destination. Rollback refuses a destination changed after migration. Browser
state, permissions, recordings, and name-keyed shared paths are intentionally
outside this primitive and must have separate approved handling.

## Supported macOS floor

The active macOS default is `AudioCaptureBackend::CoreAudio`, implemented with
Core Audio process taps. Apple's installed SDK marks
`AudioHardwareCreateProcessTap` and `AudioHardwareDestroyProcessTap` as
available from macOS 14.2. The later Audio Capture permission behavior does not
raise the API availability floor. The prior generated bundle defaulted to
`LSMinimumSystemVersion=10.13`, which could admit systems below the active core
capture path. `tauri.conf.json` now sets `minimumSystemVersion` to `14.2`, and
release contract tests lock that value.

Lowering the floor requires implemented and native-tested runtime fallback to a
capture backend supported on the older version; documentation alone is not a
fallback.

## Approval still required

Before changing `com.meetily.ai`, CS-2011 must approve the destination identifier,
coexistence policy, user-visible migration/rollback flow, WebKit handoff,
permission guidance, and updater transition. No live data migration should ship
until fresh install, upgrade, rollback, coexistence/denial, uninstall, and
reinstall have native evidence.
