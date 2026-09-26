# 07 — MCP, skills & persona

All three are plugins, so they can be added, edited and removed live (temporal composability), and
each can be toggled individually.

## 1. MCP servers

- **Client:** the official `mcp` Python SDK. Transports: **stdio** (local servers) and **streamable
  HTTP** (remote). SSE only if a server needs it.
- **Config file `mcp.json`** uses the **same `mcpServers` shape as Claude Desktop / Claude Code**, so
  users can paste existing configs:

```jsonc
{
  "mcpServers": {
    "filesystem": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem", "~/Notes"] },
    "github":     { "type": "http", "url": "https://api.githubcopilot.com/mcp/",
                    "headers": { "Authorization": "Bearer ${secret:github}" } },
    "spotify":    { "command": "uvx", "args": ["spotify-mcp"], "disabled": true }
  }
}
```

- **One plugin per server.** On mount it spawns or connects, lists tools and registers each as
  `mcp.<server>.<tool>` (capability = the same name, effect from the MCP `readOnlyHint` annotation,
  treated as a *hint*, so default policy for MCP tools is ASK unless you allow them). It also listens
  for `tools/list_changed` and re-registers. On unmount everything is removed and the process is
  terminated.
- **Runtime prerequisites:** most stdio servers need `node`/`npx` or `uv`/`uvx` installed on your
  machine, and the app does not bundle them. If the command isn't found, the server's status is
  "`npx` not found — install Node.js" with a link, instead of a cryptic spawn error. The PATH used to
  spawn servers is your login-shell PATH, resolved once at startup (`bash -lic 'echo $PATH'`). This
  matters on Ubuntu because apps launched from the GNOME dock don't read `~/.bashrc`, where tools like
  `nvm` add `node` to the PATH.
- **Timeouts:** connect 20 s, tool call 60 s (per-server override). A hung server never blocks a
  turn forever.
- **Trust:** see 06 §6. MCP servers run outside the permission engine's reach.
- **Resources and prompts** (MCP features beyond tools) come in a later milestone. Tools first.
- **Status in the panel:** connected / connecting / error (stderr tail) / number of tools, with a
  per-server toggle.
- `${secret:name}` placeholders are resolved from the keychain at mount time and never written to
  logs.
- **OAuth for remote MCP servers:** later milestone. v1 supports header tokens.

## 2. Skills (Agent Skills format)

Use the open **Agent Skills** format (`SKILL.md` with YAML frontmatter). It is the format Claude Code
and other agents use, so skills are portable in both directions.

```
~/.config/ai-avatar/skills/
└── expense-report/
    ├── SKILL.md          # frontmatter: name, description (+ optional allowed-tools)
    ├── template.xlsx     # optional resources
    └── scripts/fill.py   # optional scripts (run only through shell.exec permission rules)
```

```markdown
---
name: expense-report
description: Fill the monthly expense template from receipts in ~/Downloads/receipts. Use when the user asks for an expense report.
---
# Steps
1. List receipts with fs.list …
```

- **Progressive disclosure** (the same idea as Claude's skills): only `name + description` of each
  enabled skill goes into the system prompt. The agent gets a built-in tool `skills.load(name)` that
  returns the full body (and lists resources) when it decides the skill is relevant. That keeps the
  prompt small even with many skills. `skills.load` has capability `skills.read` (effect `read`), so
  it is allowed in read-only mode.
- **Skill trust:** skills imported from elsewhere start disabled and marked "review before
  enabling" (06 §6). Skills you write in the app are trusted.
- **One plugin per skill.** Mount registers its prompt line and resources. Editing the file triggers a
  reconfigure, and deleting it triggers an unmount.
- **Writing skills in the app:** *Configure → Skills → New* opens a template in the editor, validates
  the frontmatter, and saves to the folder. *Test* runs a sample prompt in the bubble.
- **Assistant-authored skills (later):** a `skills.write` tool (capability `skills.write`, ASK by
  default) lets the avatar save a procedure it just performed as a new skill, after you approve it.
- Scripts inside skills get no special privilege. They run through `shell.exec` and the permission
  engine like anything else.

## 3. Persona

`persona.md` is free-form Markdown with optional frontmatter:

```markdown
---
name: Aria
voice: kokoro:af_heart  # optional override of the TTS voice
---
You are Aria, a calm, witty desktop companion. Keep spoken replies under 3 sentences unless asked.
Use [happy] when greeting, [thinking] before long answers. Never read code aloud; summarise it.
```

- The `persona` plugin registers it as the first prompt section. Frontmatter can override voice and
  speed (applied via config reconfigure). Reply language follows the user's input unless the persona
  text says otherwise (03 §4.6).
- If the voice named in frontmatter doesn't exist in the active TTS provider, the plugin warns in the
  panel and uses the provider default. A persona never breaks voice output.
- The panel gives an editor with a live "test in bubble" button. Multiple personas (switchable from
  the context menu) are a later milestone. The file format already allows it (`personas/*.md`).

## 4. Prompt assembly order

1. Persona
2. Operating rules (built in: brevity for speech, expression-tag syntax, safety and untrusted-content
   rules)
3. Skills index (name + description lines)
4. Environment facts (OS, date/time, active window title if `screen` tools are on)
5. Conversation history (windowed; older turns summarised when over budget, as a later milestone)

Each section is an effect registered by its owning plugin, so turning a feature off removes its
section automatically.
