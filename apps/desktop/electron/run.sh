#!/usr/bin/env bash
set -euo pipefail

repo_dir=$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)
desktop_dir="$repo_dir/apps/desktop"

corepack pnpm --dir "$desktop_dir" build
setsid corepack pnpm --dir "$desktop_dir" exec vite preview \
  --host 0.0.0.0 --port 1420 --strictPort &
preview_pid=$!

cleanup() {
  kill -- "-$preview_pid" 2>/dev/null || true
  wait "$preview_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

for _ in $(seq 1 40); do
  if curl --silent --fail http://127.0.0.1:1420 >/dev/null; then
    break
  fi
  sleep 0.25
done

if ! curl --silent --fail http://127.0.0.1:1420 >/dev/null; then
  printf 'The production preview server did not become ready.\n' >&2
  exit 2
fi

export ELECTRON_OZONE_PLATFORM_HINT=x11
export SVARA_SPIKE_URL=http://127.0.0.1:1420
corepack pnpm --dir "$desktop_dir" exec electron \
  "$desktop_dir/electron/main.cjs"
