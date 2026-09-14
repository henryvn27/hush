-- Keep imports idempotent without changing the established meetings model.
CREATE TABLE IF NOT EXISTS meeting_imports (
    meeting_id TEXT PRIMARY KEY NOT NULL,
    source TEXT NOT NULL,
    source_key TEXT NOT NULL UNIQUE,
    original_name TEXT,
    imported_at TEXT NOT NULL,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_meeting_imports_source ON meeting_imports(source);
