# Matrix Code Rain

This effect is not implemented by appending falling strings to a terminal. It keeps a fixed grid of
glyphs and moves an illumination wave through each column. The bright head, fading green trail,
occasional background shimmer, and selective character changes create the impression of code
falling through the display without moving the cells themselves.

## How the effect works

The animation has three layers of state:

1. A seeded two-dimensional glyph field supplies the character at every row and column.
2. Each column owns an independent floating-point `head`, `speed`, `trail`, `gap`, and
   `shimmerSeed`.
3. A five-color palette maps the relationship between a cell and its column head to a
   `RetroScreenCellStyle`.

The engine starts with the deterministic Mulberry32 seed `1999`. That makes the initial glyphs,
column speeds, trail lengths, and gaps repeatable for a given grid size while still looking varied.
Each animation tick performs the following pipeline:

```text
advance every column head
        ↓
recycle columns whose trails have cleared the grid
        ↓
mutate a few glyphs, weighted toward each active trail
        ↓
calculate each cell's distance behind its column head
        ↓
map that distance to dark green → bright green → near-white
        ↓
publish the resulting RetroScreenCell[][] grid
```

The head receives the near-white shade. Cells behind it step through three progressively darker
greens according to their distance through the trail. Cells outside the trail use the darkest
shade, apart from a sparse frame-based shimmer. When a trail and its gap leave the bottom of the
screen, the column is reset above the viewport with a new speed and trail length.

Glyph mutation is deliberately separate from movement. Faster columns change more characters per
tick, and 62% of those changes are biased toward the illuminated trail. This keeps the field alive
without making the entire grid flicker at once.

## How RetroScreen renders it

`renderMatrixRainCells` converts the engine state directly into a `RetroScreenCell[][]`. Every cell
contains a character and an RGB foreground style, so the effect does not need to generate ANSI
escape sequences or rebuild one large terminal string.

The component renders that grid with:

- `gridMode="static"` and explicit `rows` and `cols`, keeping cell geometry stable;
- `displayColorMode="ansi-extended"`, preserving the five RGB shades;
- `displayLayoutMode="fit-width"`, scaling the fixed grid to its host;
- the Matrix font supplied through `--retro-screen-font-family`; and
- small font and row scale adjustments that tighten the rain into continuous columns.

The React effect owns one engine instance and schedules frames with a recursive `setTimeout`. After
each tick it publishes a newly rasterized cell grid with `setCells`. Cleanup sets a cancellation
flag and clears the pending timer, preventing an unmounted example from continuing to animate.

## Tuning the result

The public component props control the presentation and frame rate:

| Prop | Default | Effect |
| --- | ---: | --- |
| `rows` | `24` | Number of visible glyph rows and the basis for trail and gap ranges. |
| `cols` | `58` | Number of independently animated rain columns. |
| `tickMs` | `62` | Delay between engine updates; lower values animate faster. |
| `displayPadding` | `{ block: 0, inline: 8 }` | Space between the grid and display edges. |
| `displayFontScale` | `1.05` | Glyph width and overall density. |
| `displayRowScale` | `1.08` | Vertical spacing between glyph rows. |

For a different character language, edit `GLYPH_POOL`. For a colder, dimmer, or more film-like
trail, change `SHADE_COLORS`. Column motion is controlled in `createColumn`, while mutation density
and trail bias live in `mutateColumnGlyphs`.

## Required files

Copy these three files into the same example module:

```text
MatrixCodeRain.tsx
matrix-code-rain.css
Matrix.ttf
```

[`MatrixCodeRain.tsx`](./MatrixCodeRain.tsx) contains the complete engine, cell rasterizer, and React
component. [`matrix-code-rain.css`](./matrix-code-rain.css) registers the display font. In this
repository the stylesheet resolves the existing
[`src/stories/assets/Matrix.ttf`](../../../src/stories/assets/Matrix.ttf); when copying the example,
place that font beside the CSS file and update the URL to `./Matrix.ttf`.

Install the package and render the exported component:

```tsx
import { MatrixCodeRainScreen } from "./MatrixCodeRain";

export function App() {
  return <MatrixCodeRainScreen />;
}
```

```bash
npm install react-retro-display-tty-ansi-ascii
npm run dev
```

Within this repository, validate it with `yarn examples:typecheck` and view the corresponding
Storybook story with `yarn storybook`.
