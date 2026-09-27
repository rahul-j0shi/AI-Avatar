#!/usr/bin/env bash
set -euo pipefail

if [[ ${1:-} != --allow-microphone ]]; then
  printf 'This opt-in probe activates the microphone briefly; audio is counted and discarded.\n' >&2
  printf 'Run with --allow-microphone only after consenting. No settings are installed.\n' >&2
  exit 2
fi

if ! command -v pw-cli >/dev/null || ! command -v pw-record >/dev/null; then
  printf 'pw-cli and pw-record are required (Ubuntu package: pipewire-bin).\n' >&2
  exit 2
fi

probe_dir=$(mktemp -d /tmp/svara-echo-cancel.XXXXXX)
source_name="svara-t010-source-${probe_dir##*.}"
control_fifo="$probe_dir/control"
cli_log="$probe_dir/pw-cli.log"
mkfifo "$control_fifo"

cli_pid=
control_fd=
cleanup() {
  if [[ -n "$control_fd" ]]; then
    exec {control_fd}>&-
  fi
  if [[ -n "$cli_pid" ]] && kill -0 "$cli_pid" 2>/dev/null; then
    kill "$cli_pid" 2>/dev/null || true
    wait "$cli_pid" 2>/dev/null || true
  fi
  rm -r -- "$probe_dir"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

pw-cli <"$control_fifo" >"$cli_log" 2>&1 &
cli_pid=$!
exec {control_fd}>"$control_fifo"

printf '%s\n' \
  "load-module libpipewire-module-echo-cancel { library.name = aec/libspa-aec-webrtc monitor.mode = true capture.props = { node.name = \"${source_name}-capture\" } source.props = { node.name = \"${source_name}\" node.description = \"Svara T0.10 temporary source\" } }" \
  >&"$control_fd"

source_ready=false
for _ in $(seq 1 40); do
  if pw-cli ls Node | grep -F "node.name = \"${source_name}\"" >/dev/null; then
    source_ready=true
    break
  fi
  sleep 0.1
done
if [[ "$source_ready" != true ]]; then
  sed -n '1,160p' "$cli_log" >&2
  printf 'The temporary source did not appear.\n' >&2
  exit 1
fi

graph=$(wpctl status)
if ! grep -q 'Svara T0.10 temporary source' <<<"$graph"; then
  printf 'WirePlumber did not publish the echo-cancelled source.\n' >&2
  exit 1
fi

set +e
timeout --kill-after=2s --signal=INT 2s pw-record \
  --target "$source_name" --rate 16000 --channels 1 --format s16 - \
  2>"$probe_dir/pw-record.log" | wc -c >"$probe_dir/byte-count"
record_status=${PIPESTATUS[0]}
set -e
if [[ $record_status -ne 124 && $record_status -ne 130 ]]; then
  sed -n '1,80p' "$probe_dir/pw-record.log" >&2
  printf 'pw-record exited unexpectedly with status %s.\n' "$record_status" >&2
  exit 1
fi

byte_count=$(<"$probe_dir/byte-count")
if (( byte_count < 3200 )); then
  printf 'Capture inconclusive: only %s bytes received.\n' "$byte_count" >&2
  exit 1
fi
printf 'Transport only: received %s bytes; acoustic echo cancellation is NOT verified.\n' "$byte_count"
printf 'The module is temporary and will be removed with this probe process.\n'
