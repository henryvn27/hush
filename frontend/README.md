# Meetily Improved desktop app

This directory contains the supported Meetily Improved desktop application: a Next.js 14 interface packaged with Tauri 2 and backed by the Rust audio, transcription, storage, recovery, and summary services in `src-tauri/`.

Meetily Improved is an independent MIT-licensed fork of [Zackriya Solutions' Meetily](https://github.com/Zackriya-Solutions/meetily). See the [root README](../README.md) for product status, privacy boundaries, screenshots, and upstream attribution.

## Prerequisites

- Node.js and pnpm
- Rust stable
- CMake
- macOS: Xcode Command Line Tools; a supported full Xcode installation is required for signed release packaging
- Windows: Visual Studio Build Tools with the Desktop development with C++ workload
- Linux: the platform packages listed in [Building from source](../docs/BUILDING.md)

## Install

```bash
git clone https://github.com/henryvn27/hush.git
cd hush/frontend
pnpm install --frozen-lockfile
```

The frozen lockfile is the reproducible install path used by release QA.

## Run the frontend only

```bash
pnpm run dev
```

This starts the Next.js development server at `http://localhost:3118`. Frontend-only mode is useful for layout work, but it does not replace native Tauri verification for recording, permissions, imports, storage, or local AI behavior.

## Run the macOS desktop app

The desktop bundle expects the Rust `llama-helper` sidecar to be staged under the Tauri target triple name. From the repository root on Apple Silicon macOS:

```bash
cargo build --release -p llama-helper --features metal
mkdir -p frontend/src-tauri/binaries
cp target/release/llama-helper frontend/src-tauri/binaries/llama-helper-aarch64-apple-darwin
cd frontend
pnpm run tauri:dev
```

The staged binary is a generated local artifact and is ignored by Git. For Intel macOS or another platform, use the matching Rust target triple described in [Building from source](../docs/BUILDING.md).

The repository helper scripts remain available from this directory:

```bash
./clean_run.sh
./clean_run.sh debug
./clean_build.sh
```

GPU-specific development scripts are `dev-gpu.sh` and `build-gpu.sh`.

## Build

After staging the matching sidecar:

```bash
pnpm run tauri:build
```

Platform signing, notarization, updater signatures, and installer formats require the platform credentials and toolchains documented in the repository workflows. A locally built or ad-hoc-signed app is not equivalent to a notarized public macOS release.

## Checks

Run these from `frontend/`:

```bash
npm run lint
npm run build
npx tsc --noEmit
node --test tests/lib/*.test.mjs
```

The BlockNote Markdown test uses Bun:

```bash
bun test tests/lib/blocknote-markdown.test.ts
```

Rust changes should also run the narrowest relevant `cargo test` or `cargo check` from the repository root. Finish every change with `/usr/bin/git diff --check`.

## Architecture and privacy

- `src/`: Next.js routes, components, contexts, hooks, and local UI state
- `src-tauri/`: supported Rust/Tauri application core and native command/event boundary
- `src-tauri/binaries/`: generated local sidecars, not source-controlled release secrets
- `tests/`: focused frontend and route behavior checks

Recording, transcription, meetings, recovery, and storage are handled by the Rust/Tauri app. The repository no longer carries the unsupported Python/FastAPI and Docker implementation. The in-app database importer still preserves user-data migration from older Meetily installations.

Meeting data and local models stay on the device by default. Remote summary providers receive meeting content only when a user explicitly configures and invokes one. Ask Meetings accepts only a loopback Ollama endpoint.

## Permissions

On macOS, microphone capture requires Microphone permission. System-audio capture uses ScreenCaptureKit and requires Screen Recording permission. Meetily Improved must explain these permissions before requesting them; release QA should test them in the packaged app identity.

## Contributing and license

Read [CONTRIBUTING.md](../CONTRIBUTING.md) before opening a pull request. Meetily Improved remains licensed under the repository's [MIT License](../LICENSE), with the upstream Zackriya Solutions attribution preserved.
