#!/usr/bin/env bash
set -euo pipefail

desktop_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
asset_dir="$desktop_dir/public/spike-assets"
asset_path="$asset_dir/avatar.vrm"
expected_sha256="12c2b97e95e700783a6a550dc0eee2d7880aeedccef9ae67bc4c5a2f0f2631a2"
source_url="https://raw.githubusercontent.com/pixiv/three-vrm/1b4fc0cc7ef39a49d62bb7a66dcfeca8f65316f7/packages/three-vrm/examples/models/VRM1_Constraint_Twist_Sample.vrm"

mkdir -p "$asset_dir"
if [[ $# -gt 0 ]]; then
  install -m 0644 "$1" "$asset_path"
else
  curl --fail --location --output "$asset_path" "$source_url"
fi
printf '%s  %s\n' "$expected_sha256" "$asset_path" | sha256sum --check --status
printf 'Downloaded the pixiv three-vrm test model to %s\n' "$asset_path"
printf 'The ignored spike copy can be removed after testing; it is not a production asset.\n'
