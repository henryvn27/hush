-- Canonical local event layer. Existing meetings/transcripts remain the
-- compatibility surface while new capture modes converge on these tables.
CREATE TABLE IF NOT EXISTS hush_events (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    source_device_id TEXT NOT NULL,
    source_device_type TEXT NOT NULL CHECK (source_device_type IN ('mac', 'iphone', 'ipad', 'import')),
    modality TEXT NOT NULL CHECK (modality IN ('dictation', 'ambient', 'meeting', 'manual', 'import')),
    status TEXT NOT NULL DEFAULT 'transcribed',
    privacy_class TEXT NOT NULL DEFAULT 'standard',
    source_uri TEXT,
    summary TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hush_events_started_at ON hush_events(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_hush_events_source ON hush_events(source_device_type, modality);

CREATE TABLE IF NOT EXISTS hush_transcript_segments (
    id TEXT PRIMARY KEY NOT NULL,
    event_id TEXT NOT NULL,
    meeting_id TEXT,
    transcript_id TEXT,
    text TEXT NOT NULL,
    started_at TEXT,
    ended_at TEXT,
    start_seconds REAL,
    end_seconds REAL,
    speaker_label TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (event_id) REFERENCES hush_events(id) ON DELETE CASCADE,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_hush_segments_event ON hush_transcript_segments(event_id, start_seconds);
CREATE INDEX IF NOT EXISTS idx_hush_segments_meeting ON hush_transcript_segments(meeting_id);

CREATE VIRTUAL TABLE IF NOT EXISTS hush_transcript_fts USING fts5(
    text,
    event_id UNINDEXED,
    segment_id UNINDEXED,
    tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TABLE IF NOT EXISTS hush_provenance (
    id TEXT PRIMARY KEY NOT NULL,
    derived_type TEXT NOT NULL,
    derived_id TEXT NOT NULL,
    source_event_id TEXT NOT NULL,
    source_segment_id TEXT,
    start_seconds REAL,
    end_seconds REAL,
    derivation_kind TEXT NOT NULL CHECK (derivation_kind IN ('observed', 'extracted', 'summarized', 'inferred')),
    confidence REAL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (source_event_id) REFERENCES hush_events(id) ON DELETE CASCADE,
    FOREIGN KEY (source_segment_id) REFERENCES hush_transcript_segments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_hush_provenance_source ON hush_provenance(source_event_id, source_segment_id);
CREATE INDEX IF NOT EXISTS idx_hush_provenance_derived ON hush_provenance(derived_type, derived_id);

CREATE TABLE IF NOT EXISTS hush_jobs (
    id TEXT PRIMARY KEY NOT NULL,
    event_id TEXT NOT NULL,
    stage TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    attempts INTEGER NOT NULL DEFAULT 0,
    available_at TEXT NOT NULL,
    started_at TEXT,
    finished_at TEXT,
    error_code TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (event_id, stage),
    FOREIGN KEY (event_id) REFERENCES hush_events(id) ON DELETE CASCADE
);
