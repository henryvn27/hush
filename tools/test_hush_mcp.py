#!/usr/bin/env python3
"""Focused contract tests for the local Hush MCP bridge."""

import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from hush_mcp import connect_read_only, fetch_event, fetch_search, fetch_timeline


class HushMcpContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.connection = sqlite3.connect(":memory:")
        self.connection.row_factory = sqlite3.Row
        self.connection.executescript(
            """
            CREATE TABLE hush_events (
                id TEXT PRIMARY KEY, title TEXT, started_at TEXT, ended_at TEXT,
                source_device_id TEXT, source_device_type TEXT, modality TEXT,
                status TEXT, privacy_class TEXT, summary TEXT
            );
            CREATE TABLE hush_transcript_segments (
                id TEXT PRIMARY KEY, event_id TEXT, text TEXT, started_at TEXT,
                ended_at TEXT, start_seconds REAL, end_seconds REAL,
                speaker_label TEXT, created_at TEXT
            );
            CREATE VIRTUAL TABLE hush_transcript_fts USING fts5(
                text, event_id UNINDEXED, segment_id UNINDEXED
            );
            INSERT INTO hush_events VALUES
                ('event-1', 'Design review', '2026-09-14T12:00:00Z', NULL,
                 'mac', 'mac', 'meeting', 'transcribed', 'standard', NULL);
            INSERT INTO hush_transcript_segments VALUES
                ('segment-1', 'event-1', 'David approved the local plan',
                 '2026-09-14T12:00:00Z', NULL, 0, 4, NULL,
                 '2026-09-14T12:00:00Z');
            INSERT INTO hush_transcript_fts VALUES
                ('David approved the local plan', 'event-1', 'segment-1');
            """
        )

    def tearDown(self) -> None:
        self.connection.close()

    def test_timeline_search_and_event_retrieval_are_source_grounded(self) -> None:
        timeline = fetch_timeline(self.connection, 20)
        self.assertEqual(timeline[0]["id"], "event-1")
        self.assertEqual(timeline[0]["segment_count"], 1)

        hits = fetch_search(self.connection, "David?", 20)
        self.assertEqual(hits[0]["segment_id"], "segment-1")
        self.assertEqual(hits[0]["derivation_kind"], "observed")

        event = fetch_event(self.connection, "event-1")
        self.assertIsNotNone(event)
        self.assertEqual(event["segments"][0]["text"], "David approved the local plan")

    def test_read_only_connection_rejects_mutation(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            database = Path(directory) / "hush.sqlite"
            writable = sqlite3.connect(database)
            writable.execute("CREATE TABLE marker (id INTEGER)")
            writable.commit()
            writable.close()

            read_only = connect_read_only(database)
            with self.assertRaises(sqlite3.OperationalError):
                read_only.execute("INSERT INTO marker VALUES (1)")
            read_only.close()


if __name__ == "__main__":
    unittest.main()
