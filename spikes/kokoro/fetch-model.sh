#!/usr/bin/env bash
set -euo pipefail

spike_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
model_dir="$spike_dir/.cache/model"
revision="dd4401a9add81ac692d20e240d22ec9dda82cc29"
base_url="https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX-timestamped/resolve/$revision"

mkdir -p "$model_dir"

fetch() {
  local relative_path=$1
  local output_name=$2
  local expected_sha256=$3
  local output_path="$model_dir/$output_name"

  if [[ ! -f "$output_path" ]] || ! printf '%s  %s\n' "$expected_sha256" "$output_path" | sha256sum --check --status; then
    curl --fail --location --retry 3 --output "$output_path" "$base_url/$relative_path"
  fi
  printf '%s  %s\n' "$expected_sha256" "$output_path" | sha256sum --check --status
}

fetch "onnx/model_fp16.onnx" "model_fp16.onnx" \
  "220724d5c5e0cc01be30f38faa6cf0c895a7cde6e7773e91db2973c8c7e5123c"
fetch "voices/af_heart.bin" "af_heart.bin" \
  "d583ccff3cdca2f7fae535cb998ac07e9fcb90f09737b9a41fa2734ec44a8f0b"
fetch "tokenizer.json" "tokenizer.json" \
  "77a02c8e164413299b4b4c403b14f8e0e1c1b727db4d46a09d6327b861060a34"

printf 'Pinned Kokoro spike assets are ready in %s\n' "$model_dir"
