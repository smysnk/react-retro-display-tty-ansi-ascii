#!/usr/bin/env bash

set -euo pipefail

THIS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${THIS_DIR}/../.." && pwd)"
source "${THIS_DIR}/npm-helpers.sh"

NPM_CACHE_DIR="${NPM_CONFIG_CACHE:-$ROOT_DIR/.test-results/npm-cache}"
NPM_RELEASE_MODE="${NPM_PUBLISH:-0}"
NPM_PROVENANCE_MODE="${NPM_PROVENANCE:-0}"

step() {
  echo "[npm-release] $1"
}

step "1/6 Preflight required tools"
if ! command -v npm >/dev/null 2>&1; then
  echo "Missing npm in PATH" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Missing node in PATH" >&2
  exit 1
fi

step "2/6 Prepare npm cache"
mkdir -p "$NPM_CACHE_DIR"
export NPM_CONFIG_CACHE="$NPM_CACHE_DIR"

step "3/6 Read package manifest"
manifest_path="${ROOT_DIR}/package.json"
pkg_name="$(node -p "require(process.argv[1]).name" "$manifest_path")"
pkg_version="$(node -p "require(process.argv[1]).version" "$manifest_path")"
pkg_private="$(node -p "require(process.argv[1]).private === true ? 'true' : 'false'" "$manifest_path")"
pkg_repository_url="$(node -p "const repository = require(process.argv[1]).repository; if (!repository) { '' } else if (typeof repository === 'string') { repository } else { repository.url || '' }" "$manifest_path")"

if [[ "$pkg_private" == "true" ]]; then
  echo "Package ${pkg_name}@${pkg_version} is private and cannot be published." >&2
  exit 1
fi

if [[ -z "$pkg_repository_url" ]]; then
  echo "Package ${pkg_name}@${pkg_version} is missing package.json repository.url, which npm provenance requires." >&2
  exit 1
fi

if [[ "$NPM_PROVENANCE_MODE" == "1" && -n "${GITHUB_REPOSITORY:-}" ]]; then
  expected_repository_url="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY}"
  if [[ "$pkg_repository_url" != "$expected_repository_url" ]]; then
    echo "package.json repository.url must match ${expected_repository_url} when provenance is enabled; got: ${pkg_repository_url}" >&2
    exit 1
  fi
fi

step "4/6 Validate npm package tarball"
if [[ ! -d "${ROOT_DIR}/dist" ]]; then
  echo "Missing dist/ output. Run yarn build before publishing." >&2
  exit 1
fi

(
  cd "$ROOT_DIR"
  run_npm_no_workspace pack --dry-run --ignore-scripts >/dev/null
)

if [[ "$NPM_RELEASE_MODE" == "1" ]]; then
  step "5/6 Authenticate and preflight npm registry checks"
  configure_npm_auth_token "${NPM_TOKEN:-}"
  verify_npm_auth
  check_npm_package_visibility "$pkg_name"

  step "6/6 Publish npm package"
  publish_args=(publish --ignore-scripts --access public)
  if [[ "$NPM_PROVENANCE_MODE" == "1" ]]; then
    publish_args+=(--provenance)
  fi

  (
    cd "$ROOT_DIR"
    run_npm_no_workspace "${publish_args[@]}"
  )
else
  step "5/6 Publish preflight skipped (NPM_PUBLISH!=1)"
  step "6/6 Publish skipped; release validation complete"
fi
