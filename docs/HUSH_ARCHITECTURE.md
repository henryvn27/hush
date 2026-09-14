# Hush Local Memory Architecture

## Purpose

Hush is a local-first desktop memory utility with three related entry points:

1. **Dictate**: short, focused speech inserted into the active Mac app.
2. **Capture**: intentional meetings, conversations, lectures, and imported audio.
3. **Recall**: a searchable timeline and local context interface for the material Hush has already processed.

The Mac is the canonical Hush node. Capture clients send durable input to the Mac; they do not own the long-term memory model.

## Integration decision

`/Users/Henrydev/Developer/LifeRecorder` remains a separate iPhone capture client. It already provides useful, tested behavior for one-minute AAC chunks, a durable offline queue, authenticated HTTPS upload, checksum and chunk-ID idempotency, and a local Whisper receiver. Hush should reuse those protocol ideas and adapt the receiver's ingest path, but should not merge the iOS app or its Python runtime into the desktop bundle.

The first Hush integration target is a Mac microphone vertical slice. iPhone pairing and transfer follow after the canonical event store and processing queue are stable.

## Canonical pipeline

```text
capture input
  -> durable source asset
  -> Hush event
  -> transcript segments
  -> semantic episode
  -> extracted facts / tasks / decisions / entities
  -> FTS and optional local vector index
  -> timeline and cited context retrieval
```

Every derived record keeps a provenance reference to its source event and, where available, a transcript segment and time range. A generated summary is never treated as a direct observation.

## Storage model

SQLite remains the canonical store. Hush will add an event-oriented layer beside the existing meeting tables instead of replacing them in one migration:

- `hush_events`: the time-bounded source event and capture metadata;
- `hush_assets`: local audio or imported-file references with retention state;
- `hush_transcript_segments`: timestamped text and speaker labels;
- `hush_episodes`: semantic groupings over one or more events;
- `hush_entities`: people, projects, classes, products, and organizations;
- `hush_event_entities`: confidence-bearing event/entity links;
- `hush_extractions`: facts, decisions, tasks, questions, and commitments;
- `hush_provenance`: source links for every derived record;
- `hush_jobs`: resumable processing stages and failure state.

Existing `meetings` and `transcripts` remain supported while records are migrated or linked into this model. FTS5 should be the first retrieval index. Embeddings are optional and must be incremental, local, and replaceable.

## Processing jobs

Processing is a resumable state machine, not one synchronous recording callback:

```text
CAPTURED -> INGESTED -> TRANSCRIBED -> DIARIZED -> SEGMENTED -> EXTRACTED -> INDEXED -> MEMORY_UPDATED
```

Each transition is idempotent and records attempts, timestamps, model identity, and an error class without writing sensitive content to logs. A restart resumes pending jobs. Low disk, unavailable models, corrupt audio, and interrupted processing remain visible as actionable states.

## Capture clients

The Mac microphone is the first source. LifeRecorder is the future iPhone source. Its contract should become a narrow Hush ingest protocol:

- device and chunk IDs are durable and unique;
- timestamps include an explicit timezone and are normalized to UTC;
- checksums are verified before acceptance;
- duplicate chunks return the original receipt;
- chunks are not deleted on the capture device until durable ingest is acknowledged;
- transport is authenticated and encrypted for non-loopback connections;
- ordering is reconstructed from timestamps and IDs, not arrival order.

## Retrieval and agent interface

Hush should expose small local primitives rather than one unrestricted corpus dump:

- `hush.search`
- `hush.recent`
- `hush.timeline`
- `hush.get_episode`
- `hush.get_transcript`
- `hush.get_person_context`
- `hush.get_project_context`
- `hush.get_open_commitments`
- `hush.context_for_query`

The first implementation may be a loopback HTTP/JSON interface shared by the desktop UI and a future MCP server. Results must include source IDs, timestamps, confidence, and provenance kind (`observed`, `extracted`, `summarized`, or `inferred`).

## Privacy boundaries

Capture is always intentional and visibly indicated. Raw audio, transcript text, indexes, and identities stay on local storage by default. Any cloud provider is opt-in behind an explicit provider interface. Retention and deletion are data-model operations, not UI-only promises.
