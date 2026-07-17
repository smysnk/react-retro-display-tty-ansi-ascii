# ANSI oracle tooling

This directory contains test-only references for the ANSI byte playback
migration. None of these files are included in the production browser bundle.

The source lock pins three complementary references:

- AnsiLove/C defines the native command-line contract.
- libansilove defines native static ANSI parsing and rasterization.
- Ansilove.js defines browser byte/baud playback behavior.

Build and verify the controlled native oracle:

```bash
yarn oracle:ansilove:build
yarn oracle:ansilove:verify
```

Force a clean source checkout and rebuild:

```bash
node scripts/ansilove/build-native-oracle.mjs --clean
```

Run the focused contracts and parity tests:

```bash
yarn test:ansilove:native
yarn test:ansilove:focused-parity
```

Generated native source, builds, binaries, and platform-specific hashes live
under `.tmp/ansilove-native`. The checked-in lock contains portable source
identity; the generated build manifest binds that source identity to the exact
executable and shared-library hashes used by the current parity run.
