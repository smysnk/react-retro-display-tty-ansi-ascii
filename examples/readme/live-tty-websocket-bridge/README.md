# Live TTY WebSocket Bridge

The browser and server halves are both required:

```text
examples/readme/live-tty-websocket-bridge/LiveShell.tsx
examples/node-tty-websocket-server/server.mjs
examples/node-tty-websocket-server/package.json
```

`LiveShell.tsx` creates a component-owned WebSocket terminal session and asks `RetroScreen` to
close it on unmount. The reference server owns `node-pty`, TTY process creation, resize, input,
output, origin/token policy, and idle-timeout handling.

Start the repository server:

```bash
yarn tty:server
```

Then render `LiveShell` in a browser application served from an allowed origin. The default URL is
`ws://127.0.0.1:8787`; pass `url` and `cwd` props to override it.

See [`examples/node-tty-websocket-server/README.md`](../../node-tty-websocket-server/README.md)
for the complete server configuration and security boundary.
