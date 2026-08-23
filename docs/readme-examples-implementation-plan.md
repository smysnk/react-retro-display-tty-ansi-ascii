# README Examples Implementation Plan

Status: Implemented

Last updated: 2026-08-22

## Implementation Record

The plan was executed with these concrete outcomes:

- `examples/readme/` now contains 16 type-checked public-import source modules.
- Eleven compact examples are synchronized into `README.md` from canonical files.
- Matrix Code Rain and Midjourney Vortex moved out of Storybook-only modules into canonical
  example sources consumed by Storybook.
- Quiet Output, Signal Intercept, Editable Drafting, Terminal Output, and Prompt Interaction
  captures now render the same canonical components shown in the README.
- The light/dark typing engine and Bad Apple ANSI loading path are shared with their canonical
  examples while Storybook retains capture-only shells and automation.
- Matrix, Midjourney, Light/Dark, Auto Resize, ANSI Art, Live TTY, and Apple II have complete
  multi-file source maps and requirements.
- `scripts/sync-readme-examples.mjs` owns deterministic README code insertion.
- `scripts/check-readme-examples.mjs` checks synchronization, public imports, stylesheet imports,
  repository-relative links, example labels, and required full-source links.
- Package scripts and CI now build the package, type-check examples, and check README examples
  before the existing conformance and browser gates.
- `README Examples` Storybook stories and `e2e/readme-examples.test.mjs` render all 15 browser-safe
  canonical examples through their public package imports.
- Browser-harness teardown is bounded so successful browser workers cannot hold CI open on a
  lingering page, browser, or static-server close.

Scripted mouse movement, automated typing into editable fields, and deterministic capture timing
remain Storybook presentation choreography. The README calls out those boundaries rather than
presenting the choreography as application requirements.

## Objective

Make every example in `README.md` honest about what a consumer must implement.

Every media-backed demo must either:

1. include complete, copy-pasteable source in the README; or
2. show a complete runnable entry point and link directly to all remaining source, assets, fonts,
   server code, and setup instructions required to reproduce the demo.

Small API illustrations may remain short, but they must be labeled as fragments and must not be
presented as the implementation behind a screenshot or video when they cannot reproduce it.

## Problem Statement

The README currently mixes three different kinds of code without consistently distinguishing
them:

- complete components;
- partial API illustrations; and
- abbreviated versions of much larger Storybook demonstrations.

This is most visible when a capture shows behavior that the adjacent code cannot produce. Current
examples include a Matrix Code Rain screen without the animation logic, an Auto Resize example
that calls an undefined `redrawBorderAndMetrics`, and ANSI playback fragments that reference an
undefined `asset`. Some smaller examples also omit package or stylesheet imports, use a
module-global controller, or omit effect cleanup.

The Signal Intercept section has been expanded to show its actual four-message sequence. That is
appropriate for a compact, single-file example, but applying the same inline treatment to Matrix
Code Rain, Midjourney Galaxy, Apple II BASIC, Bad Apple ANSI, and the TTY bridge would make the
README excessively long. Those demonstrations need complete linked example directories instead.

## Documentation Contract

README code blocks will use one of these explicit labels.

### Complete example

A complete example must include or directly identify:

- all React and package imports;
- the shared package stylesheet;
- component-owned state and controller construction;
- effects, timers, subscriptions, and cleanup;
- helper functions referenced by the component;
- required display props and styles;
- required fonts and assets;
- browser and server halves when a transport is involved; and
- any package installation or runtime command beyond the standard getting-started instructions.

A reader should be able to paste a single-file complete example into an existing React project
that has the package installed and have it work without discovering undefined identifiers.

### Complete multi-file example

A multi-file example may show only its runnable entry component inline when the full example is
too large for the README. The section must also include:

- a repository-relative link to the example directory;
- a short file tree;
- a statement of what each required file owns;
- required assets and their licensing or attribution notes; and
- exact development and build commands.

The linked directory, not the Storybook presentation wrapper, is the canonical public example.

### API fragment

An API fragment may omit surrounding application code when it demonstrates one focused prop or
method. It must be introduced as an `API fragment` and may not claim to reproduce adjacent media.
Identifiers omitted for brevity must be obvious placeholders or linked to a complete example.

## Source-Of-Truth Architecture

Add a public-facing example tree:

```text
examples/
  readme/
    getting-started/
    touch-input/
    resizable-panel/
    light-dark-surfaces/
    quiet-output/
    signal-intercept/
    matrix-code-rain/
    editable-drafting/
    terminal-output/
    prompt-interaction/
    control-character-replay/
    auto-resize-probe/
    display-color-modes/
    ansi-art-playback/
```

Keep the existing `examples/node-tty-websocket-server/` example and add or link the matching
browser client required by the Live TTY WebSocket Bridge section.

The ownership boundaries will be:

| Location | Responsibility |
| --- | --- |
| `src/` | Shipped library behavior and reusable public APIs |
| `examples/readme/` | Canonical consumer-facing demo implementations |
| `examples/node-tty-websocket-server/` | Canonical server half of the TTY bridge |
| `src/stories/` | Storybook metadata, layout shells, capture wrappers, and controls |
| `README.md` | Generated full snippets, concise entry points, requirements, and source links |
| `docs/assets/` | Captures produced from the canonical examples |
| `scripts/sync-readme-examples.mjs` | README snippet synchronization |
| `scripts/check-readme-examples.mjs` | Completeness, synchronization, and link checks |

Where a README demo and Storybook capture show the same behavior, Storybook should import the
component from `examples/readme/` rather than retain a second implementation. Storybook-only
shells such as `StoryShell`, `Stage`, and `CaptureStage` stay in `src/stories/` and wrap the
canonical component without owning its behavior.

The example modules should import the package through its public package name and public
stylesheet export. Storybook and example test configuration may alias those imports to the local
source during development so Storybook does not depend on a previously built `dist/` directory.
That alias must be limited to local tooling; the displayed example source must remain identical
to what package consumers use.

## Inline Versus Linked Policy

Use these decision rules:

- Inline the complete source when the example is a single component, has no external binary
  asset or server, and remains approximately 100 lines or fewer.
- Show a complete entry component plus a full-source link when the implementation is longer than
  approximately 100 lines.
- Use a complete multi-file example whenever the behavior requires assets, custom CSS, fonts,
  parsers, workers, a server, or multiple runtime modules.
- Keep focused prop demonstrations as labeled API fragments.
- Never put an abbreviated implementation directly beneath media produced by different code
  unless the difference is explicitly stated and the complete source link is adjacent.

The line threshold is an editorial guardrail, not a correctness shortcut. A 40-line block with an
undefined helper is incomplete; a 110-line single component may still be clearer inline than a
fragmented presentation.

## README Example Inventory And Intended Treatment

| README area | Intended treatment | Canonical implementation or source seam |
| --- | --- | --- |
| Feature Tour | Media overview with links to the demonstrated examples | `src/stories/RetroScreenCapture.stories.tsx` becomes capture-only composition |
| Getting Started | Complete inline example | `examples/readme/getting-started/StatusCard.tsx` |
| Touch Input | Complete inline example | `examples/readme/touch-input/TouchDemo.tsx` |
| Display Padding | Labeled API fragments | Link back to Getting Started for full setup |
| Display Frame | Labeled API fragment | Link back to Getting Started for full setup |
| Resizable Panels | Complete inline example | Extract behavior from `src/stories/RetroScreen.stories.tsx` |
| Light And Dark Surfaces | Complete inline comparison component | Extract behavior from `src/stories/RetroScreen.stories.tsx` |
| Quiet Output | Complete inline example | `examples/readme/quiet-output/QuietOutput.tsx` |
| Signal Intercept | Complete inline example | Move current README component to `examples/readme/signal-intercept/WhiteRabbitSignal.tsx` |
| Matrix Code Rain | Complete entry component plus full-source link | Extract reusable behavior from `src/stories/matrix-code-rain.tsx` |
| Editable Drafting | Complete inline example | Extract the matching editor demo from `src/stories/RetroScreen.stories.tsx` |
| Terminal Output | Complete inline timed example | Extract the capture behavior from `src/stories/RetroScreen.stories.tsx` |
| Live TTY WebSocket Bridge | Complete multi-file example | Browser client plus `examples/node-tty-websocket-server/server.mjs` |
| Prompt Interaction | Complete inline example | Extract the matching prompt loop from `src/stories/RetroScreen.stories.tsx` |
| Apple II BASIC | Architecture summary and complete multi-file links | `src/stories/Apple2Basic.stories.tsx` and `src/stories/apple2-basic/` initially; consider a dedicated example directory |
| Display Buffer | Labeled API fragments | Link to Terminal Output for complete controller lifecycle |
| Auto Resize Probe | Complete entry component plus full-source link | Extract all redraw and geometry helpers from `src/stories/RetroScreen.stories.tsx` |
| Display Color Modes | Complete inline comparison or labeled fragment | Extract the media-producing comparison when kept beside the capture |
| Midjourney Galaxy | Complete entry component plus full-source link | Extract reusable behavior from `src/stories/midjourney-vortex.tsx` |
| Bad Apple ANSI | Complete multi-file example with loader and asset | `src/stories/bad-apple-ansi.ts`, player surface, and `src/stories/assets/bad-apple.ans` |
| Canvas Backend | Labeled API fragment | Link to the complete ANSI Art Playback example |
| Viewported ANSI Playback | Labeled API fragments or a dedicated runnable example | Reuse the ANSI Art Playback loader and state component |
| Control-Character Playback | Complete inline component with lifecycle | Extract the matching trace behavior from Storybook |

During the audit, confirm that each capture ID in `src/stories/RetroScreenCapture.stories.tsx`
resolves to the same canonical example linked from the README.

## README Synchronization Seam

Add stable markers around generated code:

````markdown
<!-- readme-example:signal-intercept source=examples/readme/signal-intercept/WhiteRabbitSignal.tsx start -->
```tsx
// synchronized source
```
<!-- readme-example:signal-intercept end -->
````

`scripts/sync-readme-examples.mjs` will:

1. parse the declared example source and marker;
2. extract either the complete file or an explicitly named exported region;
3. replace only the marked README content;
4. preserve all prose outside generated markers;
5. support `--check` without writing; and
6. fail on missing, duplicated, nested, or mismatched markers.

Prefer complete-file insertion for inline examples. If a linked multi-file example needs only its
entry component shown, use an explicit source region with checked start/end markers rather than a
line-number range that will drift.

Add package scripts similar to:

```json
{
  "readme:examples:sync": "node ./scripts/sync-readme-examples.mjs",
  "readme:examples:check": "node ./scripts/sync-readme-examples.mjs --check",
  "examples:typecheck": "tsc -p ./examples/readme/tsconfig.json --noEmit"
}
```

The exact TypeScript configuration should resolve the package name to current local source for
type checking while keeping public package imports in every example file.

## Completeness Checks

`scripts/check-readme-examples.mjs` should validate structural requirements that TypeScript alone
does not cover:

- every media-backed section declares a complete inline or complete linked example;
- all `source` and asset links are repository-relative and exist;
- no README link contains a developer-specific absolute filesystem path;
- complete example files import the package stylesheet unless an owning entry file is explicitly
  documented;
- every linked example directory contains a short `README.md` with install and run commands;
- generated markers are synchronized and idempotent; and
- no example source imports Storybook shells or private package modules.

TypeScript must catch undefined helpers such as `redrawBorderAndMetrics` and undefined values such
as `asset`. Focused runtime tests must catch lifecycle and browser behavior that static checks
cannot prove.

## Implementation Phases

### Phase 1: Audit And Contract

1. Enumerate every README code block, media item, Storybook capture ID, and source implementation.
2. Mark each block as complete inline, complete linked, or API fragment.
3. Record missing imports, helpers, assets, styles, cleanup, and runtime prerequisites.
4. Add the labels and editorial policy to the README without yet moving behavior.
5. Correct broken repository links, including developer-local absolute paths.

Acceptance evidence:

- a checked inventory covers every README code block and capture;
- every media-backed section has an assigned source owner; and
- no section is ambiguously labeled as complete.

### Phase 2: Example Infrastructure

1. Create `examples/readme/` and its focused TypeScript configuration.
2. Add local package-name and stylesheet resolution for example tests and Storybook.
3. Implement README synchronization and `--check` mode.
4. Add structural completeness and repository-relative link validation.
5. Wire the new commands into the existing CI workflow after the package build.

Acceptance evidence:

- an intentionally stale README block fails `readme:examples:check`;
- an undefined identifier fails `examples:typecheck`;
- synchronization is idempotent; and
- Storybook can load a canonical example without requiring a manually prepared stale build.

### Phase 3: Compact Examples

Move the small examples first:

1. Getting Started
2. Touch Input
3. Quiet Output
4. Signal Intercept
5. Editable Drafting
6. Terminal Output
7. Prompt Interaction
8. Control-Character Playback
9. Resizable Panel
10. Light And Dark Surfaces

For controller examples, construct the controller per component with lazy state, reset it before
use, list it in effect dependencies, and clean up timers or subscriptions. Keep the README source
identical to the canonical file.

Acceptance evidence:

- all compact examples type-check;
- each mounts without console errors;
- timed examples clear their timers on unmount; and
- their Storybook captures use the canonical components.

### Phase 4: Complex And Multi-File Examples

Implement complete linked examples for:

1. Matrix Code Rain
2. Auto Resize Probe
3. Midjourney Galaxy
4. Bad Apple ANSI
5. Live TTY WebSocket Bridge
6. Apple II BASIC, either by documenting the existing complete source tree or extracting a
   consumer-facing example directory

Each directory must include its entry component, helpers, styles, assets, attribution, and exact
commands. Avoid copying large behavior into a second README-only implementation. Storybook should
wrap the canonical implementation and retain only presentation and deterministic capture options.

Acceptance evidence:

- every linked example builds from a clean checkout;
- Matrix Code Rain and Midjourney Galaxy animate rather than render empty surfaces;
- Auto Resize includes the real redraw implementation;
- Bad Apple loads the documented asset before rendering the player;
- the TTY bridge documents and runs both browser and server halves; and
- Apple II BASIC links every required parser, interpreter, session, and surface module.

### Phase 5: API Fragment Cleanup

Review the remaining focused sections, including Display Padding, Display Frame, Display Buffer,
Canvas Backend, viewport controls, and playback callbacks.

1. Label each as an API fragment.
2. Add the minimum missing context needed to understand the identifier names.
3. Link each fragment to the closest complete example.
4. Remove duplicate fragments that no longer add a distinct concept.
5. Keep advanced property reference material concise and navigable.

Acceptance evidence:

- fragments contain no unexplained undefined helper calls;
- every fragment links to a complete setup path; and
- the README does not imply that an API fragment produced unrelated media.

### Phase 6: Runtime And Capture Validation

1. Build the package and type-check all examples.
2. Build Storybook using the canonical example modules.
3. Add focused render smoke coverage for every media-backed example.
4. Exercise timers, controller writes, resize callbacks, asset loading, and TTY connection states.
5. Regenerate captures only from the canonical example-backed stories.
6. Compare the regenerated media with the README descriptions and code.

Acceptance evidence:

```bash
yarn build
yarn examples:typecheck
yarn readme:examples:check
yarn storybook:build
yarn test:e2e:built
```

If the existing standard E2E command is too broad for iteration, add a focused examples smoke
command, but keep the full standard suite as the final integration gate.

## Validation Matrix

| Risk | Required proof |
| --- | --- |
| Snippet drift | Sync script produces no diff and `--check` passes |
| Missing imports or helpers | Example TypeScript project passes with no implicit globals |
| Incorrect controller lifetime | Mount/unmount test and no writes after cleanup |
| Storybook differs from README | Story imports the canonical example component |
| Asset path works only locally | Clean-checkout build resolves every repository-relative asset |
| Capture shows undocumented behavior | Focused browser smoke assertion observes the documented sequence or animation |
| TTY example documents only one half | Browser client and server start commands are both exercised |
| README becomes unmanageable | Large examples use entry snippets, file trees, and full-source links |

## Final Acceptance Criteria

The documentation migration is complete when:

- no complete README example contains an undefined identifier;
- every complete inline example includes the imports and stylesheet needed in an existing React
  application;
- every controller-driven component uses an explicit, safe lifecycle;
- every screenshot or video is backed by the exact canonical example linked in its section;
- every complex demo has a repository-relative link to all required source and assets;
- no README link contains `/Users/...`, `file://`, or another developer-local path;
- every canonical example uses only public package exports;
- canonical examples type-check and render in CI;
- README synchronization is deterministic and checked in CI;
- Storybook presentation wrappers no longer own duplicate demo behavior; and
- a clean-checkout validation run records successful package build, example type-check, README
  check, Storybook build, and focused browser evidence.

## Out Of Scope

- Moving showcase-only behavior into the published package API solely to simplify documentation.
- Embedding the complete Apple II runtime, ANSI assets, or WebSocket server inline in the README.
- Redesigning the visual appearance of existing demos unless extraction exposes an actual parity
  defect.
- Replacing Storybook as the interactive demo host.
- Regenerating media before the canonical example and capture paths are shared and validated.

## Recommended Delivery Order

Land the work in reviewable groups:

1. contract, inventory, synchronization tooling, and type-check infrastructure;
2. compact examples and their README blocks;
3. complex example extraction and Storybook reuse;
4. API-fragment cleanup, link validation, regenerated captures, and final browser proof.

Do not regenerate a capture in an earlier group if its demo still has a separate README and
Storybook implementation. The final capture should be evidence that the canonical public example,
not a parallel story-only implementation, produces the documented result.
