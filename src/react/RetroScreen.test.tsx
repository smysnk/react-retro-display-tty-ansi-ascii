import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { RetroScreen } from "./RetroScreen";
import { createRetroScreenController } from "../core/terminal/controller";
import { wrapTextToColumns } from "../core/geometry/wrap";
import type { RetroScreenTerminalSession, RetroScreenTerminalSessionEvent } from "../core/terminal/session-types";
import { DEFAULT_CELL_STYLE } from "../core/terminal/sgr";

const getBodyText = (container: HTMLElement) =>
  container.querySelector(".retro-screen__body")?.textContent?.replace(/\u00a0/gu, " ") ?? "";

const getVisibleLines = (container: HTMLElement) =>
  Array.from(container.querySelectorAll(".retro-screen__line")).map((line) =>
    (line.textContent ?? "").replace(/\u00a0/gu, " ")
  );

const createClipboardData = () => {
  const store = new Map<string, string>();

  return {
    setData: vi.fn((type: string, value: string) => {
      store.set(type, value);
    }),
    getData: vi.fn((type: string) => store.get(type) ?? "")
  };
};

const mockScreenRect = (container: HTMLElement, rect: DOMRectInit) => {
  const screenNode = container.querySelector(".retro-screen__grid") as HTMLDivElement | null;
  expect(screenNode).not.toBeNull();
  vi.spyOn(screenNode!, "getBoundingClientRect").mockImplementation(
    () =>
      ({
        x: rect.x ?? 0,
        y: rect.y ?? 0,
        left: rect.x ?? 0,
        top: rect.y ?? 0,
        width: rect.width ?? 0,
        height: rect.height ?? 0,
        right: (rect.x ?? 0) + (rect.width ?? 0),
        bottom: (rect.y ?? 0) + (rect.height ?? 0),
        toJSON: () => ({})
      }) as DOMRect
  );
};

const createMockTerminalSession = (
  initialState: RetroScreenTerminalSession["getState"] extends () => infer T ? T : never = "idle"
) => {
  let listener: ((event: RetroScreenTerminalSessionEvent) => void) | null = null;

  return {
    connect: vi.fn(),
    writeInput: vi.fn(),
    resize: vi.fn(),
    close: vi.fn(),
    getState: vi.fn(() => initialState),
    subscribe: vi.fn((nextListener: (event: RetroScreenTerminalSessionEvent) => void) => {
      listener = nextListener;
      return () => {
        if (listener === nextListener) {
          listener = null;
        }
      };
    }),
    emit(event: RetroScreenTerminalSessionEvent) {
      listener?.(event);
    }
  } satisfies RetroScreenTerminalSession & {
    emit: (event: RetroScreenTerminalSessionEvent) => void;
  };
};

const parseRgb = (value: string) => {
  const match = value.match(/\d+(?:\.\d+)?/g) ?? [];
  return {
    red: Number.parseFloat(match[0] ?? "0"),
    green: Number.parseFloat(match[1] ?? "0"),
    blue: Number.parseFloat(match[2] ?? "0")
  };
};

const toLuminanceChannel = (value: number) => {
  const normalized = value / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
};

const getContrastRatio = (foreground: string, background: string) => {
  const foregroundRgb = parseRgb(foreground);
  const backgroundRgb = parseRgb(background);
  const foregroundLuminance =
    0.2126 * toLuminanceChannel(foregroundRgb.red) +
    0.7152 * toLuminanceChannel(foregroundRgb.green) +
    0.0722 * toLuminanceChannel(foregroundRgb.blue);
  const backgroundLuminance =
    0.2126 * toLuminanceChannel(backgroundRgb.red) +
    0.7152 * toLuminanceChannel(backgroundRgb.green) +
    0.0722 * toLuminanceChannel(backgroundRgb.blue);
  const brighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);

  return (brighter + 0.05) / (darker + 0.05);
};

describe("RetroScreen", () => {
  it("renders value mode text", () => {
    render(<RetroScreen mode="value" value="HELLO LCD" />);

    expect(screen.getByText("HELLO LCD")).toBeInTheDocument();
  });

  it("renders styled value-mode cells when provided", () => {
    const { container } = render(
      <RetroScreen
        mode="value"
        value="A "
        cells={[
          [
            {
              char: "A",
              style: {
                ...DEFAULT_CELL_STYLE,
                foreground: {
                  mode: "palette",
                  value: 1,
                },
                background: {
                  mode: "palette",
                  value: 4,
                },
              },
            },
            {
              char: " ",
              style: {
                ...DEFAULT_CELL_STYLE,
                foreground: {
                  mode: "palette",
                  value: 1,
                },
                background: {
                  mode: "palette",
                  value: 4,
                },
              },
            },
          ],
        ]}
        gridMode="static"
        rows={1}
        cols={2}
        displayColorMode="ansi-classic"
      />
    );

    const cells = Array.from(container.querySelectorAll(".retro-screen__cell"));

    expect(cells).toHaveLength(2);
    expect(window.getComputedStyle(cells[0]!).color).not.toBe("rgba(0, 0, 0, 0)");
    expect(window.getComputedStyle(cells[0]!).backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(window.getComputedStyle(cells[1]!).backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
  });

  it("wraps long value-mode text into measured columns", () => {
    const text = "X".repeat(50);
    const { container } = render(<RetroScreen mode="value" value={text} />);

    const lines = Array.from(container.querySelectorAll(".retro-screen__line"))
      .map((line) => line.textContent)
      .filter((line) => line && line.trim().length > 0);

    expect(lines[0]).toBe("X".repeat(46));
    expect(lines[1]).toBe("XXXX");
  });

  it("renders terminal mode buffer text and updates from a controller", () => {
    const controller = createRetroScreenController({
      rows: 3,
      cols: 24,
      cursorMode: "hollow"
    });
    const { container } = render(<RetroScreen mode="terminal" controller={controller} />);

    act(() => {
      controller.write("line one");
      controller.writeln(" and more");
      controller.write("line two");
    });

    const bodyText = getBodyText(container);
    expect(bodyText).toContain("line one");
    expect(bodyText).toContain("line two");
    expect(container.querySelector(".retro-screen__cursor")).toHaveAttribute(
      "data-cursor-mode",
      "hollow"
    );
  });

  it("supports width-only resizing when configured", () => {
    const { container } = render(<RetroScreen mode="value" value="Resize me" resizable="width" />);

    const root = container.querySelector(".retro-screen") as HTMLDivElement | null;
    const widthHandle = container.querySelector(
      '[data-resize-handle="right"]'
    ) as HTMLDivElement | null;

    expect(root).not.toBeNull();
    expect(widthHandle).not.toBeNull();
    expect(root).toHaveAttribute("data-resizable-mode", "width");
    expect(container.querySelector('[data-resize-handle="bottom"]')).toBeNull();
    expect(container.querySelector('[data-resize-handle="left"]')).toBeNull();

    vi.spyOn(root!, "getBoundingClientRect").mockImplementation(
      () =>
        ({
          x: 0,
          y: 0,
          left: 0,
          top: 0,
          right: 640,
          bottom: 280,
          width: 640,
          height: 280,
          toJSON: () => ({})
        }) as DOMRect
    );

    fireEvent.mouseDown(widthHandle!, {
      button: 0,
      clientX: 640,
      clientY: 120
    });
    fireEvent.mouseMove(window, {
      clientX: 704,
      clientY: 120
    });
    fireEvent.mouseUp(window);

    expect(root!.style.width).toBe("704px");
    expect(root!.style.height).toBe("");
  });

  it("preserves explicit width and height styles before any manual resize begins", () => {
    const { container } = render(
      <RetroScreen
        mode="value"
        value="Resize me"
        resizable="both"
        style={{ width: 672, height: 328 }}
      />
    );

    const root = container.querySelector(".retro-screen") as HTMLDivElement | null;

    expect(root).not.toBeNull();
    expect(root!.style.width).toBe("672px");
    expect(root!.style.height).toBe("328px");
  });

  it("keeps leading-edge handles disabled unless explicitly configured", () => {
    const { container } = render(<RetroScreen mode="value" value="Resize me" resizable="both" />);

    expect(container.querySelector('[data-resize-handle="left"]')).toBeNull();
    expect(container.querySelector('[data-resize-handle="top"]')).toBeNull();
    expect(container.querySelector('[data-resize-handle="top-left"]')).toBeNull();
  });

  it("supports corner resizing when both axes are enabled", () => {
    const { container } = render(<RetroScreen mode="value" value="Resize me" resizable />);

    const root = container.querySelector(".retro-screen") as HTMLDivElement | null;
    const cornerHandle = container.querySelector(
      '[data-resize-handle="bottom-right"]'
    ) as HTMLDivElement | null;

    expect(root).not.toBeNull();
    expect(cornerHandle).not.toBeNull();
    expect(root).toHaveAttribute("data-resizable-mode", "both");

    vi.spyOn(root!, "getBoundingClientRect").mockImplementation(
      () =>
        ({
          x: 0,
          y: 0,
          left: 0,
          top: 0,
          right: 620,
          bottom: 260,
          width: 620,
          height: 260,
          toJSON: () => ({})
        }) as DOMRect
    );

    fireEvent.mouseDown(cornerHandle!, {
      button: 0,
      clientX: 620,
      clientY: 260
    });
    fireEvent.mouseMove(window, {
      clientX: 710,
      clientY: 340
    });
    fireEvent.mouseUp(window);

    expect(root!.style.width).toBe("710px");
    expect(root!.style.height).toBe("340px");
  });

  it("supports explicit leading-edge resize handles", () => {
    const { container } = render(
      <RetroScreen mode="value" value="Resize me" resizable="both" resizableLeadingEdges />
    );

    const root = container.querySelector(".retro-screen") as HTMLDivElement | null;
    const leftHandle = container.querySelector(
      '[data-resize-handle="left"]'
    ) as HTMLDivElement | null;
    const topHandle = container.querySelector(
      '[data-resize-handle="top"]'
    ) as HTMLDivElement | null;

    expect(root).not.toBeNull();
    expect(leftHandle).not.toBeNull();
    expect(topHandle).not.toBeNull();
    expect(root).toHaveAttribute("data-resizable-leading-edges", "true");

    vi.spyOn(root!, "getBoundingClientRect").mockImplementation(
      () =>
        ({
          x: 0,
          y: 0,
          left: 0,
          top: 0,
          right: 620,
          bottom: 260,
          width: 620,
          height: 260,
          toJSON: () => ({})
        }) as DOMRect
    );

    fireEvent.mouseDown(leftHandle!, {
      button: 0,
      clientX: 0,
      clientY: 120
    });
    fireEvent.mouseMove(window, {
      clientX: -80,
      clientY: 120
    });
    fireEvent.mouseUp(window);

    expect(root!.style.width).toBe("700px");

    fireEvent.mouseDown(topHandle!, {
      button: 0,
      clientX: 120,
      clientY: 0
    });
    fireEvent.mouseMove(window, {
      clientX: 120,
      clientY: -70
    });
    fireEvent.mouseUp(window);

    expect(root!.style.height).toBe("330px");
  });

  it("bridges a live terminal session into terminal mode and resizes it with the grid", async () => {
    const session = createMockTerminalSession();
    const onSessionEvent = vi.fn();
    const onSessionStateChange = vi.fn();
    const { container, rerender } = render(
      <RetroScreen
        mode="terminal"
        session={session}
        gridMode="static"
        rows={5}
        cols={12}
        onSessionEvent={onSessionEvent}
        onSessionStateChange={onSessionStateChange}
      />
    );

    expect(session.connect).toHaveBeenCalledWith({
      rows: 5,
      cols: 12
    });

    await act(async () => {
      session.emit({ type: "ready", pid: 99 });
      session.emit({ type: "data", data: "shell ready" });
      await Promise.resolve();
    });

    expect(getBodyText(container)).toContain("shell ready");
    expect(onSessionEvent).toHaveBeenCalledWith({ type: "ready", pid: 99 });
    expect(onSessionStateChange).toHaveBeenCalledWith("open");

    rerender(
      <RetroScreen
        mode="terminal"
        session={session}
        gridMode="static"
        rows={6}
        cols={16}
        onSessionEvent={onSessionEvent}
        onSessionStateChange={onSessionStateChange}
      />
    );

    expect(session.resize).toHaveBeenCalledWith(6, 16);
  });

  it("exposes session metadata hooks and closes the session on unmount", () => {
    const session = createMockTerminalSession("open");
    const { container, unmount } = render(
      <RetroScreen mode="terminal" session={session} gridMode="static" rows={4} cols={12} />
    );

    const root = container.querySelector(".retro-screen") as HTMLElement | null;
    expect(root).not.toBeNull();
    expect(root).toHaveAttribute("data-session-state", "open");
    expect(root).toHaveAttribute("data-session-bell-count", "0");

    act(() => {
      session.emit({ type: "title", title: "htop" });
      session.emit({ type: "bell" });
    });

    expect(root).toHaveAttribute("data-session-title", "htop");
    expect(root).toHaveAttribute("data-session-bell-count", "1");

    unmount();

    expect(session.close).toHaveBeenCalledTimes(1);
  });

  it("encodes terminal key presses into session input by default when a live session is attached", () => {
    const session = createMockTerminalSession();
    const onTerminalData = vi.fn();
    const onTerminalKeyDown = vi.fn();
    const { container } = render(
      <RetroScreen
        mode="terminal"
        session={session}
        gridMode="static"
        rows={4}
        cols={12}
        onTerminalData={onTerminalData}
        onTerminalKeyDown={onTerminalKeyDown}
      />
    );

    const viewport = container.querySelector(".retro-screen__viewport") as HTMLDivElement | null;
    expect(viewport).not.toBeNull();

    fireEvent.keyDown(viewport!, {
      key: "c",
      code: "KeyC",
      ctrlKey: true
    });

    expect(onTerminalKeyDown).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "c",
        code: "KeyC",
        ctrlKey: true
      })
    );
    expect(onTerminalData).toHaveBeenCalledWith("\u0003");
    expect(session.writeInput).toHaveBeenCalledWith("\u0003");
  });

  it("keeps PageUp local when terminal keyboard capture is disabled", () => {
    const session = createMockTerminalSession();
    const controller = createRetroScreenController({ rows: 3, cols: 12, scrollback: 12 });

    act(() => {
      controller.write(
        ["line-01", "line-02", "line-03", "line-04", "line-05", "line-06"].join("\r\n")
      );
    });

    const { container } = render(
      <RetroScreen
        mode="terminal"
        session={session}
        controller={controller}
        captureKeyboard={false}
        gridMode="static"
        rows={3}
        cols={12}
      />
    );

    const viewport = container.querySelector(".retro-screen__viewport") as HTMLDivElement | null;
    const root = container.querySelector(".retro-screen") as HTMLElement | null;
    expect(viewport).not.toBeNull();
    expect(root?.dataset.bufferOffset).toBe("0");

    fireEvent.keyDown(viewport!, {
      key: "PageUp",
      code: "PageUp"
    });

    expect(root?.dataset.bufferOffset).not.toBe("0");
    expect(session.writeInput).not.toHaveBeenCalled();
  });

  it("routes PageUp to terminal input when keyboard capture is enabled", () => {
    const session = createMockTerminalSession();
    const controller = createRetroScreenController({ rows: 3, cols: 12, scrollback: 12 });

    act(() => {
      controller.write(
        ["line-01", "line-02", "line-03", "line-04", "line-05", "line-06"].join("\r\n")
      );
    });

    const { container } = render(
      <RetroScreen
        mode="terminal"
        session={session}
        controller={controller}
        gridMode="static"
        rows={3}
        cols={12}
      />
    );

    const viewport = container.querySelector(".retro-screen__viewport") as HTMLDivElement | null;
    const root = container.querySelector(".retro-screen") as HTMLElement | null;
    expect(viewport).not.toBeNull();

    fireEvent.keyDown(viewport!, {
      key: "PageUp",
      code: "PageUp"
    });

    expect(root?.dataset.bufferOffset).toBe("0");
    expect(session.writeInput).toHaveBeenCalledWith("\u001b[5~");
  });

  it("uses application cursor key sequences when the host enables application cursor mode", () => {
    const session = createMockTerminalSession();
    const controller = createRetroScreenController({ rows: 3, cols: 12 });
    const { container } = render(
      <RetroScreen
        mode="terminal"
        session={session}
        controller={controller}
        gridMode="static"
        rows={3}
        cols={12}
      />
    );

    act(() => {
      controller.write("\u001b[?1h");
    });

    const viewport = container.querySelector(".retro-screen__viewport") as HTMLDivElement | null;
    expect(viewport).not.toBeNull();

    fireEvent.keyDown(viewport!, {
      key: "ArrowUp",
      code: "ArrowUp"
    });

    expect(session.writeInput).toHaveBeenCalledWith("\u001bOA");
  });

  it("can emit terminal input even without a live session", () => {
    const onTerminalData = vi.fn();
    const { container } = render(
      <RetroScreen
        mode="terminal"
        captureKeyboard
        onTerminalData={onTerminalData}
        gridMode="static"
        rows={3}
        cols={12}
      />
    );

    const viewport = container.querySelector(".retro-screen__viewport") as HTMLDivElement | null;
    expect(viewport).not.toBeNull();

    fireEvent.keyDown(viewport!, {
      key: "Enter",
      code: "Enter"
    });

    expect(onTerminalData).toHaveBeenCalledWith("\r");
  });

  it("wraps pasted terminal text when the host enables bracketed paste mode", () => {
    const session = createMockTerminalSession();
    const controller = createRetroScreenController({ rows: 3, cols: 12 });
    const onTerminalData = vi.fn();
    const { container } = render(
      <RetroScreen
        mode="terminal"
        session={session}
        controller={controller}
        onTerminalData={onTerminalData}
        gridMode="static"
        rows={3}
        cols={12}
      />
    );

    act(() => {
      controller.write("\u001b[?2004h");
    });

    const viewport = container.querySelector(".retro-screen__viewport") as HTMLDivElement | null;
    expect(viewport).not.toBeNull();

    fireEvent.paste(viewport!, {
      clipboardData: {
        getData: (type: string) => (type === "text/plain" ? "npm test\nnpm run build" : "")
      }
    });

    expect(onTerminalData).toHaveBeenCalledWith(
      "\u001b[200~npm test\nnpm run build\u001b[201~"
    );
    expect(session.writeInput).toHaveBeenCalledWith(
      "\u001b[200~npm test\nnpm run build\u001b[201~"
    );
  });

  it("reports focus changes to the terminal when focus reporting mode is enabled", () => {
    const session = createMockTerminalSession();
    const controller = createRetroScreenController({ rows: 3, cols: 12 });
    const onTerminalData = vi.fn();
    const { container } = render(
      <RetroScreen
        mode="terminal"
        session={session}
        controller={controller}
        onTerminalData={onTerminalData}
        gridMode="static"
        rows={3}
        cols={12}
      />
    );

    act(() => {
      controller.write("\u001b[?1004h");
    });

    const viewport = container.querySelector(".retro-screen__viewport") as HTMLDivElement | null;
    expect(viewport).not.toBeNull();

    fireEvent.focus(viewport!);
    fireEvent.blur(viewport!);

    expect(onTerminalData).toHaveBeenNthCalledWith(1, "\u001b[I");
    expect(onTerminalData).toHaveBeenNthCalledWith(2, "\u001b[O");
    expect(session.writeInput).toHaveBeenNthCalledWith(1, "\u001b[I");
    expect(session.writeInput).toHaveBeenNthCalledWith(2, "\u001b[O");
  });

  it("encodes terminal mouse press, drag, and release events when the host enables mouse tracking", () => {
    const session = createMockTerminalSession();
    const controller = createRetroScreenController({ rows: 3, cols: 4 });
    const onTerminalMouse = vi.fn();
    const props = {
      mode: "terminal" as const,
      session,
      controller,
      onTerminalMouse,
      gridMode: "static" as const,
      rows: 3,
      cols: 4
    };
    const { container, rerender } = render(<RetroScreen {...props} />);

    mockScreenRect(container, {
      x: 0,
      y: 0,
      width: 40,
      height: 30
    });
    rerender(<RetroScreen {...props} />);

    act(() => {
      controller.write("\u001b[?1002h\u001b[?1006h");
    });

    const viewport = container.querySelector(".retro-screen__viewport") as HTMLDivElement | null;
    expect(viewport).not.toBeNull();

    fireEvent.mouseDown(viewport!, {
      button: 0,
      clientX: 15,
      clientY: 6
    });
    fireEvent.mouseMove(viewport!, {
      buttons: 1,
      clientX: 25,
      clientY: 16
    });
    fireEvent.mouseUp(viewport!, {
      button: 0,
      clientX: 25,
      clientY: 16
    });

    expect(onTerminalMouse).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        action: "press",
        button: "left",
        row: 1,
        col: 2,
        encodedData: "\u001b[<0;2;1M"
      })
    );
    expect(onTerminalMouse).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        action: "move",
        button: "left",
        row: 2,
        col: 3,
        encodedData: "\u001b[<32;3;2M"
      })
    );
    expect(onTerminalMouse).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        action: "release",
        button: "left",
        row: 2,
        col: 3,
        encodedData: "\u001b[<0;3;2m"
      })
    );
    expect(session.writeInput).toHaveBeenNthCalledWith(1, "\u001b[<0;2;1M");
    expect(session.writeInput).toHaveBeenNthCalledWith(2, "\u001b[<32;3;2M");
    expect(session.writeInput).toHaveBeenNthCalledWith(3, "\u001b[<0;3;2m");
  });

  it("forwards wheel events to the terminal when mouse reporting is active", () => {
    const session = createMockTerminalSession();
    const controller = createRetroScreenController({ rows: 2, cols: 12, scrollback: 12 });
    const props = {
      mode: "terminal" as const,
      session,
      controller,
      gridMode: "static" as const,
      rows: 2,
      cols: 12
    };
    const { container, rerender } = render(<RetroScreen {...props} />);

    mockScreenRect(container, {
      x: 0,
      y: 0,
      width: 120,
      height: 20
    });
    rerender(<RetroScreen {...props} />);

    act(() => {
      controller.write(
        `${Array.from({ length: 8 }, (_, index) => `line-${index + 1}`).join("\r\n")}\r\n\u001b[?1000h\u001b[?1006h`
      );
    });

    const viewport = container.querySelector(".retro-screen__viewport") as HTMLDivElement | null;
    const root = container.querySelector(".retro-screen") as HTMLElement | null;
    expect(viewport).not.toBeNull();
    expect(root).not.toBeNull();

    fireEvent.wheel(viewport!, {
      deltaY: -120,
      clientX: 36,
      clientY: 6
    });

    expect(root).toHaveAttribute("data-buffer-offset", "0");
    expect(session.writeInput).toHaveBeenCalledWith("\u001b[<64;4;1M");
  });

  it("can keep wheel scrolling local while mouse reporting is active", () => {
    const session = createMockTerminalSession();
    const controller = createRetroScreenController({ rows: 2, cols: 12, scrollback: 12 });
    const props = {
      mode: "terminal" as const,
      session,
      controller,
      localScrollbackWhenMouseActive: true,
      gridMode: "static" as const,
      rows: 2,
      cols: 12
    };
    const { container, rerender } = render(<RetroScreen {...props} />);

    mockScreenRect(container, {
      x: 0,
      y: 0,
      width: 120,
      height: 20
    });
    rerender(<RetroScreen {...props} />);

    act(() => {
      controller.write(
        `${Array.from({ length: 8 }, (_, index) => `line-${index + 1}`).join("\r\n")}\r\n\u001b[?1000h\u001b[?1006h`
      );
    });

    const viewport = container.querySelector(".retro-screen__viewport") as HTMLDivElement | null;
    const root = container.querySelector(".retro-screen") as HTMLElement | null;
    expect(viewport).not.toBeNull();
    expect(root).not.toBeNull();

    fireEvent.wheel(viewport!, {
      deltaY: -120,
      clientX: 36,
      clientY: 6
    });

    expect(Number(root?.getAttribute("data-buffer-offset") ?? "0")).toBeGreaterThan(0);
    expect(session.writeInput).not.toHaveBeenCalled();
  });

  it("does not emit focus reports when captureFocusReport is disabled", () => {
    const session = createMockTerminalSession();
    const controller = createRetroScreenController({ rows: 3, cols: 12 });
    const onTerminalData = vi.fn();
    const { container } = render(
      <RetroScreen
        mode="terminal"
        session={session}
        controller={controller}
        captureFocusReport={false}
        onTerminalData={onTerminalData}
        gridMode="static"
        rows={3}
        cols={12}
      />
    );

    act(() => {
      controller.write("\u001b[?1004h");
    });

    const viewport = container.querySelector(".retro-screen__viewport") as HTMLDivElement | null;
    expect(viewport).not.toBeNull();

    fireEvent.focus(viewport!);
    fireEvent.blur(viewport!);

    expect(onTerminalData).not.toHaveBeenCalled();
    expect(session.writeInput).not.toHaveBeenCalled();
  });

  it("autofocuses the terminal viewport in terminal mode", () => {
    const { container } = render(
      <RetroScreen mode="terminal" autoFocus gridMode="static" rows={3} cols={12} />
    );

    const viewport = container.querySelector(".retro-screen__viewport") as HTMLDivElement | null;
    expect(viewport).not.toBeNull();
    expect(document.activeElement).toBe(viewport);
  });

  it("renders ansi cell styles from terminal snapshots", () => {
    const controller = createRetroScreenController({ rows: 2, cols: 8 });
    const { container } = render(<RetroScreen mode="terminal" controller={controller} />);

    act(() => {
      controller.write("\u001b[1mA\u001b[2mB\u001b[7mC\u001b[8mD\u001b[5mE");
    });

    expect(container.querySelector(".retro-screen__cell--bold")).not.toBeNull();
    expect(container.querySelector(".retro-screen__cell--faint")).not.toBeNull();
    expect(container.querySelector(".retro-screen__cell--inverse")).not.toBeNull();
    expect(container.querySelector(".retro-screen__cell--conceal")).not.toBeNull();
    expect(container.querySelector(".retro-screen__cell--blink")).not.toBeNull();
  });

  it("top-aligns ANSI cell rows so inline cell baselines do not introduce visual seams", () => {
    const controller = createRetroScreenController({ rows: 2, cols: 8 });
    const { container } = render(<RetroScreen mode="terminal" controller={controller} />);

    act(() => {
      controller.write("\u001b[31;44mAB");
    });

    const line = container.querySelector(".retro-screen__line") as HTMLElement | null;
    expect(line).not.toBeNull();
    expect(line?.classList.contains("retro-screen__line--cells")).toBe(true);
  });

  it("can disable row scale transforms for ANSI cell rows", () => {
    const controller = createRetroScreenController({ rows: 2, cols: 8 });
    const { container } = render(
      <RetroScreen mode="terminal" controller={controller} disableCellRowScale />
    );

    act(() => {
      controller.write("\u001b[31;44mAB");
    });

    const root = container.querySelector(".retro-screen") as HTMLElement | null;
    const line = container.querySelector(".retro-screen__line--cells") as HTMLElement | null;

    expect(root).not.toBeNull();
    expect(root).toHaveAttribute("data-disable-cell-row-scale", "true");
    expect(line).not.toBeNull();
  });

  it("can disable scanlines on the display surface", () => {
    const { container } = render(<RetroScreen mode="value" value="ANSI" displayScanlines={false} />);
    const root = container.querySelector(".retro-screen") as HTMLElement | null;

    expect(root).not.toBeNull();
    expect(root).toHaveAttribute("data-display-scanlines", "false");
  });

  it("projects ANSI semantic colors through the ansi-classic display mode", () => {
    const controller = createRetroScreenController({ rows: 2, cols: 8 });
    const { container } = render(
      <RetroScreen mode="terminal" controller={controller} displayColorMode="ansi-classic" />
    );

    act(() => {
      controller.write("\u001b[31;44mA");
    });

    const cell = container.querySelector(".retro-screen__cell") as HTMLElement | null;
    expect(cell).not.toBeNull();
    expect(window.getComputedStyle(cell!).color).not.toBe("rgb(151, 255, 155)");
    expect(window.getComputedStyle(cell!).backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
  });

  it("projects indexed and truecolor cells through the ansi-extended display mode", () => {
    const controller = createRetroScreenController({ rows: 2, cols: 8 });
    const { container } = render(
      <RetroScreen mode="terminal" controller={controller} displayColorMode="ansi-extended" />
    );

    act(() => {
      controller.write("\u001b[38;5;196;48;5;25mA\u001b[38;2;17;34;51;48;2;68;85;102mB");
    });

    const cells = Array.from(container.querySelectorAll(".retro-screen__cell")) as HTMLElement[];
    expect(cells.length).toBeGreaterThanOrEqual(2);
    expect(window.getComputedStyle(cells[0]!).color).toBe("rgb(255, 0, 0)");
    expect(window.getComputedStyle(cells[1]!).color).toBe("rgb(17, 34, 51)");
    expect(window.getComputedStyle(cells[1]!).backgroundColor).toBe("rgb(68, 85, 102)");
  });

  it("switches to a light surface mode while keeping the phosphor accent readable", () => {
    const { container } = render(
      <RetroScreen
        mode="value"
        value="grid"
        displayColorMode="phosphor-green"
        displaySurfaceMode="light"
      />
    );

    const root = container.querySelector(".retro-screen") as HTMLElement | null;
    expect(root).not.toBeNull();
    expect(root).toHaveAttribute("data-display-surface-mode", "light");
    expect(root?.style.getPropertyValue("--retro-screen-color")).not.toBe("#97ff9b");
    expect(root?.style.getPropertyValue("--retro-screen-bg-bottom")).toBe("#edf5e7");
  });

  it("keeps ansi foreground and background colors legible in light surface mode", () => {
    const controller = createRetroScreenController({ rows: 2, cols: 8 });
    const { container } = render(
      <RetroScreen
        mode="terminal"
        controller={controller}
        displayColorMode="ansi-extended"
        displaySurfaceMode="light"
      />
    );

    act(() => {
      controller.write("\u001b[38;5;196;48;5;25mA");
    });

    const cell = container.querySelector(".retro-screen__cell") as HTMLElement | null;
    expect(cell).not.toBeNull();

    const computedStyle = window.getComputedStyle(cell!);
    expect(getContrastRatio(computedStyle.color, computedStyle.backgroundColor)).toBeGreaterThan(4.5);
  });

  it("renders prompt mode with the default prompt character", () => {
    const { container } = render(<RetroScreen mode="prompt" value="status" />);

    expect(getBodyText(container)).toContain("> status");
  });

  it("submits accepted prompt commands and prints the response protocol", async () => {
    const user = userEvent.setup();
    const onCommand = vi.fn(async () => ({
      accepted: true as const,
      response: ["alpha", "beta"]
    }));
    const view = render(<RetroScreen mode="prompt" onCommand={onCommand} autoFocus />);
    const { container } = view;

    const input = container.querySelector(".retro-screen__input") as HTMLTextAreaElement | null;
    expect(input).not.toBeNull();
    await user.type(input!, "help{enter}");

    expect(onCommand).toHaveBeenCalledWith("help");
    const bodyText = getBodyText(container);
    expect(bodyText).toContain("> help");
    expect(bodyText).toContain("OK");
    expect(bodyText).toContain("alpha");
    expect(bodyText).toContain("beta");
    expect(bodyText).toContain("> ");
  });

  it("submits rejected prompt commands with ERROR", async () => {
    const user = userEvent.setup();
    const view = render(
      <RetroScreen
        mode="prompt"
        onCommand={async () => ({
          accepted: false as const
        })}
        autoFocus
      />
    );
    const { container } = view;

    const input = container.querySelector(".retro-screen__input") as HTMLTextAreaElement | null;
    expect(input).not.toBeNull();
    await user.type(input!, "bad{enter}");

    const bodyText = getBodyText(container);
    expect(bodyText).toContain("> bad");
    expect(bodyText).toContain("ERROR");
    expect(bodyText).toContain("> ");
  });

  it("applies the configured color and emits geometry", () => {
    const onGeometryChange = vi.fn();
    const { container } = render(
      <RetroScreen
        mode="value"
        value="grid"
        color="#66ff88"
        onGeometryChange={onGeometryChange}
      />
    );

    const root = container.querySelector(".retro-screen");
    expect(root?.style.getPropertyValue("--retro-screen-color")).toBe("#66ff88");
    expect(root).toHaveAttribute("data-rows");
    expect(root).toHaveAttribute("data-cols");
    expect(onGeometryChange).toHaveBeenCalledWith(
      expect.objectContaining({
        rows: expect.any(Number),
        cols: expect.any(Number)
      })
    );
  });

  it("supports uniform and side-specific display padding", () => {
    const uniformView = render(<RetroScreen mode="value" value="grid" displayPadding={10} />);
    const uniformRoot = uniformView.container.querySelector(".retro-screen") as HTMLElement | null;

    expect(uniformRoot?.style.getPropertyValue("--retro-screen-padding-top")).toBe("10px");
    expect(uniformRoot?.style.getPropertyValue("--retro-screen-padding-right")).toBe("10px");

    uniformView.unmount();

    const sideView = render(
      <RetroScreen
        mode="value"
        value="grid"
        displayPadding={{ block: 12, inline: "1.5rem", top: 6 }}
      />
    );
    const sideRoot = sideView.container.querySelector(".retro-screen") as HTMLElement | null;

    expect(sideRoot?.style.getPropertyValue("--retro-screen-padding-top")).toBe("6px");
    expect(sideRoot?.style.getPropertyValue("--retro-screen-padding-right")).toBe("1.5rem");
    expect(sideRoot?.style.getPropertyValue("--retro-screen-padding-bottom")).toBe("12px");
    expect(sideRoot?.style.getPropertyValue("--retro-screen-padding-left")).toBe("1.5rem");
  });

  it("supports scaling the rendered glyphs inside each screen cell", () => {
    const { container } = render(
      <RetroScreen mode="value" value="grid" displayFontScale={1.22} displayRowScale={1.08} />
    );

    const root = container.querySelector(".retro-screen") as HTMLElement | null;
    expect(root?.style.getPropertyValue("--retro-screen-font-scale")).toBe("1.22");
    expect(root?.style.getPropertyValue("--retro-screen-row-scale")).toBe("1.08");
  });

  it("supports a static grid mode with caller-supplied rows and columns", () => {
    const onGeometryChange = vi.fn();
    const { container } = render(
      <RetroScreen
        mode="value"
        value="grid"
        gridMode="static"
        rows={4}
        cols={18}
        onGeometryChange={onGeometryChange}
      />
    );

    const root = container.querySelector(".retro-screen");
    expect(root).toHaveAttribute("data-grid-mode", "static");
    expect(root).toHaveAttribute("data-rows", "4");
    expect(root).toHaveAttribute("data-cols", "18");
    expect(onGeometryChange).toHaveBeenCalledWith(
      expect.objectContaining({
        rows: 4,
        cols: 18
      })
    );
  });

  it("exposes the configured display layout mode on the root", () => {
    const { container } = render(
      <RetroScreen mode="value" value="grid" gridMode="static" rows={4} cols={18} displayLayoutMode="fit-width" />
    );

    const root = container.querySelector(".retro-screen");
    expect(root).toHaveAttribute("data-display-layout-mode", "fit-width");
    expect(root).not.toHaveAttribute("data-resizable");
    expect(root).toHaveStyle({
      width: "",
      maxWidth: ""
    });
  });

  it("exposes the configured display font sizing mode on the root", () => {
    const { container } = render(
      <RetroScreen
        mode="value"
        value="grid"
        gridMode="static"
        rows={4}
        cols={18}
        displayFontSizingMode="fit-cols"
      />
    );

    const root = container.querySelector(".retro-screen");
    expect(root).toHaveAttribute("data-display-font-sizing-mode", "fit-cols");
    expect(root).toHaveAttribute("data-layout-strategy", "static-fit-width");
  });

  it("supports browser font-driven character sizing for static value mode", () => {
    const { container } = render(
      <RetroScreen
        mode="value"
        value={"X".repeat(18)}
        gridMode="static"
        rows={4}
        cols={18}
        displayCharacterSizingMode="font"
      />
    );

    const root = container.querySelector(".retro-screen");
    expect(root).toHaveAttribute("data-display-character-sizing-mode", "font");
  });

  it("can render a lightweight debug overlay for layout diagnostics", () => {
    const { container } = render(
      <RetroScreen
        mode="value"
        value="debug"
        gridMode="static"
        rows={4}
        cols={18}
        displayDebugOverlay
      />
    );

    const overlay = container.querySelector(".retro-screen__debug-overlay");
    expect(overlay).not.toBeNull();
    expect(overlay?.textContent).toContain("grid 18x4");
  });

  it("centers value-mode content within the larger grid using snapped content dimensions", () => {
    const { container } = render(
      <RetroScreen
        mode="value"
        value={"X".repeat(18)}
        gridMode="static"
        rows={4}
        cols={18}
        style={{ width: 420, height: 260 }}
      />
    );

    const root = container.querySelector(".retro-screen") as HTMLDivElement | null;
    const content = container.querySelector(".retro-screen__content") as HTMLDivElement | null;

    expect(root).not.toBeNull();
    expect(content).not.toBeNull();
    expect(root!.style.getPropertyValue("--retro-screen-content-width")).not.toBe("");
    expect(root!.style.getPropertyValue("--retro-screen-content-height")).not.toBe("");
    expect(content).toHaveClass("retro-screen__content--centered");
  });

  it("switches the base palette when a phosphor display color mode is selected", () => {
    const { container } = render(<RetroScreen mode="value" value="grid" displayColorMode="phosphor-amber" />);

    const root = container.querySelector(".retro-screen");
    expect(root?.style.getPropertyValue("--retro-screen-color")).toBe("#ffc96b");
    expect(root).toHaveAttribute("data-display-color-mode", "phosphor-amber");
  });

  it("shows a solid cursor for focused editable value mode", () => {
    const { container } = render(
      <RetroScreen mode="value" value="draft" editable autoFocus cursorMode="solid" />
    );

    expect(container.querySelector(".retro-screen__cursor")).toHaveAttribute(
      "data-cursor-mode",
      "solid"
    );
  });

  it("renders placeholder dimming with the same color as faint ansi cells", () => {
    const placeholderView = render(
      <RetroScreen mode="value" value="" placeholder="What are you thinking about?" />
    );

    const placeholderLine = placeholderView.container.querySelector(
      ".retro-screen__line"
    ) as HTMLElement | null;
    expect(placeholderLine).not.toBeNull();
    const placeholderColor = window.getComputedStyle(placeholderLine!).color;

    placeholderView.unmount();

    const controller = createRetroScreenController({ rows: 2, cols: 24 });
    const faintView = render(<RetroScreen mode="terminal" controller={controller} />);

    act(() => {
      controller.write("\u001b[2mOK\u001b[0m");
    });

    const faintCell = faintView.container.querySelector(".retro-screen__cell--faint") as
      | HTMLElement
      | null;
    expect(faintCell).not.toBeNull();

    expect(window.getComputedStyle(faintCell!).color).toBe(placeholderColor);
  });

  it("updates the rendered cursor mode when the controller changes it", () => {
    const controller = createRetroScreenController({ rows: 2, cols: 12, cursorMode: "solid" });
    const view = render(<RetroScreen mode="terminal" controller={controller} />);

    act(() => {
      controller.write("status");
    });

    const cursor = view.container.querySelector(".retro-screen__cursor") as HTMLElement | null;
    expect(cursor).not.toBeNull();
    expect(cursor).toHaveAttribute("data-cursor-mode", "solid");

    act(() => {
      controller.setCursorMode("hollow");
    });

    expect(cursor).toHaveAttribute("data-cursor-mode", "hollow");
  });

  it("allows shift-enter line breaks in editable value mode without submitting", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    const Harness = () => {
      const [value, setValue] = useState("");

      return (
        <RetroScreen
          mode="value"
          value={value}
          editable
          autoFocus
          onChange={(nextValue) => {
            setValue(nextValue);
            onChange(nextValue);
          }}
          onSubmit={onSubmit}
        />
      );
    };
    const { container } = render(<Harness />);

    const input = container.querySelector(".retro-screen__input") as HTMLTextAreaElement | null;
    expect(input).not.toBeNull();

    await user.type(input!, "first line{Shift>}{Enter}{/Shift}second line");

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith("first line\n");
    expect(onChange).toHaveBeenCalledWith("first line\nsecond line");
  });

  it("emits focus changes for editable value mode", async () => {
    const user = userEvent.setup();
    const onFocusChange = vi.fn();
    render(
      <>
        <RetroScreen mode="value" value="" editable onFocusChange={onFocusChange} />
        <button type="button">outside</button>
      </>
    );

    await user.click(screen.getByLabelText("RetroScreen input"));
    await user.click(screen.getByRole("button", { name: "outside" }));

    expect(onFocusChange).toHaveBeenNthCalledWith(1, true);
    expect(onFocusChange).toHaveBeenNthCalledWith(2, false);
  });

  it("enables a focus glow by default and tracks the active focus state", async () => {
    const user = userEvent.setup();
    const view = render(
      <>
        <RetroScreen mode="value" value="" editable />
        <button type="button">outside</button>
      </>
    );

    const root = view.container.querySelector(".retro-screen") as HTMLDivElement | null;
    expect(root).not.toBeNull();
    expect(root?.getAttribute("data-focus-glow")).toBe("true");
    expect(root?.getAttribute("data-focused")).toBe("false");

    await user.click(screen.getByLabelText("RetroScreen input"));
    expect(root?.getAttribute("data-focused")).toBe("true");

    await user.click(screen.getByRole("button", { name: "outside" }));
    expect(root?.getAttribute("data-focused")).toBe("false");
  });

  it("allows the focus glow to be disabled explicitly", async () => {
    const user = userEvent.setup();
    const view = render(<RetroScreen mode="value" value="" editable focusGlow={false} />);
    const root = view.container.querySelector(".retro-screen") as HTMLDivElement | null;

    expect(root).not.toBeNull();
    expect(root?.getAttribute("data-focus-glow")).toBe("false");

    await user.click(screen.getByLabelText("RetroScreen input"));
    expect(root?.getAttribute("data-focused")).toBe("true");
    expect(root?.getAttribute("data-focus-glow")).toBe("false");
  });

  it("keeps the cursor at the end when editable text is appended externally", () => {
    const appendedValue = "Compose inline.\nPress Enter when the thought lands.";
    const { container, rerender } = render(
      <RetroScreen mode="value" value="Compose inline." editable autoFocus />
    );

    const input = container.querySelector(".retro-screen__input") as HTMLTextAreaElement | null;
    expect(input).not.toBeNull();

    act(() => {
      input!.focus();
      input!.setSelectionRange(input!.value.length, input!.value.length);
    });

    rerender(<RetroScreen mode="value" value={appendedValue} editable autoFocus />);

    const root = container.querySelector(".retro-screen") as HTMLElement | null;
    const cursor = container.querySelector(".retro-screen__cursor") as HTMLElement | null;
    expect(root).not.toBeNull();
    expect(cursor).not.toBeNull();
    expect(input!.selectionStart).toBe(appendedValue.length);

    const cols = Number(root!.getAttribute("data-cols"));
    const wrappedLines = wrapTextToColumns(appendedValue, { cols });
    const expectedRow = wrappedLines.length - 1;
    const expectedCol = wrappedLines[expectedRow]?.length ?? 0;

    expect(cursor!.style.getPropertyValue("--retro-screen-cursor-row")).toBe(String(expectedRow));
    expect(cursor!.style.getPropertyValue("--retro-screen-cursor-col")).toBe(String(expectedCol));
  });

  it("supports mouse drag selection in editor mode", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <RetroScreen mode="editor" value="ABCD" editable autoFocus gridMode="static" rows={3} cols={4} />
    );

    mockScreenRect(container, {
      x: 0,
      y: 0,
      width: 48,
      height: 72
    });

    const viewport = container.querySelector(".retro-screen__viewport") as HTMLDivElement | null;
    const input = container.querySelector(".retro-screen__input") as HTMLTextAreaElement | null;
    expect(viewport).not.toBeNull();
    expect(input).not.toBeNull();

    fireEvent.mouseDown(viewport!, {
      clientX: 13,
      clientY: 12
    });
    fireEvent.mouseMove(viewport!, {
      clientX: 35,
      clientY: 12
    });
    fireEvent.mouseUp(viewport!, {
      clientX: 35,
      clientY: 12
    });

    const selectedCells = Array.from(container.querySelectorAll(".retro-screen__cell--selected"));
    expect(selectedCells.map((cell) => cell.getAttribute("data-source-offset"))).toEqual(["1", "2"]);
    expect(document.activeElement).toBe(input);

    await user.keyboard("{Backspace}");

    expect(getBodyText(container)).toContain("AD");
    expect(container.querySelectorAll(".retro-screen__cell--selected")).toHaveLength(0);
  });

  it("deletes reverse-drag editor selections with the Delete key", async () => {
    const user = userEvent.setup();
    const Harness = () => {
      const [value, setValue] = useState("ABCD");

      return (
        <RetroScreen
          mode="editor"
          value={value}
          onChange={setValue}
          autoFocus
          gridMode="static"
          rows={3}
          cols={4}
        />
      );
    };
    const { container } = render(<Harness />);

    mockScreenRect(container, {
      x: 0,
      y: 0,
      width: 48,
      height: 72
    });

    const viewport = container.querySelector(".retro-screen__viewport") as HTMLDivElement | null;
    expect(viewport).not.toBeNull();

    fireEvent.mouseDown(viewport!, {
      clientX: 35,
      clientY: 12
    });
    fireEvent.mouseMove(viewport!, {
      clientX: 13,
      clientY: 12
    });
    fireEvent.mouseUp(viewport!, {
      clientX: 13,
      clientY: 12
    });

    const selectedCells = Array.from(container.querySelectorAll(".retro-screen__cell--selected"));
    expect(selectedCells.map((cell) => cell.getAttribute("data-source-offset"))).toEqual(["1", "2"]);

    await user.keyboard("{Delete}");

    expect(getBodyText(container)).toContain("AD");
    expect(container.querySelectorAll(".retro-screen__cell--selected")).toHaveLength(0);
  });

  it("supports keyboard word selection shortcuts in editor mode", () => {
    const { container } = render(
      <RetroScreen
        mode="editor"
        value="retro display tty"
        editable
        autoFocus
        gridMode="static"
        rows={4}
        cols={18}
      />
    );

    const input = container.querySelector(".retro-screen__input") as HTMLTextAreaElement | null;
    expect(input).not.toBeNull();

    act(() => {
      input!.focus();
      input!.setSelectionRange(0, 0);
      fireEvent.select(input!);
    });

    fireEvent.keyDown(input!, {
      key: "ArrowRight",
      ctrlKey: true,
      shiftKey: true
    });

    expect(input!.selectionStart).toBe(0);
    expect(input!.selectionEnd).toBe(5);
    expect(
      Array.from(container.querySelectorAll(".retro-screen__cell--selected")).map((cell) =>
        cell.getAttribute("data-source-offset")
      )
    ).toEqual(["0", "1", "2", "3", "4"]);
  });

  it("supports clipboard copy, cut, and paste in editor mode", () => {
    const Harness = () => {
      const [value, setValue] = useState("retro display tty");

      return (
        <RetroScreen
          mode="editor"
          value={value}
          onChange={setValue}
          editable
          autoFocus
          gridMode="static"
          rows={4}
          cols={18}
        />
      );
    };
    const { container } = render(<Harness />);

    const input = container.querySelector(".retro-screen__input") as HTMLTextAreaElement | null;
    expect(input).not.toBeNull();

    act(() => {
      input!.focus();
      input!.setSelectionRange(6, 13);
      fireEvent.select(input!);
    });

    const copyData = createClipboardData();
    fireEvent.copy(input!, { clipboardData: copyData });
    expect(copyData.setData).toHaveBeenCalledWith("text/plain", "display");

    const cutData = createClipboardData();
    fireEvent.cut(input!, { clipboardData: cutData });
    expect(cutData.setData).toHaveBeenCalledWith("text/plain", "display");
    expect(input!.value).toBe("retro  tty");

    act(() => {
      input!.focus();
      input!.setSelectionRange(6, 6);
      fireEvent.select(input!);
    });

    const pasteData = createClipboardData();
    pasteData.getData.mockReturnValue("signal");
    fireEvent.paste(input!, { clipboardData: pasteData });
    expect(input!.value).toBe("retro signal tty");
  });

  it("double-click selects a whole word in editor mode", () => {
    const { container } = render(
      <RetroScreen
        mode="editor"
        value="retro display tty"
        editable
        autoFocus
        gridMode="static"
        rows={4}
        cols={18}
      />
    );

    mockScreenRect(container, {
      x: 0,
      y: 0,
      width: 216,
      height: 96
    });

    const viewport = container.querySelector(".retro-screen__viewport") as HTMLDivElement | null;
    const input = container.querySelector(".retro-screen__input") as HTMLTextAreaElement | null;
    expect(viewport).not.toBeNull();
    expect(input).not.toBeNull();

    fireEvent.doubleClick(viewport!, {
      clientX: 102,
      clientY: 12
    });

    expect(input!.selectionStart).toBe(6);
    expect(input!.selectionEnd).toBe(13);
    expect(
      Array.from(container.querySelectorAll(".retro-screen__cell--selected")).map((cell) =>
        cell.getAttribute("data-source-offset")
      )
    ).toEqual(["6", "7", "8", "9", "10", "11", "12"]);
  });

  it("pages through terminal scrollback and restores auto-follow at the bottom", () => {
    const controller = createRetroScreenController({ rows: 3, cols: 12, scrollback: 12 });
    const { container } = render(<RetroScreen mode="terminal" controller={controller} />);

    act(() => {
      controller.write(
        Array.from({ length: 12 }, (_, index) => `line-${index + 1}`).join("\r\n")
      );
    });

    const root = container.querySelector(".retro-screen") as HTMLElement | null;
    const viewport = container.querySelector(".retro-screen__viewport") as HTMLElement | null;
    expect(root).not.toBeNull();
    expect(viewport).not.toBeNull();

    const initialLines = getVisibleLines(container);
    expect(Number(root?.getAttribute("data-buffer-max-offset") ?? "0")).toBeGreaterThan(0);
    expect(initialLines.join("")).toContain("line-12");

    act(() => {
      viewport!.focus();
      fireEvent.keyDown(viewport!, { key: "PageUp" });
    });

    const pagedLines = getVisibleLines(container);
    expect(Number(root?.getAttribute("data-buffer-offset") ?? "0")).toBeGreaterThan(0);
    expect(root).toHaveAttribute("data-auto-follow", "false");
    expect(pagedLines).not.toEqual(initialLines);

    act(() => {
      fireEvent.keyDown(viewport!, { key: "PageDown" });
    });

    expect(root).toHaveAttribute("data-buffer-offset", "0");
    expect(root).toHaveAttribute("data-auto-follow", "true");
    expect(getVisibleLines(container)).toEqual(initialLines);
  });

  it("supports mouse-wheel scrolling and keeps the viewport anchored while auto-follow is off", () => {
    const controller = createRetroScreenController({ rows: 2, cols: 12, scrollback: 12 });
    const { container } = render(<RetroScreen mode="terminal" controller={controller} />);

    act(() => {
      controller.write(
        Array.from({ length: 12 }, (_, index) => `line-${index + 1}`).join("\r\n")
      );
    });

    const root = container.querySelector(".retro-screen") as HTMLElement | null;
    const viewport = container.querySelector(".retro-screen__viewport") as HTMLElement | null;
    expect(root).not.toBeNull();
    expect(viewport).not.toBeNull();

    act(() => {
      fireEvent.wheel(viewport!, { deltaY: -240 });
    });

    const scrolledLines = getVisibleLines(container);
    const offsetWhileScrolled = Number(root?.getAttribute("data-buffer-offset") ?? "0");
    expect(offsetWhileScrolled).toBeGreaterThan(0);
    expect(root).toHaveAttribute("data-auto-follow", "false");

    act(() => {
      controller.write("\r\nline-13");
    });

    expect(Number(root?.getAttribute("data-buffer-offset") ?? "0")).toBeGreaterThan(
      offsetWhileScrolled
    );
    expect(getVisibleLines(container)).toEqual(scrolledLines);

    act(() => {
      fireEvent.wheel(viewport!, { deltaY: 1200 });
    });

    expect(root).toHaveAttribute("data-buffer-offset", "0");
    expect(root).toHaveAttribute("data-auto-follow", "true");
    expect(getVisibleLines(container).join("")).toContain("line-13");
  });

  it("limits internal terminal scrollback when bufferSize is configured", () => {
    const { container } = render(
      <RetroScreen
        mode="terminal"
        bufferSize={2}
        value={Array.from({ length: 12 }, (_, index) => `line-${index + 1}`).join("\r\n")}
      />
    );

    const root = container.querySelector(".retro-screen") as HTMLElement | null;
    expect(root).not.toBeNull();
    expect(root).toHaveAttribute("data-buffer-max-offset", "2");
  });

  it("renders alternate-screen terminal output without exposing primary scrollback", () => {
    const controller = createRetroScreenController({ rows: 2, cols: 8, scrollback: 8 });
    const { container } = render(
      <RetroScreen mode="terminal" controller={controller} gridMode="static" rows={2} cols={8} />
    );

    act(() => {
      controller.write("main\r\nshell");
      controller.write("\u001b[?1049h");
      controller.write("ALT");
    });

    const root = container.querySelector(".retro-screen") as HTMLElement | null;
    expect(root).not.toBeNull();
    expect(root).toHaveAttribute("data-terminal-alternate-screen", "true");
    expect(getVisibleLines(container)).toEqual(["ALT     ", "        "]);

    act(() => {
      controller.write("\u001b[?1049l");
    });

    expect(root).toHaveAttribute("data-terminal-alternate-screen", "false");
    expect(getVisibleLines(container)).toEqual(["main    ", "shell   "]);
  });
});
