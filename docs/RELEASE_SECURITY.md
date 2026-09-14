# Release security and provenance

Meetily Improved release artifacts are eligible for publication only when the
`Release` workflow completes for the exact current `main` commit. The workflow
creates a draft, builds signed macOS and Windows installers, proves the platform
signatures, generates a deterministic checksum ledger and SPDX SBOM, and binds
the listed assets to GitHub artifact attestations.

The workflow never publishes a release. A human must review the completed draft
and perform the clean-download checks below before publication.

## Immutable source gate

Dispatch the workflow from `main` and provide the full 40-character commit as
`release_sha`. Preflight requires all of the following to match:

- the supplied `release_sha`;
- the workflow's `GITHUB_SHA`;
- the checked-out commit;
- the current GitHub `main` branch SHA.

The version is read from the committed `frontend/src-tauri/tauri.conf.json`.
Existing tags and releases are rejected. Version changes must therefore be
reviewed in source control; the workflow never invents or overwrites a version.

## Required release evidence

Every completed draft contains:

- macOS DMG and Tauri updater archive/signature assets;
- Windows MSI and NSIS installers plus updater signatures;
- `latest.json` with non-empty updater signatures;
- `SHA256SUMS`, sorted by asset name;
- `RELEASE_PROVENANCE.json` with the source SHA, workflow run, release ID, and
  authenticated FFmpeg inputs;
- one build-evidence file per platform, including the runner/toolchain and
  verified signing identity;
- an SPDX JSON SBOM;
- GitHub build-provenance and SPDX SBOM attestations for every entry in
  `SHA256SUMS`.

The macOS build fails unless `codesign`, Gatekeeper assessment, notarization,
and stapling validation all succeed for the app and DMG. The Windows build fails
unless both MSI and NSIS installers have valid Authenticode signatures. Missing
or empty Tauri updater signatures fail the final evidence job.

## Verify a downloaded draft or published release

Download the assets into an empty directory, then run:

```bash
sha256sum --check SHA256SUMS

while read -r _ file; do
  gh attestation verify "$file" --repo henryvn27/hush
  gh attestation verify "$file" \
    --repo henryvn27/hush \
    --predicate-type https://spdx.dev/Document/v2.3
done < SHA256SUMS
```

On macOS, validate the downloaded installer and installed application:

```bash
xcrun stapler validate "Meetily Improved.dmg"
codesign --verify --deep --strict --verbose=2 "/Applications/Meetily Improved.app"
spctl --assess --type execute --verbose=4 "/Applications/Meetily Improved.app"
xcrun stapler validate "/Applications/Meetily Improved.app"
```

On Windows, validate both installers in PowerShell:

```powershell
Get-AuthenticodeSignature .\Meetily*.msi | Format-List Status,StatusMessage,SignerCertificate
Get-AuthenticodeSignature .\Meetily*.exe | Format-List Status,StatusMessage,SignerCertificate
```

Both statuses must be `Valid`. Install only after the checksum and attestation
checks pass, then exercise update discovery against the signed `latest.json`.

## External credential boundary

Developer ID, Apple notarization, Windows certificate-service, and Tauri updater
credentials are machine/repository secrets. They are never committed or copied
through the portable environment. Their presence and the resulting platform
proof remain tracked by CS-1995; workflow implementation alone is not evidence
that those external credentials exist.
