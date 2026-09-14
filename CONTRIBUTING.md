# Contributing to Meetily Improved

Thank you for helping build a calmer, privacy-first meeting workspace. Meetily Improved is an independent public fork of [Zackriya Solutions' Meetily](https://github.com/Zackriya-Solutions/meetily), and contributions remain MIT licensed.

## Before you start

- Search [existing issues](https://github.com/henryvn27/hush/issues) before opening a duplicate.
- For a substantial feature or architectural change, open an issue before investing in an implementation.
- Keep meeting data local by default. New cloud, account, calendar, telemetry, or filesystem scope requires an explicit design and privacy review.
- Never add fake meetings, AI answers, citations, progress, screenshots, or metrics to product or release evidence.
- Preserve upstream attribution and existing recording, transcript, import, recovery, and storage behavior unless the change explicitly replaces it.

## Development workflow

The public integration branch is `main`. Create a focused branch from the latest `main`; do not bundle unrelated cleanup with your contribution.

1. Fork and clone the repository:

   ```bash
   git clone https://github.com/YOUR_USERNAME/hush.git
   cd hush
   ```

2. Add this repository as upstream:

   ```bash
   git remote add upstream https://github.com/henryvn27/hush.git
   ```

3. Create a branch from `main`:

   ```bash
   git checkout main
   git pull upstream main
   git checkout -b feature/your-feature-name
   ```

4. Follow the platform setup in [docs/BUILDING.md](docs/BUILDING.md), then make one focused change.
5. Add the smallest test that proves the changed behavior.
6. Inspect visual changes in the native Tauri app when practical.

## Required checks

From `frontend/`:

```bash
npm run lint
npm run build
```

Also run focused tests for the behavior you changed and, from the repository root:

```bash
/usr/bin/git diff --check
```

Rust changes should include the narrowest relevant `cargo test` or `cargo check`. Packaging changes require a native bundle build and platform-specific signing verification.

## Pull requests

1. Target `main` and link the relevant issue with `Fixes #123` when appropriate.
2. Explain the user-visible outcome, privacy impact, and preserved behavior.
3. List exact verification commands and results.
4. Include native screenshots for visual changes and short video evidence for interactions when practical.
5. Keep generated binaries, models, recordings, databases, credentials, and personal meeting content out of the commit.

## Code style

- Follow the established patterns in the area you change.
- Prefer a focused root-cause fix over broad refactoring.
- Use clear names and comments only where the code cannot explain itself.
- Keep Rust/Tauri command and data-shape compatibility unless the change explicitly requires a migration.

Use concise conventional commit messages where practical:

```text
fix(settings): open settings from the keyboard
feat(meetings): add local transcript search
docs: clarify macOS source build
```

## Getting help

Use [GitHub Discussions](https://github.com/henryvn27/hush/discussions) for questions and ideas. Use [GitHub Issues](https://github.com/henryvn27/hush/issues) for reproducible bugs and accepted work.

## License

By contributing, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).
