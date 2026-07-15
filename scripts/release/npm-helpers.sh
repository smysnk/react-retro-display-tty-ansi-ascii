#!/usr/bin/env bash

set -euo pipefail

run_npm_no_workspace() {
  env \
    -u NPM_CONFIG_WORKSPACE \
    -u npm_config_workspace \
    -u NPM_CONFIG_WORKSPACES \
    -u npm_config_workspaces \
    npm "$@"
}

verify_npm_oidc_environment() {
  if [[ -n "${NPM_TOKEN:-}" || -n "${NODE_AUTH_TOKEN:-}" ]]; then
    echo "Refusing to publish with a persistent npm token; trusted publishing must use GitHub OIDC." >&2
    exit 1
  fi

  if [[ -z "${ACTIONS_ID_TOKEN_REQUEST_URL:-}" || -z "${ACTIONS_ID_TOKEN_REQUEST_TOKEN:-}" ]]; then
    echo "GitHub OIDC is unavailable. Ensure the workflow uses a GitHub-hosted runner with id-token: write." >&2
    exit 1
  fi
}

check_npm_package_visibility() {
  local package_name="$1"
  if ! run_npm_no_workspace view "$package_name" name >/dev/null 2>&1; then
    echo "npm preflight: package '${package_name}' not readable yet (may be first publish)." >&2
  fi
}
