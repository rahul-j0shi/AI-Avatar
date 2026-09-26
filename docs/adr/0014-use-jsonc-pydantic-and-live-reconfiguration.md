# 0014 — Use JSONC, pydantic schemas, and live plugin reconfiguration
Status: Accepted

Context: Configuration must be editable both by people and by the Configure window, validate before
application, preserve comments, and turn components on or off without restart. Supporting several
formats would multiply parsers, schemas, migrations, and UI behavior. The design is in
[Configuration §§1–3](../revamp/08-config-and-data.md#1-files-all-in-the-os-config-dir-via-platformdirs-eg-configsvara).

Decision:
- Use versioned JSONC files under the platform config directory for settings, permissions, MCP, and
  avatar metadata; keep persona and skills in their native Markdown format.
- Define config models in pydantic and generate JSON Schemas for Monaco and TypeScript consumers.
- Parse and validate a complete candidate before applying it; retain the last valid configuration on
  error.
- Convert valid configuration into a plugin tree and mount, unmount, or reconfigure only the changed
  nodes.
- Watch files, deduplicate panel writes by content hash, and write atomically while keeping
  machine-owned values separate from commented human files.
- Run ordered, backup-first migrations by file version.

Consequences:
- Files and the graphical panel share one validation and application path.
- Feature flags do not become scattered conditionals; they control plugin presence.
- Comment-preserving edits and migration behavior add implementation complexity.
- YAML and TOML configuration are not supported in v1.

Evidence:
- [Feature F30](../revamp/12-feature-specification.md#f30--config-files-hot-reload--feature-flags)
  defines invalid-config, hot-reload, and feature-toggle acceptance criteria.
- T1.2 implements schemas, loading, diffing, watching, atomic writes, and migrations.
