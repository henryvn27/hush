# Hush Memory Model

Hush keeps several derived levels instead of turning the day into one giant text file.

## Layers

0. **Source**: audio or imported material, subject to retention.
1. **Transcript**: timestamped text and speaker turns.
2. **Episode**: a meaningful conversation, lecture, work session, or interaction.
3. **Extraction**: facts, decisions, tasks, questions, commitments, topics, and entities.
4. **Durable memory**: conservative information likely to matter again.
5. **Synthesized context**: an on-demand answer assembled from lower layers and cited back to them.

Durable memory is not automatic truth. It carries confidence, provenance, and correction history.

## Canonical event shape

The implementation may evolve, but every input mode must be representable by one event identity:

```text
event
  id, start, end
  source device and modality
  transcript and audio references
  speaker/entity/topic links
  extracted facts, decisions, tasks, questions, commitments
  summary
  privacy and retention metadata
```

Dictation, meetings, ambient capture, imports, and manual notes use the same event and provenance concepts. A meeting is a UI grouping and compatibility surface, not a second memory universe.

## Identity

Speaker diarization first yields anonymous speaker labels. Names are assigned only with evidence such as confirmation, explicit self-identification, meeting context, or a high-confidence local voice match. Every assignment carries confidence and can be corrected globally.

Entities stay intentionally small: people, projects, organizations, classes, products, and repositories. Aliases such as `Sim Deck`, `simdeck`, and `the classroom simulation thing` are links for retrieval, not reasons to build a large ontology.

## Provenance

Every search result and agent context item includes:

- event ID;
- source type and device;
- UTC timestamp and duration;
- transcript segment or extraction ID;
- derivation kind;
- confidence;
- a route back to the original transcript/time in the desktop UI.
