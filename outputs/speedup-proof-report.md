# Speedup Proof: Model Readiness Duplicate Fetch

## Verdict

PROVEN. A failed recording start no longer fetches the same transcription-model list twice. The first successful model listing is retained for the download-state decision, while the old retry behavior remains when the first fetch fails.

## Before and after

- Whisper blocked start: 2 model IPC calls to 1, 50% reduction
- Parakeet blocked start: 3 model-related calls to 2, 33.33% reduction
- Benchmark: 2 warmups and 7 measured iterations

Ready starts retain their existing call counts. Remote providers still bypass local model checks.

## Verification

- Focused benchmark: PASS
- Frontend tests: PASS, 82/82
- Typecheck: PASS
- Production build: PASS
- git diff --check: PASS
- Rust check: NOT RUN because cargo is unavailable on this host

## Files

- useRecordingStart.ts: /Users/Henrydev/Developer/Hush/frontend/src/hooks/useRecordingStart.ts:1
- model-readiness-performance.test.mjs: /Users/Henrydev/Developer/Hush/frontend/tests/lib/model-readiness-performance.test.mjs:1

## Remaining campaign

This is run 3 of the autonomous campaign. Five consecutive no-win proofs are still required before stopping.
