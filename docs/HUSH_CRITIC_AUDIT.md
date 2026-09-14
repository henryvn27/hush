# Hush Critic Audit

Date: 2026-09-12

This is an adversarial review of the current Hush build. Three read-only critics independently inspected the rendered screenshots, source, existing side-by-side notes, and the official Wispr Flow documentation. They were instructed to treat unsupported claims as failures and to name the user-visible moment where Wispr wins.

## Verdict Before This Pass

Hush was materially behind Wispr Flow on the core desktop-dictation workflow. The strict workflow reviewer scored only 1 of 13 audited workflows as passing. The visual reviewer found the mobile shell functionally broken, the desktop Home too promotional, the Flow Bar too weak and trapped in the Hub, and the landing page's first viewport missing both the action and the product preview. The product reviewer found that Hush had been rebranded without yet being redesigned as an ambient desktop product.

## Highest-Impact Findings

| Severity | Finding | User-visible consequence | Acceptance test |
| --- | --- | --- | --- |
| P0 | Fixed expanded sidebar on narrow screens | The 390px view shows a desktop canvas through a narrow strip | At 320/390/640px, no horizontal clipping; collapsed navigation remains operable |
| P1 | Home is a landing page, not an activity surface | Returning users scroll past copy and decorative instrumentation to reach history | Recent flows or the empty-state action is visible above the bar at 1440x900 |
| P1 | Flow Bar is trapped inside the Hub | Closing or obscuring the Hub removes the defining control | Bar is a separate always-on-top window and persists independently |
| P1 | Hold/double-press gesture is ambiguous | A double press can leave the lock state out of sync with recording | Press/release and double-press sequences have deterministic state-machine tests |
| P1 | Focused insertion reports success without verifying delivery | Text can paste into the wrong app or claim success when Accessibility blocks it | Target app is captured, permission is preflighted, and failure falls back to copy honestly |
| P1 | Visual language is split across warm, purple, brown, and cool themes | The app reads like assembled React surfaces instead of one product | One graphite/orange control language with one functional icon vocabulary |
| P1 | Onboarding does not prove the advertised workflow | First-run users never test Accessibility, insertion, or first dictation | Setup ends with a real microphone, shortcut, and insertion exercise |
| P0 | First-run model setup could consume about 3.3 GiB before first use | A lightweight local app can exhaust disk before the user can dictate | Transcription is the only required download; summary model remains explicitly waiting until enabled |

## Rebuild Applied After Review

- Home now leads with Activity, a factual local-engine status, one primary Start dictating action, and recent flows rather than a hard-coded timer and decorative waveform.
- Narrow layouts use a collapsed icon rail and reduce the main content width instead of preserving a 15rem expanded desktop rail.
- Globe/Fn release now waits through a short double-press window so hold-to-talk and locked capture can share one deterministic gesture.
- The Flow Bar is configured as a separate transparent, always-on-top Tauri window at `/flow-bar`; the browser fallback remains available for QA.
- The bar's palette and type were tightened toward a near-black Wispr-like capsule with restrained white status text and no always-visible decorative icon.
- The Flow Bar is now intentionally small: the CSS control is capped at 10.5rem and the native window is 176x48, keeping it close to Wispr's low-interruption pill reference.
- The bar now exposes explicit Stop and Cancel controls, plus a local Paste last dictation action with clipboard fallback when Accessibility is unavailable.
- Paste last dictation is now fully wired: the Flow Bar event reaches a shared focused-app insertion helper, restores the captured app, and reports clipboard fallback instead of silently doing nothing.
- Wispr Flow Markdown and Granola CSV notes can be previewed, deduplicated, and imported into local Hush history without uploading source files.
- The landing page now uses a real Hush Activity screenshot and factual interaction copy instead of a concept preview; desktop and 390px mobile renders were inspected from the live deployment.

## Still Unverified or Blocked

- Native macOS Accessibility-enabled insertion into two separate editors has not been manually proven in this pass.
- The second Tauri window still needs installed-app interaction proof across close/relaunch, multiple displays, Spaces, and full-screen.
- Stop, Cancel, Paste Last, and a first-class local Retry save action are now exposed; native editor insertion still needs manual proof.
- Local dictionary and snippet rules are now configured in Flow settings and applied to transcript segments before local save and focused-app insertion.
- Browser QA now renders the completed workspace deterministically with no hydration mismatch or Next.js issue badge.
- Shortcut registration rollback and end-to-end native key gesture tests still need coverage.
- Wispr's authenticated Hub workflows remain untested because the installed reference was not signed in.
- The public Vercel alias is live and verified: / redirects to /landing, /landing returns HTTP 200, and the visual landing pass is deployed. The oversized native installers are intentionally excluded from Vercel; landing CTAs point to the GitHub Releases page.
- The source-rebuilt Tauri app bundle is at `target/release/bundle/macos/Hush.app`; the app passes deep strict code-signature verification. The rebuilt local DMG at `/private/tmp/Hush-0.5.0-aarch64-native.dmg` passes `hdiutil verify` with SHA-256 `3ea4797530fa50f2e054e28aad37a58c73555ed9c4f8badf8fe0db7036338fec`. It is ad hoc signed and not notarized because Apple signing credentials are not configured on this machine.
- The current verified local app ZIP is at /private/tmp/Hush-0.5.0-aarch64-native.zip with SHA-256 bf4fb0d096313af8bfdec1ae5b69bc509533d17f1304037b1f2f37f2bfa10617. The same artifacts are copied into `frontend/public/downloads/` for the landing page. The app passes deep strict code-signature verification and its DMG passes read-back verification.
- The latest frontend production build completed successfully during the native bundle build. The separate Flow Bar now polls backend recording state in its own WebView, uses a native start command plus targeted main-window event delivery with an app-wide fallback, and is covered by regression contracts; native Accessibility insertion, multi-display bar persistence, and authenticated Wispr Hub workflows remain unverified.
- The source now also uses the reference-accurate idle label, neutral first-run Flow Bar preview, and current-monitor startup fallback. The current-monitor source fix passes its contract test and is included in the current verified artifact. The Tauri updater archive cannot be signed without the configured private updater key.
- The installed Hush setup was exercised live: the transcription engine showed active progress while the approximately 2.6 GiB Summary Engine remained `Waiting`. The summary model is no longer auto-started during onboarding; Qwen 2B is the default recommendation until a 32 GB RAM threshold, with larger models available later in Settings.

A fresh native verification pass now proves the idle Flow Bar exists as a 176x48 native window, is on-screen, and sits in the selected monitor work area above the Dock; the QA-only multi-instance launch argument was used only to avoid stale pre-rename processes. Active recording feedback, Globe/Fn gesture activation, and focused-app insertion remain explicitly unverified because macOS Accessibility automation is not available in this task. No claim of superiority is valid until those remaining items are tested and the strict scorecard is rerun.
