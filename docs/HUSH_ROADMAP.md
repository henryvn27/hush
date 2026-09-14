# Hush Roadmap

## Milestones

### 1. Core stabilization

Keep dictation fast, compact, local, and reliable. Preserve the existing meeting, import, recovery, settings, and Flow Bar workflows while removing fake states and improving failure recovery.

### 2. Local timeline

Add the canonical event store, Mac microphone ingest, resumable local processing jobs, timestamped transcript segments, and a first-class timeline.

### 3. Structured memory

Add episodes, entities, confidence-bearing extractions, provenance, FTS retrieval, retention, and deletion cascades.

### 4. Local agent interface

Expose cited retrieval primitives through a loopback API and MCP adapter. Keep context narrow, inspectable, and local.

### 5. iPhone capture node

Adapt LifeRecorder's durable chunk protocol and visible capture UX as a separate Hush Capture client. Validate real iOS background/audio-session behavior on hardware before expanding scope.

### 6. Ambient intelligence

Add long-running capture controls, speaker/entity resolution, memory compaction, optional local embeddings, performance instrumentation, and context synthesis.

## Near-term vertical slice

The first end-to-end slice is intentionally Mac-only:

```text
Mac microphone -> local audio segment -> local transcription -> canonical event
-> timeline -> FTS search -> cited local retrieval
```

The slice must survive restart, expose processing failures, avoid required cloud calls, and support deletion before iPhone integration begins.

## Non-goals for the first slice

- no hidden or automatic surveillance behavior;
- no general-purpose cloud sync;
- no giant daily Markdown blob as the canonical store;
- no premature vector database;
- no iPhone rewrite before the Mac event pipeline is proven.
