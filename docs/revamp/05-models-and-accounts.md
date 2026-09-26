# 05 — Models & accounts

## 1. Two ports, not one

Your requirement is "don't depend on one or two LLM providers, and let me use my Claude
subscription." Those two need different shapes, so there are two ports:

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
- **Context budget:** each turn is assembled within `context_budget = model.max_context -
  max_output - safety margin`. History is **windowed from the newest turn backwards**. Large old tool
  results are replaced by a one-line stub ("[tool result omitted: 14 KB]"). If that still doesn't
  fit, the oldest turns are dropped. Summarisation of dropped turns is post-v1. Token counts use the
  provider's counter when available, otherwise a tokenizer estimate plus a 10% margin.

**Model roles** in config: `main` (conversation + tools) and optional `vision` (screenshots, if `main`
lacks vision). Keep it to these two; add roles only when a real need appears.

## 3. The Claude subscription: what is and isn't allowed

This needs to be said plainly, because building on the wrong assumption could get your Claude account
banned.

- Anthropic's usage policy (updated Feb 2026) says that **using OAuth tokens obtained through Claude
  Free, Pro or Max accounts in any other product, tool or service — including the Agent SDK — is not
  permitted** and violates the Consumer Terms. Subscription OAuth is meant for Claude Code and
  Claude.ai. Anthropic began blocking subscription OAuth in third-party clients in Jan 2026.
- Products built on Claude are expected to use **API keys** (Claude Console or a supported cloud
  provider).
- Running the **official Claude Code binary** (including headless `claude -p` and the Agent SDK, which
  drives that binary) is a first-party path. In June 2026 Anthropic announced that this programmatic
  usage would move to a separate monthly credit pool, then **paused that change**, saying programmatic
  usage keeps working with subscriptions for now and that notice would come before any future change.
  This area has moved several times in 2026.

**So the design is:**

1. **Supported Claude path = Anthropic API key**, through the `anthropic` ChatModel adapter. It is
   fully featured and has no policy risk.
2. **Experimental `claude_code` AgentBackend, off by default**, for personal use:
   - It uses the Python **Claude Agent SDK**, which runs the **user's own installed Claude Code**
     that *the user logged into themselves* (`claude` → `/login`). Our app never sees, stores or
     forwards a token and never shows a "log in with Claude" screen.
   - Our tools are exposed to it as an in-process MCP server, and our permission engine is plugged in
     through the SDK's tool-permission callback. Our permission rules still decide.
   - **Claude Code's own built-in tools (Bash, Read, Edit, Write, WebFetch, …) must be disabled**
     (an allow-list containing only our MCP tools). Otherwise it could act on the machine outside our
     permission engine. A contract test asserts that the bridge offers no tool we didn't register.
   - It has its own session and memory. We pass our persona and history in explicitly, and we don't
     rely on Claude Code's project files (`CLAUDE.md` etc.) because the working directory is an empty
     app-owned folder.
   - The Configure panel shows its status (CLI found / logged in / version) and a short notice that
     subscription use by programmatic clients is governed by Anthropic's current terms.
   - **Before any public release or demo, re-check Anthropic's terms.** If they don't allow it, the
     adapter ships disabled or is removed. It is one plugin, so removing it is trivial (temporal
     composability again).
3. Your wish "limit subscription login to Claude only for now" is naturally satisfied: no other
   subscription bridges exist, and every other provider is API key only.

**Open question 2 (please confirm):** API key as the supported Claude path, with the Claude Code
bridge as an experimental plugin.

## 4. Identity and "Claude login mandatory"

Because of §3, the app **cannot use a Claude account as its identity** or to sync settings with the
extension. The app has **no accounts at all** in v1: it is local-first, and config lives in files on
your machine. The future extension pairs with the desktop core using a one-time code (see 10).
**Open question 3.**

## 5. Secrets

- API keys are stored in the **OS keychain** (`keyring`: Windows Credential Manager, macOS Keychain,
  Secret Service on Linux) under the service name `ai-avatar`. Config files hold only a reference:
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
- Token usage is recorded per turn in the event log and shown in Conversations. An optional
  daily-spend warning uses a price table (a JSON file you can edit).
