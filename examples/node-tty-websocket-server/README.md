# Node TTY Websocket Example

This example server is the Phase 1 reference backend for a live `RetroScreen` TTY session.

It demonstrates:

- websocket session startup
- TTY session creation with `node-pty`
- TTY output forwarding
- TTY resize from frontend geometry
- TTY stdin writes from frontend session input
- optional token/origin checks and idle timeout policy
- optional command, cwd, and env override restrictions

## Install

```bash
cd examples/node-tty-websocket-server
yarn install
```

## Run

```bash
yarn start
```

By default it listens on:

- `ws://127.0.0.1:8787`

When launched through `yarn tty:server`, the example also starts in a themed demo shell rooted at
`~/tty-demo` with the prompt:

- `operator@retro:~/tty-demo$`

## Useful Environment Flags

- `ACCESS_TOKEN` to require `?token=...` or an open-payload token
- `ALLOWED_ORIGIN` to enforce a specific browser origin
- `IDLE_TIMEOUT_MS` to close quiet sessions after a timeout
- `DEFAULT_CWD` to pin the TTY working directory
- `TTY_DEMO_SHELL=false` to disable the themed demo shell and use the host shell defaults
- `ALLOW_COMMAND_OVERRIDE=false` to stop clients from changing the launched command
- `ALLOW_CWD_OVERRIDE=false` to stop clients from changing the working directory
- `ALLOW_ENV_OVERRIDE=false` to stop clients from sending custom env keys
- `MAX_PAYLOAD_BYTES` to clamp websocket payload size

## Message Contract

Frontend to server:

- `open`
- `resize`
- `input`
- `close`

Server to frontend:

- `ready`
- `data`
- `exit`
- `error`

## Example Frontend Wiring

```tsx
import { RetroScreen, createRetroScreenWebSocketSession } from "react-retro-display-tty-ansi-ascii";

const session = createRetroScreenWebSocketSession({
  url: "ws://127.0.0.1:8787",
  openPayload: {
    cwd: "/Users/josh/play/react-retro-display",
    term: "xterm-256color"
  }
});

export function DemoTerminal() {
  return <RetroScreen mode="terminal" session={session} />;
}
```

## Notes

- This is a local development example, not a production-hardened remote shell service.
- It now includes origin, token, payload-size, and override-policy hooks, but authentication,
  authorization, sandboxing, and multi-tenant isolation still need to be added by the host
  application.
