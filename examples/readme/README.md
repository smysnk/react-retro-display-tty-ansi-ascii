# README Example Sources

These files are the consumer-facing source behind the examples documented in the repository
README. Every TypeScript example imports only the package's public entry point and stylesheet.

From the repository root, verify every example with:

```bash
yarn examples:typecheck
yarn readme:examples:check
```

Small examples are synchronized directly into `README.md`. Larger examples keep a concise entry
point in the README and link here for their complete implementation, styles, assets, and runtime
requirements.
