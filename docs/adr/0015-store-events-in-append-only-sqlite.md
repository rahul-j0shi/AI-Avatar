# 0015 — Store events in append-only SQLite
Status: Accepted

Context: Conversations, tool results, permission decisions, errors, and latency metrics need one
durable and auditable source of truth. Separate chat, audit, and metrics stores would duplicate data
and complicate crash recovery. The schema and projections are described in
[Configuration §4](../revamp/08-config-and-data.md#4-storage-sqlite-event-log).

Decision:
- Store a small conversations table and one append-only events table in a local SQLite database.
- Use monotonically ordered event IDs, JSON payloads, WAL mode, and indexes by conversation and kind.
- Send writes through one asynchronous writer queue so the event loop never blocks on disk.
- Derive model history, conversation views, audits, and metrics as projections of events instead of
  storing them again.
- Use transactional `PRAGMA user_version` migrations and configurable retention.
- Do not store microphone or generated audio by default.

Consequences:
- History and audit agree by construction and can be replayed for diagnostics.
- SQLite keeps deployment to one local file without a database service.
- Projection code must tolerate old event versions and incomplete interrupted turns.
- Append-only means ordinary corrections become new events; explicit history clearing and retention
  remain destructive maintenance operations.

Evidence:
- [Feature F32](../revamp/12-feature-specification.md#f32--storage-retention--export) defines crash,
  retention, export, and deletion behavior.
- T1.3 implements the writer, WAL configuration, migrations, and crash test.
