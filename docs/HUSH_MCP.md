# Hush Local MCP

Hush exposes a small read-only Model Context Protocol bridge over standard input/output. It lets a local assistant retrieve Hush context without granting network access or mutation rights.

Start it against the Hush SQLite database:

```sh
python3 tools/hush_mcp.py --db /path/to/hush.sqlite
```

The bridge supports the MCP methods `initialize`, `tools/list`, and `tools/call`, with these tools:

- `hush.timeline`: recent processed events with source and privacy metadata.
- `hush.search`: full-text search over locally indexed transcript segments.
- `hush.get_event`: one event and its source transcript segments.

The database is opened read-only. The adapter does not record audio, invoke a cloud model, upload data, or delete events. A future Hush release can register this bridge as a bundled desktop MCP server once the database path is exposed through the app's local configuration surface.
