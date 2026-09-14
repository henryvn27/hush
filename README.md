<div align="center">
  <img src="frontend/src-tauri/icons/icon.png" width="112" alt="Hush app icon" />
  <h1>Hush</h1>
  <p><strong>A quiet, local-first voice desk for your Mac.</strong></p>
  <p>Dictate, capture meetings, and revisit what matters without a bot in the call or an account in the cloud.</p>

  <p>
    <a href="#build-from-source"><strong>Build for macOS</strong></a>
    ·
    <a href="https://github.com/henryvn27/hush/releases">Releases</a>
    ·
    <a href="#privacy-boundary">Privacy</a>
    ·
    <a href="CONTRIBUTING.md">Contribute</a>
  </p>

  <p>
    <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-1b1b1f.svg" /></a>
    <img alt="macOS, Windows, and Linux" src="https://img.shields.io/badge/platform-macOS%20%C2%B7%20Windows%20%C2%B7%20Linux-1b1b1f.svg" />
    <img alt="Local-first" src="https://img.shields.io/badge/privacy-local--first-f36b2b.svg" />
    <img alt="Built with Tauri" src="https://img.shields.io/badge/built%20with-Tauri-1b1b1f.svg" />
  </p>
</div>

![Hush desktop workspace](docs/meetily-improved-icon-native-window.png)

> **Release status:** Hush is being prepared as a separate local-first product based on Meetily. The repository is usable from source today; downloads will appear on [GitHub Releases](https://github.com/henryvn27/hush/releases) only after the documented [release security and provenance gates](docs/RELEASE_SECURITY.md) pass.

## Why Hush

| | Hush |
| --- | --- |
| **No meeting bot** | Captures microphone and system audio directly on your desktop. |
| **Local by default** | Recordings, transcripts, summaries, recovery data, and the meeting library stay on your device. |
| **Real desktop workflow** | Capture and recall share one focused workspace with Light, Dark, and System themes. |
| **Choice of models** | Use local Whisper, Parakeet, built-in models, or Ollama; remote summary providers are explicit opt-in choices. |
| **No invented results** | Empty, loading, recovery, model, and error states reflect real application data. |

Hush is an independent product based on the MIT-licensed [Zackriya Solutions' Meetily](https://github.com/Zackriya-Solutions/meetily). It preserves the recording, transcription, storage, summaries, imports, and recovery foundation while rebuilding the experience around local voice capture.

## Highlights

- **Capture without inviting software into the call.** Check devices and model readiness, then record microphone and system audio locally.
- **Return to the conversation.** Search saved meetings, read transcripts and summaries, play the recording, edit notes, and export from one workspace.
- **Ask your meetings locally.** Ask Meetings uses bounded excerpts from saved transcripts and a loopback-only Ollama connection; it does not silently fall back to a cloud model.
- **Recover interrupted work.** Hush keeps local checkpoints and exposes explicit recovery states instead of hiding partial data.
- **Use the appearance that fits your Mac.** System, Light, and Dark preferences live in Settings and persist locally.

## Project status

| Area | Status | What that means |
| --- | --- | --- |
| Repository and behavior audit | Complete | Routes, native command boundaries, storage, privacy, and upstream attribution are mapped. |
| Desktop shell and design system | Implemented; final audit pending | The desktop shell, original icon, persistent Light/Dark/System themes, and shared primitives cover the active Phase 1 routes; final native visual evidence remains in progress. |
| Capture and meeting lifecycle | Implemented; final audit pending | Pre-recording, active recording, processing, import, recovery, and failure presentation preserve the native capture behavior; complete native-state evidence remains a release gate. |
| Meeting history and detail | Implemented; native QA blocker open | The reading-first workspace includes transcript, summary, playback/export controls, partial-data handling, and a persistent local inspector; persisted-meeting native loading is still under investigation. |
| Ask Meetings / local recall | Implemented; real-model QA pending | The route answers only through a loopback Ollama model from bounded local transcript excerpts, returns app-generated source links, and refuses cloud, calendar, internet, account, and filesystem scope. |
| Packaging and release QA | In progress | Native QA bundles and codesign checks pass; clean-checkout launch/package proof and final human E2E verification still gate a public release. |

The execution plan is tracked in Linear and repository history as the project develops. A feature is only moved to complete after implementation, verification, and evidence.

## Existing Meetily capabilities preserved

Meetily Improved continues to preserve the working upstream foundation:

- Microphone and system-audio recording
- Live local transcription with Whisper or Parakeet
- Local recordings, transcripts, and SQLite meeting storage
- Saved-meeting history and detail views
- AI summaries with built-in local AI or Ollama
- Optional configured OpenAI, Anthropic, Groq, OpenRouter, remote Ollama, and OpenAI-compatible providers
- Audio import and re-transcription
- Interrupted-transcript recovery
- Model, recording, notification, and privacy settings
- macOS, Windows, and Linux source support inherited from upstream

## Privacy boundary

The default meeting workflow is local-first:

- Recordings and transcripts are stored on your device.
- Whisper, Parakeet, built-in AI, and local Ollama can run without sending meeting content to a cloud provider.
- The local meeting database and recovery checkpoints remain on the machine.
- Analytics is off by default and can be enabled or disabled in Settings.

If you explicitly configure a remote summary provider or a remote Ollama endpoint, the content required for that request is sent to that provider. Meetily Improved does not describe those paths as local.

Ask Meetings is stricter: it accepts only a loopback Ollama endpoint and never sends recall questions or excerpts to a remote provider.

There is no cloud sync, account system, calendar integration, or persistent embedding index in v1.

## Build from source

### Prerequisites

- macOS 14.2 or later for the shipped Mac capture path
- [Node.js](https://nodejs.org/) and [pnpm](https://pnpm.io/)
- [Rust](https://rustup.rs/)
- Platform dependencies from the upstream [build guide](docs/BUILDING.md)

### Install and run the frontend

```bash
git clone https://github.com/henryvn27/hush.git
cd hush/frontend
pnpm install --frozen-lockfile
pnpm run dev
```

### Run the desktop app

Meetily uses a Rust helper sidecar. On Apple Silicon macOS, build the Metal-enabled helper and stage it for Tauri before launching or packaging:

```bash
cd hush
cargo build --release -p llama-helper --features metal
mkdir -p frontend/src-tauri/binaries
cp target/release/llama-helper frontend/src-tauri/binaries/llama-helper-aarch64-apple-darwin
cd frontend
pnpm run tauri:dev
```

The staged sidecar is a generated local build artifact and is intentionally ignored by Git. For other architectures, use the matching target triple as documented in [docs/BUILDING.md](docs/BUILDING.md).

GPU-specific and platform packaging details remain documented in [docs/BUILDING.md](docs/BUILDING.md).

## Architecture

Meetily Improved keeps the upstream Tauri architecture:

- **Frontend:** Next.js 14, React, TypeScript, Tailwind CSS
- **Desktop/native boundary:** Tauri 2
- **Capture and application services:** Rust
- **Local persistence:** SQLite, local recording folders, and IndexedDB recovery metadata
- **Local AI:** built-in models and Ollama

The redesign preserves native recording and transcription command contracts instead of replacing them with simulated frontend behavior. See [docs/architecture.md](docs/architecture.md) for the upstream architecture overview.

## Product boundaries

### v1

- Desktop-only interface redesign
- Reliable recording and import lifecycle presentation
- Searchable saved meetings and improved meeting detail workspace
- Ask Meetings real-model QA with a locally installed Ollama model and real matching transcript data
- Settings, privacy guidance, packaging, and release QA

### Later

- Note-first meeting workflow
- Editable AI-enhanced notes
- Local calendar context and pre-meeting briefs
- Persistent local retrieval index
- Deeper source and provenance inspection

These later ideas are backlog, not current functionality.

## Contributing

Issues and pull requests are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) and keep changes aligned with the project's core constraints:

- Preserve existing Meetily behavior unless a change explicitly replaces it.
- Keep meeting data local by default.
- Do not add fake meetings, AI answers, metrics, progress, or citations.
- Do not copy Granola assets, copy, protected UI, or proprietary implementation.
- Include tests or concrete verification for behavior changes.

## Fork, license, and attribution

Meetily Improved is built from [Zackriya-Solutions/meetily](https://github.com/Zackriya-Solutions/meetily). Zackriya Solutions created the original Meetily application and its capture, transcription, storage, summarization, import, and recovery foundation.

This fork is independently maintained and is not affiliated with Granola. Granola is a product-quality reference only; this project uses its own implementation, visual system, copy, and assets.

The project remains licensed under the [MIT License](LICENSE). The upstream copyright notice is preserved:

> Copyright (c) 2024 Zackriya Solutions

Third-party components remain subject to their own licenses. Upstream acknowledgments include [whisper.cpp](https://github.com/ggerganov/whisper.cpp), [Screenpipe](https://github.com/mediar-ai/screenpipe), [transcribe-rs](https://crates.io/crates/transcribe-rs), NVIDIA's Parakeet model, and the [ONNX Parakeet conversion by istupakov](https://huggingface.co/istupakov/parakeet-tdt-0.6b-v3-onnx).
