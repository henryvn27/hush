#!/usr/bin/env python3
"""Small read-only MCP stdio bridge for Hush's local event store.

The bridge deliberately opens SQLite in read-only mode and exposes source
material only. It does not upload audio, call a model, or mutate the store.
"""

from __future__ import annotations

import argparse
import json
import re
import sqlite3
import sys
from collections.abc import Iterator
from pathlib import Path
from typing import Any


SERVER_INFO = {"name": "hush-local", "version": "0.1.0"}

TOOLS = [
    {
        "name": "hush.timeline",
        "description": "List recent locally processed Hush events.",
        "inputSchema": {
            "type": "object",
            "properties": {"limit": {"type": "integer", "minimum": 1, "maximum": 100}},
        },
    },
    {
        "name": "hush.search",
        "description": "Search locally indexed Hush transcript text.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "limit": {"type": "integer", "minimum": 1, "maximum": 100},
            },
            "required": ["query"],
        },
    },
    {
        "name": "hush.get_event",
        "description": "Read one local event with its transcript segments.",
        "inputSchema": {
            "type": "object",
            "properties": {"event_id": {"type": "string"}},
            "required": ["event_id"],
        },
    },
]


def connect_read_only(database: Path) -> sqlite3.Connection:
    uri = f"file:{database.resolve()}?mode=ro"
    connection = sqlite3.connect(uri, uri=True)
    connection.row_factory = sqlite3.Row
    return connection


def bounded_limit(value: Any) -> int:
    try:
        return max(1, min(int(value), 100))
    except (TypeError, ValueError):
        return 20


def match_query(value: str) -> str:
    terms = re.findall(r"[A-Za-z0-9_]+", value)
    return " AND ".join(f'"{term}"*' for term in terms[:12])


def fetch_timeline(connection: sqlite3.Connection, limit: int) -> list[dict[str, Any]]:
    rows = connection.execute(
        """
        SELECT e.id, e.title, e.started_at, e.ended_at, e.source_device_type,
               e.modality, e.status, e.privacy_class, COUNT(s.id) AS segment_count,
               (SELECT s2.text FROM hush_transcript_segments s2
                WHERE s2.event_id = e.id ORDER BY s2.start_seconds ASC, s2.created_at ASC LIMIT 1) AS preview
        FROM hush_events e
        LEFT JOIN hush_transcript_segments s ON s.event_id = e.id
        GROUP BY e.id
        ORDER BY e.started_at DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    return [dict(row) for row in rows]


def fetch_search(connection: sqlite3.Connection, query: str, limit: int) -> list[dict[str, Any]]:
    fts_query = match_query(query)
    if not fts_query:
        return []
    rows = connection.execute(
        """
        SELECT s.event_id, s.id AS segment_id, e.title, e.started_at,
               e.source_device_type, e.modality, s.text, s.start_seconds,
               s.end_seconds, 'observed' AS derivation_kind, 1.0 AS confidence
        FROM hush_transcript_fts f
        JOIN hush_transcript_segments s ON s.id = f.segment_id
        JOIN hush_events e ON e.id = s.event_id
        WHERE f.hush_transcript_fts MATCH ?
        ORDER BY e.started_at DESC, s.start_seconds ASC
        LIMIT ?
        """,
        (fts_query, limit),
    ).fetchall()
    return [dict(row) for row in rows]


def fetch_event(connection: sqlite3.Connection, event_id: str) -> dict[str, Any] | None:
    event = connection.execute(
        """SELECT id, title, started_at, ended_at, source_device_id,
                  source_device_type, modality, status, privacy_class, summary
           FROM hush_events WHERE id = ?""",
        (event_id.strip(),),
    ).fetchone()
    if event is None:
        return None
    result = dict(event)
    result["segments"] = [
        dict(row)
        for row in connection.execute(
            """SELECT id, event_id, text, started_at, ended_at,
                      start_seconds, end_seconds, speaker_label
               FROM hush_transcript_segments WHERE event_id = ?
               ORDER BY start_seconds ASC, created_at ASC""",
            (event_id.strip(),),
        ).fetchall()
    ]
    return result


def call_tool(connection: sqlite3.Connection, name: str, arguments: dict[str, Any]) -> Any:
    if name == "hush.timeline":
        return fetch_timeline(connection, bounded_limit(arguments.get("limit", 20)))
    if name == "hush.search":
        return fetch_search(connection, str(arguments.get("query", "")), bounded_limit(arguments.get("limit", 20)))
    if name == "hush.get_event":
        return fetch_event(connection, str(arguments.get("event_id", "")))
    raise ValueError(f"Unknown Hush tool: {name}")


def response(request_id: Any, result: Any = None, error: dict[str, Any] | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {"jsonrpc": "2.0", "id": request_id}
    if error is None:
        payload["result"] = result
    else:
        payload["error"] = error
    return payload


def messages() -> Iterator[dict[str, Any]]:
    for line in sys.stdin:
        if line.strip():
            yield json.loads(line)


def run(database: Path) -> None:
    connection = connect_read_only(database)
    try:
        for request in messages():
            request_id = request.get("id")
            method = request.get("method")
            if method == "notifications/initialized":
                continue
            try:
                if method == "initialize":
                    result = {
                        "protocolVersion": "2024-11-05",
                        "capabilities": {"tools": {"listChanged": False}},
                        "serverInfo": SERVER_INFO,
                    }
                elif method == "tools/list":
                    result = {"tools": TOOLS}
                elif method == "tools/call":
                    params = request.get("params", {})
                    result = {"content": [{"type": "text", "text": json.dumps(call_tool(connection, params.get("name", ""), params.get("arguments", {})), ensure_ascii=True)}]}
                else:
                    raise ValueError(f"Unsupported MCP method: {method}")
                if "id" in request:
                    print(json.dumps(response(request_id, result=result)), flush=True)
            except (sqlite3.Error, ValueError, TypeError, json.JSONDecodeError) as error:
                if "id" in request:
                    print(json.dumps(response(request_id, error={"code": -32602, "message": str(error)})), flush=True)
    finally:
        connection.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Read-only local MCP bridge for Hush")
    parser.add_argument("--db", required=True, type=Path, help="Path to Hush's SQLite database")
    args = parser.parse_args()
    run(args.db)


if __name__ == "__main__":
    main()
