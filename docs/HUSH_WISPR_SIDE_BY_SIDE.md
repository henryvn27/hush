# Hush and Wispr Flow: side-by-side audit

This is a product comparison record for the Hush rebuild. The reference app was the official Apple Silicon Wispr Flow desktop build `1.6.827`, installed from the official download page on 2026-09-12. The comparison is intentionally limited to non-account workflows because Wispr requires browser sign-in before opening the authenticated Hub.

## Reference evidence

- Wispr Flow desktop download: https://wisprflow.ai/downloads
- Wispr desktop navigation and workflow reference: https://docs.wisprflow.ai/articles/5096240724-navigating-the-wispr-flow-app-desktop-ios-and-android
- Wispr hands-free flow: https://docs.wisprflow.ai/articles/6391241694-use-flow-hands-free
- Wispr first-run screenshot: `/private/tmp/codex-shot-2026-09-12_10-41-13-w46834.png`
- Wispr compact Flow Bar reference: `/private/tmp/wispr-flow-bar.png`
- Hush public landing desktop proof: `/Users/Henrydev/Developer/Hush/.playwright-cli/hush-public-landing-final.png`
- Hush public landing mobile proof: `/Users/Henrydev/Developer/Hush/.playwright-cli/hush-public-landing-mobile-final.png`

## Observed workflows

| Workflow | Wispr Flow | Hush now | Product decision |
| --- | --- | --- | --- |
| First run | Polished five-stage setup, but starts with browser sign-up | Four-stage local setup, no account, clear privacy promise | Hush should keep the no-account advantage and make local setup feel more intentional than an onboarding checklist |
| Activation | Flow Bar plus hands-free shortcut; designed for use in any app | macOS AppKit Globe/Fn monitor supports hold-to-talk and double-press lock; Base UI-backed settings support portable custom keybinds | Keep Globe/Fn as the default and make the capture state appear before the Hub opens |
| Idle control | Compact dark bar, hidden by default on new installs, contextual menu | Compact dark pill capped at 9.5rem, with generated Hush mark, status, shortcut hint, accessible menu, and one-hour snooze; native transparent always-on-top window is 144x40 | Prove persistence across close/relaunch, multiple displays, Spaces, and full-screen |
| Recording feedback | Center bubble, ping, animated bars, cancel and stop controls | Existing recorder state plus animated local bar state; Stop, Cancel, Paste last dictation, and local Retry save actions are wired; optional focused-app insertion captures the original app, restores it, and falls back to clipboard with an explicit warning | Manually exercise Accessibility-enabled insertion against a separate editor |
| Hub home | Stats, history feed, shortcut education, search, personalization surfaces | Stats, local engine status, local history, shortcut education, privacy copy | Hush is clearer about data locality; add real word/session metrics as data becomes available |
| History | Copy, flag, retry, and transcript actions | Saved meetings now expose local Copy transcript and Flag/Unflag actions directly in the feed; recovery/retry, rename, delete, transcript review, and Wispr/Granola note import remain available | Prove the populated actions in the installed native app with real saved rows |
| Settings | Dedicated shortcuts, microphone, languages, system, privacy, style, dictionary, snippets | Hush Flow section now covers Globe/Fn, portable presets, custom key recording, bar visibility, focused-app insertion, local dictionary/snippet rules, microphone, language, and a truthful local-privacy data-boundary link | Native settings persistence and deeper style controls still need installed proof |
| Failure/recovery | Preserves audio when cloud processing takes longer | Local checkpoint recovery and no cloud dependency | This is Hush's clearest product advantage; surface it in the active and failed states |

## Current verdict

Hush now has a more deliberate visual identity than the original generic dashboard: a compact near-black low-interruption Flow Bar, neutral lilac-gray sidebar system, local voice desk home, Globe/Fn interaction model, custom keybind settings, focused-app insertion fallback, local Accessibility preflight, local Paste last dictation, local Retry save recovery, feed Copy/Flag actions, local dictionary/snippet personalization, microphone and language quick controls, Wispr/Granola import, and stronger privacy/recovery messaging. The source uses Wispr reference-accurate idle language and a truthful first-run preview built from the real Hush Activity surface, and the separate Flow Bar synchronizes backend recording state across its WebView boundary. The landing page is live at /landing and verified HTTP 200 from the Vercel alias, grounded in the actual Activity surface; raw installers are excluded from Vercel because they exceed its per-file limit, so CTA links point to GitHub Releases. Remaining parity work is explicit: manually verify Accessibility-enabled insertion against a separate editor, prove the native bar across close/relaunch and multi-display states, add deeper style controls, and configure updater signing plus Apple notarization. The verified local DMG and ZIP hashes are recorded in the critic audit; both are ad hoc signed.

## Fresh direct comparison: 2026-09-13

Wispr was open beside Hush during this pass. Wispr's first-run screen uses a full-width top rail, a centered editorial split, a large visual proof of the product, and a single sign-in action. Hush's prior screen used a persistent desktop-style sidebar and a narrow preview card; that read as a generic app shell even though the copy was more privacy-forward. The shared Hush onboarding shell has now been changed in source to the same top-rail and full-width canvas rhythm, with a larger real Activity preview and a quieter `PRIVATE BY DEFAULT` marker. The source change is verified in the frontend build and contract suite; the current native artifact now includes the monitor-placement fix; a live first-run re-capture remains deferred because this machine has persisted onboarding state.

The source rebuild and fresh app bundle were completed afterward. The live Hush workspace now confirms the intended compact Activity surface, local engine status, Fn education, empty-history state, and sidebar actions. Hush Settings also exposes Globe/Fn hold plus double-press, Option+Space, Command+Shift+Space, custom keybind capture, Flow Bar visibility, focused-app insertion, Accessibility status, phrase rules, microphone, language, privacy boundary, and appearance controls. Wispr remains on its unauthenticated first-run screen, with its menu bar exposing Dictation and My Voice personalization entry points. The rebuilt Hush onboarding step itself still needs a fresh screenshot because the installed test profile has already completed onboarding; no user data was deleted to manufacture a first-run state.
