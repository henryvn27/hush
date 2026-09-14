# Hush Engineering Rules

- The Mac is the canonical Hush node. Keep durable events, transcripts, indexes, and memory local by default.
- Preserve the existing `meetings` and `transcripts` contracts while migrating capture modes into the canonical `hush_*` event layer.
- Every derived memory result must retain source event, transcript segment, timestamp, derivation kind, and confidence.
- Capture is intentional, visible, and immediately stoppable. Do not add hidden recording behavior.
- Prefer SQLite/FTS and resumable jobs before introducing a new service or vector database.
- Treat `/Users/Henrydev/Developer/LifeRecorder` as a separate capture client. Reuse its durable chunk and transfer protocol ideas only after the Mac-first event path is working.
- Cloud providers are explicit opt-ins. The tested local path must not require a network provider.
- Never put real audio, transcripts, pairing tokens, model credentials, or runtime databases in Git.
- New memory commands must be read-only unless deletion or another mutation is explicit in the product contract and covered by tests.
