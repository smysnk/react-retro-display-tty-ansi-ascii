# Matrix Code Rain

The required files are:

```text
MatrixCodeRain.tsx
matrix-code-rain.css
Matrix.ttf
```

`MatrixCodeRain.tsx` is the complete animation engine and React component used to reproduce the
README's Matrix rain surface. It owns the seeded glyph field, column speed and trail state,
per-cell color intensity, frame scheduling, and timer cleanup. `matrix-code-rain.css` registers
the display font. In this repository it resolves the existing
[`src/stories/assets/Matrix.ttf`](../../../src/stories/assets/Matrix.ttf); when copying the example,
place that font beside the CSS file and update the URL to `./Matrix.ttf`.

Copy `MatrixCodeRain.tsx` into an existing React application, install the package, and render:

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
