# Auto Resize Probe

`AutoResizeProbe.tsx` is a complete resize-aware terminal example. It includes the previously
omitted `redrawBorderAndMetrics` helper, deduplicates geometry reports, emits the terminal-size
reply, resizes the controller buffer, and redraws the border and metrics.

Copy the file into an existing React application, install the package, and render
`AutoResizeProbe`.

```bash
npm install react-retro-display-tty-ansi-ascii
npm run dev
```

The visible scripted mouse used in the README capture is capture choreography in Storybook; it is
not required to implement the resize-aware terminal behavior.
