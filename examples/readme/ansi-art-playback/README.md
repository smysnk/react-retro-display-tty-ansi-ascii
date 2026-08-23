# ANSI Art Playback

The complete consumer-facing player consists of:

```text
BadAppleAnsiPlayback.tsx
bad-apple.ans
```

`BadAppleAnsiPlayback.tsx` accepts an asset URL, fetches the bytes, reads SAUCE metadata, removes
the SAUCE record, splits the payload into playback chunks, reports loading errors, and renders the
canvas-backed ANSI player.

The repository's credited Mistigris asset is stored at
[`src/stories/assets/bad-apple.ans`](../../../src/stories/assets/bad-apple.ans). Copy that asset
beside the component or supply another licensed ANSI file.

With Vite, wire the asset URL like this:

```tsx
import badAppleUrl from "./bad-apple.ans?url";
import { BadAppleAnsiPlayback } from "./BadAppleAnsiPlayback";

export function App() {
  return <BadAppleAnsiPlayback assetUrl={badAppleUrl} />;
}
```

```bash
npm install react-retro-display-tty-ansi-ascii
npm run dev
```

Credit for the included Bad Apple ANSI release belongs to Mistigris. Preserve the attribution
when reusing that asset.
