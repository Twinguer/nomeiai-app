#!/usr/bin/env bash
set -euo pipefail

# Build the same source commit for HML or PRD with environment-specific public values.
# Usage: deploy/build-image.sh hml|prd COMMIT_SHA /absolute/path/to/build.env

if [[ $# -ne 3 ]]; then
  echo "Usage: $0 hml|prd COMMIT_SHA /absolute/path/to/build.env" >&2
  exit 2
fi

target=$1
expected_sha=$2
env_file=$3
repo_dir=$(cd "$(dirname "$0")/.." && pwd)
cd "$repo_dir"

actual_sha=$(git rev-parse HEAD)
if [[ "$actual_sha" != "$expected_sha" ]]; then
  echo "Checkout is $actual_sha; expected $expected_sha" >&2
  exit 1
fi
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Build requires a clean checkout" >&2
  exit 1
fi
if [[ ! -f "$env_file" ]]; then
  echo "Build environment file not found: $env_file" >&2
  exit 1
fi

# The operator owns this file. It is deliberately outside Git.
set -a
# shellcheck disable=SC1090
source "$env_file"
set +a

case "$target" in
  hml)
    url=${HML_SUPABASE_PUBLIC_URL:-}
    anon_key=${HML_SUPABASE_ANON_KEY:-}
    case "$url" in
      http://192.168.0.241:8010|https://api-hml.nomeiai.com.br) ;;
      *) echo "Unexpected HML API URL: $url" >&2; exit 1 ;;
    esac
    ;;
  prd)
    url=${VITE_SUPABASE_URL:-}
    anon_key=${VITE_SUPABASE_ANON_KEY:-}
    if [[ "$url" != "https://api.nomeiai.com.br" ]]; then
      echo "Unexpected PRD API URL: $url" >&2
      exit 1
    fi
    ;;
  *)
    echo "Target must be hml or prd" >&2
    exit 2
    ;;
esac

site_key=${VITE_TURNSTILE_SITE_KEY:-}
if [[ -z "$anon_key" || -z "$site_key" ]]; then
  echo "Build environment lacks the public API key or Turnstile site key" >&2
  exit 1
fi

image="nomeiai-app:${target}-${actual_sha:0:12}"
docker build \
  --build-arg "VITE_SUPABASE_URL=$url" \
  --build-arg "VITE_SUPABASE_ANON_KEY=$anon_key" \
  --build-arg "VITE_TURNSTILE_SITE_KEY=$site_key" \
  -t "$image" .

docker run --rm --entrypoint test "$image" -s /usr/share/nginx/html/index.html
echo "$image"
