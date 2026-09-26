#!/usr/bin/env bash
set -euo pipefail

repo_dir=$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)
image="svara-tauri-spike:ubuntu24"
runtime_dir="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
cargo_cache="/tmp/svara-t05-cargo-$(id -u)"
target_cache="/tmp/svara-t05-target-$(id -u)"

if [[ "${GDK_BACKEND:-}" != "x11" ]]; then
  printf 'This spike must use the X11 backend. Re-launching the shell with GDK_BACKEND=x11.\n'
fi

if ! docker image inspect "$image" >/dev/null 2>&1; then
  printf 'Missing %s; run: pnpm --filter @svara/desktop spike:tauri:build-image\n' "$image" >&2
  exit 2
fi

if [[ -z "${DISPLAY:-}" || -z "${XAUTHORITY:-}" ]]; then
  printf 'DISPLAY and XAUTHORITY must point to the active local X11/XWayland session.\n' >&2
  exit 2
fi

mkdir -p "$cargo_cache" "$target_cache"

corepack pnpm --dir "$repo_dir/apps/desktop" build
corepack pnpm --dir "$repo_dir/apps/desktop" exec vite preview \
  --host 0.0.0.0 --port 1420 --strictPort &
vite_pid=$!
trap 'kill "$vite_pid" 2>/dev/null || true' EXIT INT TERM

for _ in $(seq 1 40); do
  if curl --silent --fail http://127.0.0.1:1420 >/dev/null; then
    break
  fi
  sleep 0.25
done

docker_args=(
  run --rm --network host
  --user "$(id -u):$(id -g)"
  --env DISPLAY
  --env GDK_BACKEND=x11
  --env XAUTHORITY=/tmp/svara-xauthority
  --env XDG_RUNTIME_DIR="$runtime_dir"
  --env RUSTUP_HOME=/opt/rustup
  --env CARGO_HOME=/tmp/svara-cargo
  --env CARGO_TARGET_DIR=/tmp/svara-target
  --volume "$repo_dir:/workspace"
  --volume "$XAUTHORITY:/tmp/svara-xauthority:ro"
  --volume "$cargo_cache:/tmp/svara-cargo"
  --volume "$target_cache:/tmp/svara-target"
  --volume /tmp/.X11-unix:/tmp/.X11-unix
)

if [[ -S "$runtime_dir/bus" ]]; then
  docker_args+=(--env "DBUS_SESSION_BUS_ADDRESS=unix:path=$runtime_dir/bus" --volume "$runtime_dir/bus:$runtime_dir/bus")
fi
if [[ -d "$runtime_dir/pulse" ]]; then
  docker_args+=(--volume "$runtime_dir/pulse:$runtime_dir/pulse")
fi
if [[ -e /dev/dri ]]; then
  docker_args+=(--device /dev/dri)
fi

docker "${docker_args[@]}" "$image" \
  cargo run --release --manifest-path apps/desktop/spikes/tauri/src-tauri/Cargo.toml
