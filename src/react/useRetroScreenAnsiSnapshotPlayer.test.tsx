import { render, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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
});
