#!/usr/bin/env bash
set -euo pipefail

repo_dir=$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)
desktop_dir="$repo_dir/apps/desktop"
hint_dir=""
preview_pid=""

cleanup() {
  if [[ -n "$preview_pid" ]]; then
    kill -- "-$preview_pid" 2>/dev/null || true
    wait "$preview_pid" 2>/dev/null || true
  fi
  if [[ -n "$hint_dir" ]]; then
    rm -f -- "$hint_dir/window-input-hint"
    rmdir "$hint_dir"
  fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if [[ "${SVARA_SPIKE_FOCUS_MODE:-managed}" == managed-hints ]]; then
  hint_dir=$(mktemp -d /tmp/svara-input-hint.XXXXXX)
  export SVARA_SPIKE_INPUT_HINT_HELPER="$hint_dir/window-input-hint"
  if ! cc -Wall -Wextra -Werror "$repo_dir/spikes/ubuntu-integration/window_input_hint.c" \
      -o "$SVARA_SPIKE_INPUT_HINT_HELPER" -lX11; then
    exit 2
  fi
fi

corepack pnpm --dir "$desktop_dir" build
if curl --max-time 1 --silent --fail http://127.0.0.1:1420 >/dev/null; then
  printf 'Port 1420 is already serving content; stop that server before running this probe.\n' >&2
  exit 2
fi
setsid corepack pnpm --dir "$desktop_dir" exec vite preview \
  --host 127.0.0.1 --port 1420 --strictPort &
preview_pid=$!

for _ in $(seq 1 40); do
  if ! kill -0 "$preview_pid" 2>/dev/null; then
    printf 'Preview process exited before readiness.\n' >&2
    exit 2
  fi
  if curl --max-time 1 --silent --fail http://127.0.0.1:1420 >/dev/null; then
    break
  fi
  sleep 0.25
done

if ! curl --max-time 1 --silent --fail http://127.0.0.1:1420 >/dev/null; then
  printf 'The production preview server did not become ready.\n' >&2
  exit 2
fi

export ELECTRON_OZONE_PLATFORM_HINT=x11
export SVARA_SPIKE_URL=http://127.0.0.1:1420
corepack pnpm --dir "$desktop_dir" exec electron \
  "$desktop_dir/electron/main.cjs" "$@"
