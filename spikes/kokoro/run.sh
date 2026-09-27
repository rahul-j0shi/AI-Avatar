#!/usr/bin/env bash
set -euo pipefail

repo_dir=$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)
spike_dir="$repo_dir/spikes/kokoro"
python_bin=${SVARA_SPIKE_PYTHON:-}

if [[ -z "$python_bin" ]]; then
  python_bin="$spike_dir/.cache/venv/bin/python"
  if [[ ! -x "$python_bin" ]]; then
    bootstrap_python=${SVARA_PYTHON:-python3.14}
    "$bootstrap_python" -m venv "$spike_dir/.cache/venv"
    "$python_bin" -m pip install --disable-pip-version-check -r "$spike_dir/requirements.txt"
  fi
fi

if [[ -n "${ESPEAK_NG:-}" ]]; then
  espeak_ng=$ESPEAK_NG
else
  espeak_ng=$(command -v espeak-ng || true)
fi
if [[ -z "$espeak_ng" ]] || [[ ! -x "$espeak_ng" ]]; then
  printf 'espeak-ng is required. Install it with: sudo apt install espeak-ng\n' >&2
  exit 2
fi

"$spike_dir/fetch-model.sh"
PYTHONPATH="$spike_dir/src" "$python_bin" -m unittest discover -s "$spike_dir/tests"
"$python_bin" "$spike_dir/src/kokoro_spike.py" \
  --espeak "$espeak_ng" \
  --model-dir "$spike_dir/.cache/model" \
  --output-dir "$spike_dir/.cache/output" \
  --publish-dir "$repo_dir/apps/desktop/public/spike-assets/kokoro" \
  --sentences "$spike_dir/sentences.txt"
