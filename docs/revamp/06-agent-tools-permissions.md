# 06 — Agent, tools & permissions

## 1. Agent loop (no LangGraph)

A plain streaming tool-calling loop. It stays small because the kernel, the permission engine and the
tool registry do the heavy lifting.

```python
async def run_turn(ctx, conversation, user_msg) -> None:
    messages = ctx.prompt.build(conversation, user_msg)          # persona + skills + tool guidance + history
    for step in range(cfg.max_steps):
        calls = []
        async for ev in ctx.llm.stream(messages, ctx.tools.specs(), cfg.gen):
            match ev:
                case TextDelta(text):  await ctx.emit("assistant.delta", text)   # → segmenter, bubble
                case ToolCall() as c:  calls.append(c)
        if not calls:
            break
        results = await ctx.tools.execute_all(calls, turn=ctx.turn)   # permission check inside; may await approval
        messages += [assistant_with(calls), *results]
    await ctx.emit("assistant.done")
```

- **Approvals are just `await`.** When the permission engine returns `ask`, the tool call awaits a
  future that resolves when the user clicks Allow/Deny in the bubble (or on a timeout, which means
  deny). asyncio makes this trivial, and it is the main reason people reach for LangGraph
  "interrupts". Our loop doesn't need them.
- Independent tool calls in one step run concurrently (`TaskGroup`). Calls that need approval are
  serialised so only one approval bubble shows at a time.
- **Why not LangGraph:** it adds a graph DSL, a checkpointer and a dependency for a loop that is about
  30 lines. If multi-step *planning* with persistence is ever needed (e.g. long background tasks), it
  can come in later as an alternative `agent` plugin without touching anything else. (Resume note:
  describe this as "a custom streaming agent runtime with tool calling and human-in-the-loop
  approvals".)

## 2. Tool registry

```python
@dataclass(frozen=True)
class ToolSpec:
    name: str                       # "fs.read_file", "mcp.github.create_issue", "browser.click" (later)
    description: str
    input_schema: dict              # JSON Schema (generated from a pydantic model for built-ins)
    capability: str                 # permission key, e.g. "fs.read", "fs.write", "shell.exec", "input.control"
    resource: Callable[[dict], str] | None   # extracts the resource from args, e.g. the path or command
    effect: Literal["read", "write", "exec", "network"]
```

- Tools are registered with `ctx.tools.register(spec, handler)`, which is an **effect**. Unmounting
  the plugin that registered a tool removes the tool.
- The tool list sent to the model is filtered by the permission mode: tools whose capability is
  `deny` in every case are **not offered at all**. That saves tokens and stops the model from trying.
- Tool results are truncated or summarised to a size cap before going back to the model. The full
  result goes to the event log.

## 3. Permission engine

### 3.1 The file you edit: `permissions.json`

```jsonc
{
  "$schema": "./permissions.schema.json",
  "mode": "read-only",            // "read-only" | "ask" | "trusted"
  "rules": {
    "deny":  ["fs.*(~/.ssh/**)", "fs.*(**/.env)", "shell.exec(rm *)", "shell.exec(sudo *)"],
    "ask":   ["fs.write(~/Documents/**)", "app.open(*)", "input.control(*)"],
    "allow": ["fs.read(~/Documents/**)", "fs.read(~/Downloads/**)", "clipboard.read", "screen.capture",
              "shell.exec(git status)", "mcp.github.*"]
  },
  "approvalTimeoutSec": 60,
  "rememberAlwaysAllowIn": "permissions.local.json"   // "Always allow" clicks are written here, not in your file
}
```

Rule syntax: `capability(resource-glob)`. The capability part can use `*` wildcards. A missing
`(…)` means any resource. Paths are normalised (`~`, symlinks resolved, `..` collapsed) **before**
matching, so `~/Documents/../.ssh/id_rsa` can't slip through.

### 3.2 Evaluation

```
1. any deny rule matches             → DENY
2. any ask rule matches              → ASK
3. any allow rule matches            → ALLOW
4. fall back to mode:
     read-only : effect == "read" → ALLOW, else DENY
     ask       : effect == "read" → ALLOW, else ASK
     trusted   : ALLOW, except exec/input.control → ASK
```

- Deny always wins, and **the default is read-only**, as you asked.
- The engine is a `waterfall` listener on `tool.before_call`. Other plugins can add policy (e.g. a
  "quiet hours" plugin), and the core policy stays in one place.
- Rules are compiled once per config change into matchers (capability trie + compiled globs).
  Evaluation is a few microseconds.
- **Audit log:** every decision (tool, args digest, resource, decision, rule that matched, who
  approved) goes to the event log and shows in *Configure → Permissions → Audit*.

### 3.3 Approval UX

The approval bubble on the avatar shows: *what* (a human sentence generated from the spec), *where*
(the resource), and three buttons: **Allow once · Always allow · Deny**. "Always allow" adds a precise
rule (exact resource, not a wildcard) to `permissions.local.json`. No response before the timeout
counts as Deny.

## 4. Desktop tools (phased, all behind `features.desktopTools`)

| Phase | Tools | Capability | Default |
|-------|-------|-----------|---------|
| 4a (read) | `fs.list`, `fs.read_file` (text, PDF text, image → vision), `fs.search` (name/content, bounded), `clipboard.read`, `screen.capture` (one monitor or window), `windows.list`, `apps.list`, `system.info` | `fs.read`, `clipboard.read`, `screen.capture`… | Allowed in read-only |
| 4b (act) | `fs.write_file`, `fs.move`, `fs.trash` (never hard delete), `clipboard.write`, `app.open`, `url.open`, `window.focus`, `notify` | `fs.write`, `app.open`… | Ask/deny by mode |
| 4c (exec) | `shell.exec` (no shell interpolation; argv list; cwd; timeout; output cap) | `shell.exec` | Deny unless a rule allows |
| 4d (computer use) | `input.move/click/type/key/scroll` + screenshot loop | `input.control` | Ask every time, stop hotkey, visible "controlling" state on the avatar |

Libraries: `mss` (screenshots), `pyperclip`/native (clipboard), `psutil` (processes),
platform launchers (`os.startfile`, `open`, `xdg-open`), `pynput` (input). Per-OS code sits behind one
small interface per tool, with the OS picked at mount time.

**Computer use (4d):** with Anthropic models, use the native computer-use tool definition. With other
vision models, use a generic loop: screenshot → the model returns an action in our JSON schema →
execute → screenshot. It is off by default and experimental in v1.

## 5. Safety beyond permissions

- **Prompt-injection awareness:** content from files, web pages, screenshots and MCP tool results is
  wrapped as untrusted data in the prompt. A tool call that *follows* an untrusted-content read and
  wants `write`/`exec` is escalated to ASK even when a rule would allow it (a "taint" flag on the turn).
  It is cheap and it is a strong talking point.
- **Kill switch:** Esc/hotkey or right-click → Stop cancels the running turn (TaskGroup cancel) and
  any computer-use loop immediately.
- **No network tools in v1** except through MCP servers that you add explicitly.
