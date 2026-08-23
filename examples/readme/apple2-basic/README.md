# Apple II BASIC And DOS 3.3

This showcase is intentionally documented as a complete multi-file implementation rather than
inlined into the root README.

Required source ownership:

```text
src/stories/Apple2Basic.stories.tsx
src/stories/apple2-basic/apple2-basic-shell-session.ts
src/stories/apple2-basic/apple2-basic-parser.ts
src/stories/apple2-basic/apple2-basic-interpreter.ts
```

- `Apple2Basic.stories.tsx` wires keyboard bytes and `RetroScreen` to the session.
- `apple2-basic-shell-session.ts` owns input, line editing, transcript state, prompts, and runner
  scheduling.
- `apple2-basic-parser.ts` parses immediate commands, program lines, statements, and expressions.
- `apple2-basic-interpreter.ts` executes stored programs and resumable `INPUT` flows.

Run the complete implementation with:

```bash
yarn storybook
```

Open either the Apple II BASIC or Apple II DOS 3.3 story. This example remains Storybook-hosted
because the emulated userland runtime is a documentation showcase rather than a package API.
