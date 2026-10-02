# 05 — Models & accounts

## 1. Two ports, not one

Your requirement is "don't depend on one or two LLM providers, and let me use my Claude
subscription." Those two need different shapes, so there are two ports. `ChatModel` means we run
the loop; `AgentBackend` means Claude Code runs the loop through the Agent SDK (§3):

```python
class ChatModel(Protocol):
    """We run the agent loop; the provider only generates."""
    capabilities: ModelCaps          # tools, vision, streaming, max_context, computer_use
    def stream(self, messages: list[Message], tools: list[ToolSpec],
               opts: GenOptions) -> AsyncIterator[ModelEvent]: ...
    # ModelEvent = TextDelta | ReasoningDelta | ToolCallDelta | ToolCall | Usage | Stop(reason)

class AgentBackend(Protocol):
    """An external agent runs the loop (e.g. Claude Code). We give it our tools and a permission
    callback, and consume its text stream."""
    def run(self, prompt: str, history: list[Message], tools: ToolBridge,
            can_use_tool: PermissionCallback) -> AsyncIterator[AgentEvent]: ...
```

The `agent` plugin injects `llm` and accepts either port. The rest of the system (segmenter, TTS,
visemes, bubble) only sees text deltas and tool activity, so it doesn't care which port is behind it.

Messages use **one normalised internal format** (role, content parts: text / image / tool_call /
tool_result). Each adapter converts to and from its vendor format at its own boundary.

## 2. ChatModel adapters

| Adapter | Covers | Auth |
|---------|--------|------|
| `anthropic` | Claude models through the Anthropic API (streaming, tools, vision, computer-use tool) | API key (Claude Console) |
| `openai_compat` | OpenAI, **OpenRouter**, DeepSeek, Groq, Together, Mistral (OpenAI-compatible endpoint), **Ollama**, **LM Studio**, vLLM | API key + `base_url` |
| `gemini` | Google Gemini (`google-genai`) | API key |

Three adapters cover nearly every provider. OpenRouter alone gives access to hundreds of models. Each
adapter is ~150–250 lines and passes the shared contract tests (streaming text, one tool call,
parallel tool calls, image input, cancellation mid-stream, error mapping).

**Capability differences are handled explicitly, not assumed:**

- **No tool calling** (some local models): the agent runs chat-only for that model. Tools are not
  offered, and the Features panel shows "Tools unavailable with <model>". We don't emulate tool
  calling with prompt parsing in v1.
- **No vision:** screenshots and images are routed to the `vision` role model if one is configured;
  otherwise the tool result says "no vision model configured".
- **Model capabilities** come from the adapter (known model table + provider metadata, e.g.
  OpenRouter's `/models` endpoint), and the user can override them in config for unknown local
  models.
- **Prompt caching:** the Anthropic adapter sets cache breakpoints after the tools and after the
  stable system sections (persona, rules, skills index). OpenAI-compatible providers cache prefixes
  automatically where supported. That's why prompt assembly (07 §4) puts stable sections first and
  volatile ones (time, active window) last.
- **Context budget:** each turn must fit `model.max_context - max_output - safety margin`. How that
  is achieved is **per adapter**, because some providers forbid editing earlier history (see §2a):
  - `openai_compat` and `gemini`: window history from the newest turn backwards, replace large old
    tool results with a one-line stub ("[tool result omitted: 14 KB]"), then drop the oldest turns.
  - `anthropic`: **never edit or drop sent history locally**. Use supported API compaction/context
    editing (§2a). When unavailable, reject an over-budget turn before sending and offer *New
    conversation*, retaining history (F21). Windowing never splits a tool-call/result group.
  - `claude_subscription`: Claude Code manages its own context (§3).
  - Token counts use the provider's counter when available (Anthropic `count_tokens`), otherwise a
    tokenizer estimate plus a 10% margin. Summarisation for the other adapters is post-v1.

**Model roles** in config: `main` (conversation + tools) and optional `vision` (screenshots, if `main`
lacks vision). Keep it to these two; add roles only when a real need appears.

## 2a. Anthropic API adapter: rules that must hold

The table records the intended adapter behavior. Model IDs, SDK fields and beta headers are
version-dependent, not universal guarantees. T1.9 records the selected model's capability fixture
and exact locked SDK request schema. Unsupported thinking/effort/cache/context options are omitted
or reported explicitly; never retry a rejected request by silently changing model or billing path.

| Rule | Why |
|------|-----|
| Default model `claude-opus-5`. The model is a config value and the UI lists models from the Models API (`client.models.list()`, which returns `max_input_tokens`, `max_tokens` and `capabilities`) | No hard-coded model table for Anthropic |
| Use adaptive thinking and `output_config.effort` only where supported; default effort `low`. The UI offers only supported levels, and explains an unsupported configured level | Thinking controls differ across model versions |
| **Append-only history.** The full assistant `content` (thinking, text and tool_use blocks) is stored and sent back **unchanged**. Earlier messages are never edited, truncated or dropped | Newer models reject edited history that contains thinking blocks (400 on newer accounts) or silently lose reasoning |
| Long conversations use supported **server-side compaction** and **tool-result clearing**; retain returned blocks unchanged. Exact headers/schema belong to the pinned adapter's contract fixtures, not a global hard-coded assumption | If unsupported, use F21's explicit context-limit outcome |
| All tool results of one step go back in **one** user message, and a failed tool returns `is_error: true` | The API contract for parallel tool use |
| Use `tool_choice: auto` when tools are present; omit tool options for chat-only models | Avoid incompatibility with thinking/model restrictions |
| Tool inputs are parsed as JSON and validated against the tool's schema before running | Escaping differs between models; never string-match |
| Map refusal to a clean end, retaining any returned refusal text. Do not enable vendor-managed model fallback; Svara's explicit `llm.fallback` is the only configured fallback path | No hidden model or billing change |
| Prompt caching: top-level `cache_control` + a stable prefix (tools → system). Volatile facts (time, focused app) are sent as a **mid-conversation system message** on models that support it, otherwise inside the user turn. **Never** in the top-level system prompt | Any byte change in the prefix invalidates the cache |
| Barge-in never edits the interrupted assistant message. The next user turn starts with a short note: "(You were interrupted after: '…'.)" | Same append-only rule |
| Typed SDK errors are mapped to our error types (`AuthenticationError` → `ProviderAuthError`, `RateLimitError` → `ProviderRateLimit`, …). The SDK's own retries are set to 0, and our retry policy (04 §4a) decides | One retry policy in one place |

## 3. The Claude subscription (the primary Claude path, by your decision)

### 3.1 Policy checkpoint (primary sources rechecked 2026-10-02)

- **Allowed and documented:** Claude's help article *"Use the Claude Agent SDK with your Claude
  plan"* (updated 16 Jun 2026) says Pro, Max, Team and Enterprise plans cover the Agent SDK,
  `claude -p`, and third-party apps that authenticate with your subscription *through the Agent SDK*.
  A planned move of this usage to a separate monthly credit was paused on 15 Jun 2026, so for now it
  draws from your normal subscription limits.
- **Not allowed:** using subscription OAuth **tokens** directly in any other product (Anthropic's
  usage policy, Feb 2026). And the Agent SDK docs say that, unless previously approved, **third-party
  developers may not *offer* claude.ai login** or subscription rate limits in their products.
- **Intended integration, subject to the release gate below:** the app uses the **official Agent SDK**, which runs the official
  Claude Code binary, logged in **by you, in a terminal, outside our app**. The app never shows a
  Claude login, never reads, stores or forwards a token, and never markets subscription access.
  It uses the machine's existing Claude Code login. This technical separation is **not proof of
  permission to distribute subscription access**.
- **Policy volatility:** Anthropic changed this area three times in 2026. The same adapter layer has an
  **Anthropic API-key** path, and switching is one config value. Public demos and recordings use the
  API-key path.

The [help article](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan)
still states that the announced usage change is paused. The
[SDK overview](https://code.claude.com/docs/en/agent-sdk/overview) still restricts third-party login
offerings. T0.11 must record both technical results and the unresolved distribution interpretation;
T4.10/T7.7 recheck before publication. If permission cannot be established, keep the subscription
experiment local and block any release claiming it. Ask the user before changing release scope;
do not silently substitute a paid API key. No provider query is authorized by this planning review.

### 3.2 The `claude_subscription` adapter (an `AgentBackend`)

| Aspect | Specification |
|--------|---------------|
| Library | `claude-agent-sdk` (Python, `ClaudeSDKClient`). Its wheel bundles a ~100 MB Claude Code CLI. We **don't use or ship the bundled one**: `cli_path` points to **your installed `claude`** (found on the login-shell PATH), so login, updates and terms are those of your own official install, and the `.deb` stays small |
| Login | Done by you outside Svara. Local executable/status checks on mount; a minimal readiness query only after explicit Test/selection consent, because it consumes usage. Failure → pending with exact instructions. Never inspect credential-file contents. T0.11 verifies login remains available under isolation |
| Environment | Construct a tested child environment allow-list, preserving official login access but excluding API-key/token, alternate endpoint and cloud-backend overrides. Removing two variables alone does not prove subscription billing; record non-secret auth provenance or label it unverified |
| Built-in tools | **None.** `tools=[]`, plus `disallowed_tools` listing every Claude Code built-in (Bash, Read, Write, Edit, Glob, Grep, WebFetch, WebSearch, …) as a second guard. A contract test asserts that the session's tool list is exactly our tools |
| Settings isolation | `setting_sources=[]`, empty app-owned cwd, no added plugins. T0.11 installs harmless sentinel settings/memory/hooks in an isolated fixture and proves none load. Managed settings or an unrecognized SDK/CLI version that defeats isolation make the adapter pending, not silently trusted |
| System prompt | `system_prompt` = our assembled prompt string (persona + rules + skills index, 07 §4). It replaces Claude Code's own default prompt |
| Our tools | Exposed with `create_sdk_mcp_server(name="svara", tools=[…])`, one `@tool` per registered tool, regenerated when the tool registry changes |
| Permissions | **Enforced inside each tool handler** by our permission engine, which is authoritative. `can_use_tool` is also wired to the same engine, but it is not relied on, because the SDK only calls it when its own permission flow falls through to a prompt |
| Streaming | `include_partial_messages=True`. Text deltas feed the segmenter exactly like other providers |
| Turn limit | `max_turns` = `agent.maxSteps` |
| Model | `model` = config `llm.model` (a Claude Code model alias, default: Claude Code's default) |
| Conversation continuity | One SDK session per conversation. The session id is stored in the event log, and the session is resumed after an app restart. Our event log remains the record the Conversations window shows |
| Latency | The client stays connected for the whole conversation, so process start-up happens once, not per turn |
| Branding | Shown in the UI as **"Claude (your subscription)"**, never as "Claude Code". The Agent SDK's branding rules forbid presenting a product as Claude Code |

### 3.3 Order of Claude options in the UI

1. **Claude (your subscription)**, the default when a logged-in Claude Code is detected
2. **Claude (API key)**, the `anthropic` ChatModel adapter (§2a)
3. All other providers (OpenRouter, OpenAI, Gemini, Ollama, …), with API keys or local endpoints

## 4. Identity

The app has **no accounts** in v1: it is local-first, and config lives in files on your machine. A
Claude subscription is a *model provider*, never the app's identity. The future browser extension
pairs with the desktop core using a one-time code (see 10), not a Claude login. The Agent SDK rules
above rule out offering claude.ai login in the extension anyway.

## 5. Secrets

- API keys are stored in the **OS keychain** (`keyring` → Secret Service, i.e. GNOME Keyring on
  Ubuntu, unlocked at login) under the service name `svara`. Config files hold only a reference:
  `"apiKey": {"secret": "openrouter"}`.
- Keys never go to the webview after being saved. The panel shows `••••last4` and a *Test* button that
  the core runs.
- Environment variables (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, …) are honoured as a fallback for
  developers and CI.

## 6. Privacy: what leaves the machine

The app has no server and no telemetry. What leaves the machine depends only on the providers you
choose:

| Data | Goes to | When |
|------|---------|------|
| Your speech audio | Cloud STT provider | Only if a cloud STT is selected (default is local) |
| Transcript, persona, history, tool results, **screenshots** | The LLM provider | Every turn |
| Assistant text | Cloud TTS provider | Only if a cloud TTS is selected (default is local) |
| MCP tool arguments | That MCP server | When the tool is called |

The Configure panel shows this table *live* for the current config ("Your screenshots are sent to
OpenRouter → Anthropic"). The first time a screenshot would go to a cloud model, the user is asked
once for consent. Logs redact secrets and anything matching common key patterns.

## 7. Cost and safety guards

- Per-turn caps: max tool iterations (default 8), max output tokens, max wall time. All configurable.
- Token usage is recorded per turn in the event log and shown in Conversations. Spend dashboards
  and daily-spend warnings are outside v1; do not add a price-table maintenance subsystem.

API implementation references (recheck when implementing T1.9):
[compaction](https://platform.claude.com/docs/en/build-with-claude/compaction) and
[thinking controls](https://platform.claude.com/docs/en/build-with-claude/thinking-steering-and-cost).
Capability-driven requests are Svara's design decision, not a claim that every model supports these.
