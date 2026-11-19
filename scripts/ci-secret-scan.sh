#!/usr/bin/env bash
# GitHub-hosted ubuntu runner; version and archive digest are intentionally pinned.
set -euo pipefail
case "${1:-}" in
  sources|dist) scan_target="$1" ;;
  *) echo 'Usage: ci-secret-scan.sh sources|dist' >&2; exit 2 ;;
esac
scanner_dir="$(mktemp -d)"
trap 'rm -rf "$scanner_dir"' EXIT
curl --fail --silent --show-error --location --retry 3 \
  https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_x64.tar.gz \
  --output "$scanner_dir/gitleaks.tar.gz"
echo "551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb  $scanner_dir/gitleaks.tar.gz" | sha256sum --check --strict
tar -xzf "$scanner_dir/gitleaks.tar.gz" -C "$scanner_dir"
if [[ "$scan_target" == sources ]]; then
  "$scanner_dir/gitleaks" git . --log-opts="--all" --redact --no-banner
  "$scanner_dir/gitleaks" dir . --redact --no-banner
else
  "$scanner_dir/gitleaks" dir dist --redact --no-banner
fi
