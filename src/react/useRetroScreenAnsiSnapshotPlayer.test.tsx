import { act, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  type RetroScreenAnsiSnapshotPlayerState,
  useRetroScreenAnsiSnapshotPlayer
} from "./useRetroScreenAnsiSnapshotPlayer";

describe("useRetroScreenAnsiSnapshotPlayer", () => {
  it("resolves source geometry from metadata and exposes the current frame as line arrays", async () => {
    const encoder = new TextEncoder();
    let latestState: RetroScreenAnsiSnapshotPlayerState | null = null;

    function Harness() {
      const state = useRetroScreenAnsiSnapshotPlayer({
        byteStream: [encoder.encode("\u001b[1;1HAB\u001b[2;3HCD")],
        metadata: {
          title: "demo",
          author: "artist",
          group: "crew",
          font: "IBM VGA",
          width: 6,
          height: 3,
        },
        complete: true,
      });

      latestState = state;
      return <output data-testid="snapshot-state">{state.displayValue}</output>;
    }

    render(<Harness />);

    await waitFor(() => {
      expect(latestState).not.toBeNull();
      expect(latestState?.sourceRows).toBe(3);
      expect(latestState?.sourceCols).toBe(6);
      expect(latestState?.storageMode).toBe("eager");
      expect(latestState?.frameCount).toBe(1);
      expect(latestState?.lines).toEqual([
        "AB    ",
        "  CD  ",
        "      ",
      ]);
      expect(latestState?.frameSnapshot.getLineSlice?.(1, 2, 4)).toBe("CD");
      expect(latestState?.displayValue).toBe("AB    \n  CD  \n      ");
    });
  });

  it("exposes styled ANSI cells through the frame snapshot", async () => {
    const encoder = new TextEncoder();
    let latestState: RetroScreenAnsiSnapshotPlayerState | null = null;

    function Harness() {
      const state = useRetroScreenAnsiSnapshotPlayer({
        byteStream: [encoder.encode("\u001b[31;44mA \u001b[93;102mB")],
        metadata: {
          title: "color",
          author: "artist",
          group: "crew",
          font: "IBM VGA",
          width: 4,
          height: 2,
        },
        complete: true,
      });

      latestState = state;
      return <output data-testid="snapshot-state">{state.displayValue}</output>;
    }

    render(<Harness />);

    await waitFor(() => {
      const coloredSlice = latestState?.frameSnapshot.getCellSlice?.(0, 0, 4) ?? [];

      expect(coloredSlice[0]).toMatchObject({
        char: "A",
        style: {
          foreground: {
            mode: "palette",
            value: 1,
          },
          background: {
            mode: "palette",
            value: 4,
          },
        },
      });
      expect(coloredSlice[2]).toMatchObject({
        char: "B",
        style: {
          foreground: {
            mode: "palette",
            value: 11,
          },
          background: {
            mode: "palette",
            value: 10,
          },
        },
      });
    });
  });

  it("threads DOS immediate wrapping through streamed React playback", async () => {
    const encoder = new TextEncoder();
    let latestState: RetroScreenAnsiSnapshotPlayerState | null = null;

    function Harness() {
      const state = useRetroScreenAnsiSnapshotPlayer({
        byteStream: [encoder.encode("ABCD\u001b[31m\r\nEF")],
        metadata: {
          title: "dos-wrap",
          author: "artist",
          group: "crew",
          font: "IBM VGA",
          width: 4,
          height: 3,
        },
        complete: true,
        wrapMode: "dos-immediate",
      });

      latestState = state;
      return <output data-testid="snapshot-state">{state.displayValue}</output>;
    }

    render(<Harness />);

    await waitFor(() => {
      expect(latestState?.lines).toEqual([
        "ABCD",
        "    ",
        "EF  ",
      ]);
    });
  });

  it("threads canvas scrolling through streamed React playback", async () => {
    const encoder = new TextEncoder();
    let latestState: RetroScreenAnsiSnapshotPlayerState | null = null;

    function Harness() {
      const state = useRetroScreenAnsiSnapshotPlayer({
        byteStream: [encoder.encode("ABCD\r\nEFGH\r\n")],
        metadata: {
          title: "canvas-scroll",
          author: "artist",
          group: "crew",
          font: "IBM VGA",
          width: 4,
          height: 3,
        },
        complete: true,
        scrollMode: "canvas",
        wrapMode: "dos-immediate",
      });

      latestState = state;
      return <output data-testid="snapshot-state">{state.displayValue}</output>;
    }

    render(<Harness />);

    await waitFor(() => {
      expect(latestState?.lines).toEqual([
        "ABCD",
        "    ",
        "EFGH",
      ]);
    });
  });

  it("returns sparse frame accessors for huge source geometries", async () => {
    const encoder = new TextEncoder();
    let latestState: RetroScreenAnsiSnapshotPlayerState | null = null;

    function Harness() {
      const state = useRetroScreenAnsiSnapshotPlayer({
        byteStream: [encoder.encode("\u001b[1;20479HXY")],
        metadata: {
          title: "huge",
          author: "artist",
          group: "crew",
          font: "IBM VGA",
          width: 20_480,
          height: 25,
        },
        complete: true,
      });

      latestState = state;
      return <output data-testid="snapshot-state">{state.displayValue}</output>;
    }

    render(<Harness />);

    await waitFor(() => {
      expect(latestState).not.toBeNull();
      expect(latestState?.sourceCols).toBe(20_480);
      expect(latestState?.storageMode).toBe("sparse");
      expect(latestState?.frameSnapshot.storageMode).toBe("sparse");
      expect(latestState?.frameSnapshot.getLineSlice?.(0, 20_478, 20_480)).toBe("XY");
      expect(latestState?.lines).toHaveLength(25);
      expect(latestState?.displayValue.length ?? 0).toBeLessThanOrEqual(25 * 80 + 24);
    });
  });

  it("can lock directly to the final frame when complete playback uses a non-positive frame delay", async () => {
    const encoder = new TextEncoder();
    let latestState: RetroScreenAnsiSnapshotPlayerState | null = null;

    function Harness() {
      const state = useRetroScreenAnsiSnapshotPlayer({
        byteStream: [encoder.encode("\u001b[2;1Htail\u001b[1;1Hhead")],
        metadata: {
          title: "frames",
          author: "artist",
          group: "crew",
          font: "IBM VGA",
          width: 8,
          height: 2,
        },
        complete: true,
        frameDelayMs: 0,
      });

      latestState = state;
      return <output data-testid="snapshot-state">{state.displayValue}</output>;
    }

    render(<Harness />);

    await waitFor(() => {
      expect(latestState?.frameCount).toBe(2);
      expect(latestState?.frameIndex).toBe(1);
      expect(latestState?.displayValue).toBe("head    \ntail    ");
    });

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 32));
    });

    expect(latestState?.frameIndex).toBe(1);
    expect(latestState?.displayValue).toBe("head    \ntail    ");
  });

  it("loops across completed snapshot frames when looping playback is enabled", async () => {
    const encoder = new TextEncoder();
    let latestState: RetroScreenAnsiSnapshotPlayerState | null = null;
    let scheduledFrame: FrameRequestCallback | null = null;
    let now = 0;
    const performanceNowSpy = vi
      .spyOn(performance, "now")
      .mockImplementation(() => now);
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        scheduledFrame = callback;
        return 1;
      });
    const cancelAnimationFrameSpy = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => {});

    function Harness() {
      const state = useRetroScreenAnsiSnapshotPlayer({
        byteStream: [
          encoder.encode("\u001b[2;1Htail"),
          encoder.encode("\u001b[1;1Hhead"),
        ],
        metadata: {
          title: "looping",
          author: "artist",
          group: "crew",
          font: "IBM VGA",
          width: 8,
          height: 2,
        },
        complete: true,
        loop: true,
        frameDelayMs: 10,
      });

      latestState = state;
      return <output data-testid="snapshot-state">{state.displayValue}</output>;
    }

    try {
      render(<Harness />);

      await act(async () => {
        await Promise.resolve();
      });

      expect(latestState?.frameCount).toBe(2);
      expect(latestState?.frameIndex).toBe(0);
      expect(latestState?.displayValue).toBe("        \ntail    ");

      await act(async () => {
        now = 12;
        scheduledFrame?.(now);
        await Promise.resolve();
      });

      expect(latestState?.frameIndex).toBe(1);
      expect(latestState?.displayValue).toBe("head    \ntail    ");

      await act(async () => {
        now = 22;
        scheduledFrame?.(now);
        await Promise.resolve();
      });

      expect(latestState?.frameIndex).toBe(0);
      expect(latestState?.displayValue).toBe("        \ntail    ");
    } finally {
      performanceNowSpy.mockRestore();
      requestAnimationFrameSpy.mockRestore();
      cancelAnimationFrameSpy.mockRestore();
    }
  });

  it("resets cleanly when the byte stream shrinks to a shorter payload", async () => {
    const encoder = new TextEncoder();
    let latestState: RetroScreenAnsiSnapshotPlayerState | null = null;

    function Harness({
      byteStream,
      complete,
    }: {
      byteStream: readonly Uint8Array[];
      complete: boolean;
    }) {
      const state = useRetroScreenAnsiSnapshotPlayer({
        byteStream,
        metadata: {
          title: "reset",
          author: "artist",
          group: "crew",
          font: "IBM VGA",
          width: 8,
          height: 2,
        },
        complete,
        frameDelayMs: 10,
      });

      latestState = state;
      return <output data-testid="snapshot-state">{state.displayValue}</output>;
    }

    const firstChunk = encoder.encode("\u001b[2;1Htail");
    const secondChunk = encoder.encode("\u001b[1;1Hhead");
    const { rerender } = render(
      <Harness byteStream={[firstChunk, secondChunk]} complete />
    );

    await waitFor(() => {
      expect(latestState?.frameCount).toBe(2);
      expect(latestState?.displayValue).toBe("        \ntail    ");
    });

    rerender(<Harness byteStream={[firstChunk]} complete={false} />);

    await waitFor(() => {
      expect(latestState?.frameCount).toBe(0);
      expect(latestState?.frameIndex).toBe(0);
      expect(latestState?.displayValue).toBe("        \ntail    ");
      expect(latestState?.displayValue).not.toContain("head");
    });
  });
});
