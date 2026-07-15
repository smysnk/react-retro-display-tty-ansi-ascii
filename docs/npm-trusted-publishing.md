# npm trusted publishing

This repository publishes `react-retro-display-tty-ansi-ascii` from GitHub Actions with npm trusted publishing. The release does not use a persistent npm access token. GitHub supplies an OIDC identity to npm, and npm exchanges it for a short-lived credential during `npm publish`.

## One-time npm configuration

An npm package owner must configure the trusted publisher at [npmjs.com](https://www.npmjs.com/package/react-retro-display-tty-ansi-ascii/access):

- Publisher: GitHub Actions
- Organization or user: `smysnk`
- Repository: `react-retro-display-tty-ansi-ascii`
- Workflow filename: `cicd.yml`
- Environment: leave empty
- Allowed action: `npm publish`

Enter only the workflow filename, not `.github/workflows/cicd.yml`. These values are case-sensitive.

The workflow runs on a GitHub-hosted runner, grants `id-token: write`, uses Node 24 and npm 11.5.1 or newer, and publishes without `NPM_TOKEN`. Do not add an npm authentication preflight such as `npm whoami`: OIDC authentication is performed only for the publish operation.

## Completing the migration

1. Configure the trusted publisher before the next release from `main`.
2. Confirm that the workflow publishes the new version and that npm shows its provenance attestation.
3. In the package's npm settings, set Publishing access to **Require two-factor authentication and disallow tokens**.
4. Revoke the old npm automation token and delete the repository's `NPM_TOKEN` Actions secret.

Do not disable token publishing until one trusted publish has succeeded. The OIDC identity is tied to the canonical GitHub repository and the `cicd.yml` workflow filename; renaming either requires updating the npm trusted-publisher settings.
