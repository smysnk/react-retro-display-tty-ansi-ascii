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

configure_npm_auth_token() {
  local token="$1"
  if [[ -z "$token" ]]; then
    echo "Missing NPM token" >&2
    exit 1
  fi

  run_npm_no_workspace config set //registry.npmjs.org/:_authToken="${token}"
}

verify_npm_auth() {
  if ! run_npm_no_workspace whoami >/dev/null 2>&1; then
    echo "npm auth preflight failed (whoami). Check NPM_TOKEN scope/validity." >&2
    exit 1
  fi
}

check_npm_package_visibility() {
  local package_name="$1"
  if ! run_npm_no_workspace view "$package_name" name >/dev/null 2>&1; then
    echo "npm preflight: package '${package_name}' not readable yet (may be first publish)." >&2
  fi
}
