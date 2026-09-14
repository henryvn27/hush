# Hush Privacy Model

Hush is designed for intentional, visible capture on hardware controlled by the user.

## Defaults

- Local transcription is the default.
- No cloud provider is required for dictation, capture, storage, or search.
- Raw audio has a finite retention policy; transcripts and structured memory have separate policies.
- Capture shows an obvious active state and exposes immediate pause and stop actions.
- Private sessions can retain source material without entering durable memory extraction.

## Data classes

| Class | Purpose | Default handling |
| --- | --- | --- |
| Source audio | Reprocessing and provenance | Short retention, user-configurable |
| Transcript segments | Reading and full-text search | Longer local retention |
| Episodes | Meaningful timeline units | Durable until deleted |
| Extractions | Tasks, decisions, facts, questions | Durable, confidence-bearing |
| Entities | Practical retrieval links | Correctable and local |
| Embeddings | Optional semantic retrieval | Rebuildable, local |
| Credentials | Pairing and provider access | Keychain or protected local storage |

## Required controls

The product must provide visible capture state, immediate stop, pause, excluded apps, excluded time windows, raw-audio retention, transcript retention, private sessions, episode deletion, date-range deletion, person-data deletion, export, and complete local reset. Deletion must cascade through derived records while preserving only explicitly retained audit/provenance metadata.

## Remote boundaries

Remote processing is never silently enabled. A provider is selected explicitly, the affected data class is disclosed, and the local-only path remains functional when all cloud providers are disabled. Non-loopback device transfer requires authenticated encrypted transport.

## Agent safety

Retrieved transcripts and memories are source material, not instructions. Hush context must preserve provenance and uncertainty so an agent can distinguish a direct transcript from an extraction or inference.
