import process from "node:process";
import { resolve } from "node:path";
import WebSocket from "ws";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getNodeTtySupportError } from "../../../scripts/tty-support.mjs";
import { startTtyWebSocketServer } from "../../../scripts/tty-websocket-server.mjs";
import type { RetroScreenTerminalSessionEvent } from "./session-types";
import {
  createRetroScreenWebSocketSession,
  type RetroScreenTerminalWebSocketLike
} from "./websocket-session";

class NodeWebSocketAdapter implements RetroScreenTerminalWebSocketLike {
  readonly socket: WebSocket;
  onopen = null;
  onmessage = null;
  onerror = null;
  onclose = null;

  constructor(url: string, protocols?: string | string[]) {
    this.socket = new WebSocket(url, protocols);

    this.socket.on("open", () => {
      this.onopen?.(new Event("open"));
    });

    this.socket.on("message", (data) => {
      this.onmessage?.({
        data: data.toString()
      } as MessageEvent<string>);
    });

    this.socket.on("error", () => {
      this.onerror?.(new Event("error"));
    });

    this.socket.on("close", (code, reason) => {
      this.onclose?.({
        code,
        reason: reason.toString("utf8"),
        wasClean: true
      } as CloseEvent);
    });
  }

  get readyState() {
    return this.socket.readyState;
  }

  send(data: string) {
    this.socket.send(data);
  }

  close(code?: number, reason?: string) {
    this.socket.close(code, reason);
  }
}

const wait = (duration: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, duration);
  });

const waitFor = async <T>(
  predicate: () => T | null | undefined | false,
  label: string,
  timeoutMs = 5000
) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const result = predicate();

    if (result) {
      return result;
    }

    await wait(20);
  }

  throw new Error(`Timed out waiting for ${label}.`);
};

const getCombinedData = (events: RetroScreenTerminalSessionEvent[]) =>
  events
    .filter((event): event is Extract<RetroScreenTerminalSessionEvent, { type: "data" }> => event.type === "data")
    .map((event) => event.data)
    .join("");

const ttySupportError = getNodeTtySupportError();
const describeWithTty = describe.skip;

describeWithTty("createRetroScreenWebSocketSession with a real TTY server", () => {
  const scriptPath = resolve(process.cwd(), "scripts/tty-test-terminal.mjs");
  let server: Awaited<ReturnType<typeof startTtyWebSocketServer>>;

  beforeAll(async () => {
    server = await startTtyWebSocketServer({
      port: 0,
      heartbeatMs: 1000,
      defaultCommand: process.execPath,
      defaultArgs: [scriptPath],
      allowCommandOverride: false
    });
  }, 15000);

  afterAll(async () => {
    await server.close();
  }, 15000);

  it(
    "round-trips TTY output, input, resize, title, bell, and alternate-screen events",
    async () => {
      const events: RetroScreenTerminalSessionEvent[] = [];
      const session = createRetroScreenWebSocketSession({
        url: server.url,
        WebSocket: NodeWebSocketAdapter,
        openPayload: {
          term: "xterm-256color"
        }
      });
      const unsubscribe = session.subscribe((event) => {
        events.push(event);
      });

      try {
        session.connect({ rows: 20, cols: 60 });

        await waitFor(
          () => events.find((event) => event.type === "ready"),
          "TTY session ready event"
        );
        await waitFor(
          () => events.find((event) => event.type === "title" && event.title === "Retro TTY Test"),
          "initial TTY title event"
        );
        await waitFor(
          () => getCombinedData(events).includes("READY"),
          "initial TTY readiness output"
        );

        session.writeInput("PING\r");
        await waitFor(() => getCombinedData(events).includes("PONG"), "PING response");

        session.writeInput("SIZE?\r");
        await waitFor(() => getCombinedData(events).includes("SIZE 60x20"), "SIZE response");

        session.resize(22, 70);
        await waitFor(() => getCombinedData(events).includes("RESIZE 70x22"), "resize echo");

        session.writeInput("TITLE Bridge Session\r");
        await waitFor(
          () => events.find((event) => event.type === "title" && event.title === "Bridge Session"),
          "updated TTY title event"
        );

        session.writeInput("BELL\r");
        await waitFor(
          () => events.filter((event) => event.type === "bell").length >= 1,
          "bell event"
        );

        session.writeInput("ALT\r");
        await waitFor(
          () => getCombinedData(events).includes("ALT-SCREEN"),
          "alternate-screen output"
        );

        session.writeInput("MAIN\r");
        await waitFor(
          () => getCombinedData(events).includes("PRIMARY"),
          "primary-screen restore output"
        );

        session.writeInput("EXIT\r");
        await waitFor(
          () => events.find((event) => event.type === "exit"),
          "TTY exit event"
        );

        expect(events.some((event) => event.type === "connecting")).toBe(true);
        expect(events.some((event) => event.type === "open")).toBe(true);
        expect(session.getState()).toBe("closed");
      } finally {
        unsubscribe();
        session.close();
      }
    },
    15000
  );

  it("enforces token checks and can reject command overrides when the server is locked down", async () => {
    const lockedServer = await startTtyWebSocketServer({
      port: 0,
      accessToken: "secret-token",
      allowCommandOverride: false,
      defaultCommand: process.execPath,
      defaultArgs: [scriptPath]
    });

    try {
      const rejectedEvents: RetroScreenTerminalSessionEvent[] = [];
      const rejectedSession = createRetroScreenWebSocketSession({
        url: lockedServer.url,
        WebSocket: NodeWebSocketAdapter,
        openPayload: {
          command: process.execPath,
          args: [scriptPath]
        }
      });

      const unsubscribeRejected = rejectedSession.subscribe((event) => {
        rejectedEvents.push(event);
      });

      try {
        rejectedSession.connect({ rows: 20, cols: 60 });
        await waitFor(
          () =>
            rejectedEvents.find(
              (event) =>
                event.type === "error" &&
                event.message.includes("Access token rejected")
            ),
          "access-token rejection"
        );
      } finally {
        unsubscribeRejected();
        rejectedSession.close();
      }

      const lockedEvents: RetroScreenTerminalSessionEvent[] = [];
      const lockedSession = createRetroScreenWebSocketSession({
        url: `${lockedServer.url}?token=secret-token`,
        WebSocket: NodeWebSocketAdapter,
        openPayload: {
          command: process.execPath,
          args: [scriptPath]
        }
      });
      const unsubscribeLocked = lockedSession.subscribe((event) => {
        lockedEvents.push(event);
      });

      try {
        lockedSession.connect({ rows: 20, cols: 60 });
        await waitFor(
          () =>
            lockedEvents.find(
              (event) =>
                event.type === "error" &&
                event.message.includes("Command overrides are disabled")
            ),
          "command-override rejection"
        );
      } finally {
        unsubscribeLocked();
        lockedSession.close();
      }
    } finally {
      await lockedServer.close();
    }
  });
});
