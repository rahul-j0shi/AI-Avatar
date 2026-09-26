# 10 — Next: browser extension (planned, not built in v1)

This document exists so anyone reading the repo can see what comes after desktop v1, and so v1 keeps
the right doors open.

## 1. The idea

The same assistant, with the same persona, skills, providers, permissions and conversation history,
becomes available **inside the browser**. It shows as an avatar overlay or side panel and can
automate the browser (read pages, navigate, click, fill forms), similar to Claude in Chrome.

## 2. Two modes

| Mode | How it works | When |
|------|--------------|------|
| **Paired (first)** | The extension connects to the **desktop core** running on the same machine and is just another *surface* | Desktop app installed |
| **Standalone (later)** | The extension runs its own lightweight core in its service worker: TS ports of the provider adapters, no local STT/TTS (cloud or Web Speech only) | No desktop app |

Paired mode comes first because it reuses 100% of the core.

## 3. How paired mode plugs into v1's architecture

1. **Transport:** Chrome native messaging (a tiny native host installed by the desktop app) bridges
   to the core's WebSocket. Pages can't reach `localhost` directly, and native messaging proves the
   caller is our extension ID.
2. **Pairing:** on first connect the avatar shows a 6-digit code; you type it in the extension. The
   core stores a per-extension key. This replaces "Claude login mandatory" (see 05 §4).
3. **Surface tools:** the extension sends `tools.register` with browser tools (`browser.tabs.list`,
   `browser.navigate`, `browser.read_page`, `browser.click`, `browser.type`, `browser.screenshot`).
   The core mounts them as a plugin **tied to that connection's fiber**. When the extension
   disconnects, the tools disappear (temporal composability in action). Tool calls are forwarded as
   `tool.call` → `tool.result` messages.
4. **Permissions:** browser capabilities join the same `permissions.json` (e.g.
   `browser.navigate(https://*.github.com/*)`). Following Claude in Chrome's model: per-site grants,
   ASK before actions on new sites, a high-risk site blocklist (banking, etc.) by default, and page
   content always treated as untrusted (the taint rule from 06 §5).
5. **Avatar in the page:** `packages/avatar` renders in a shadow-DOM overlay or the side panel. The
   same `PerformancePlayer` and the same protocol messages.
6. **Which surface talks:** if both the desktop avatar and the in-page overlay are active, the most
   recently focused one gets voice and performance output (01 §4 routing).
7. **Browsers:** Chrome and Edge first (same Manifest V3 and native-messaging APIs). Firefox needs a
   separate native-messaging manifest and is later. The desktop installer registers the
   native-messaging host for each installed browser.
8. **Configuration:** the extension's own settings page is minimal and links to *Configure* in the
   desktop app. Everything is still configured in one place, as you wanted.

## 4. What v1 must do to keep this door open (already in the plan)

- The core owns all logic; surfaces are thin (01 §1).
- Protocol has `hello.surface`, `tools.register`, `tool.call/result` reserved from day one (01 §4).
- `packages/avatar` has no React/Tauri dependencies (01 §6).
- Permissions are capability strings, not hard-coded desktop concepts (06 §3).
- `apps/extension/README.md` exists with a short version of this document and a link here.

## 5. Rough milestones (post v1)

1. Native host + pairing + `hello` from a Manifest V3 extension; text chat in the side panel.
2. Read-only browser tools (`tabs.list`, `read_page`, `screenshot`) with per-site grants.
3. Action tools (navigate, click, type) with ASK and the blocklist.
4. In-page avatar overlay with voice (mic via the extension's offscreen document).
5. Standalone mode investigation.
