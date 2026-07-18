import { act, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RetroScreenAnsiBytePlayer } from "./RetroScreenAnsiBytePlayer";
import type { RetroScreenAnsiBytePlayerState } from "./useRetroScreenAnsiBytePlayer";

const encoder = new TextEncoder();
const createCanvasContext = () => ({
  imageSmoothingEnabled: true,
  createImageData: (width: number, height: number) => ({
    data: new Uint8ClampedArray(width * height * 4),
    width,
    height
  }),
  putImageData: vi.fn()
}) as unknown as CanvasRenderingContext2D;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RetroScreenAnsiBytePlayer", () => {
  it("renders ANSI playback through the canvas backend without cell DOM", async () => {
    const context = createCanvasContext();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
    const { container } = render(
      <RetroScreenAnsiBytePlayer
        rows={1}
        cols={4}
        byteStream={[encoder.encode("ABCD")]}
        complete
        drain
        displayGlyphMode="ibm-vga-8x16"
        renderBackend="canvas"
      />
    );

    expect(container.querySelector(".retro-screen")?.getAttribute("data-render-backend")).toBe("canvas");
    expect(container.querySelectorAll(".retro-screen__line")).toHaveLength(0);
    expect(container.querySelectorAll(".retro-screen__cell")).toHaveLength(0);
    expect(container.querySelectorAll("[data-retro-screen-bitmap-canvas='true']")).toHaveLength(1);
    await waitFor(() => expect(context.putImageData).toHaveBeenCalled());
  });

  it("drains a closed source without waiting for real-time baud", async () => {
    const onPlaybackStateChange = vi.fn();
    const { container } = render(
      <RetroScreenAnsiBytePlayer
        rows={2}
        cols={8}
        byteStream={[encoder.encode("\u001b[2;3HZ")]}
        complete
        drain
        onPlaybackStateChange={onPlaybackStateChange}
      />
    );

    await waitFor(() => {
      const state = onPlaybackStateChange.mock.calls.at(-1)?.[0] as
        | RetroScreenAnsiBytePlayerState
        | undefined;
      expect(state).toMatchObject({
        status: "complete",
        processedBytes: 7,
        totalBytes: 7,
        parserSettled: true
      });
    });

    expect(container.querySelector(".retro-screen__body")?.textContent).toContain("Z");
  });

  it("coalesces byte advancement to animation frames and cancels on unmount", async () => {
    const callbacks = new Map<number, FrameRequestCallback>();
    let nextId = 1;
    const request = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      const id = nextId++;
      callbacks.set(id, callback);
      return id;
    });
    const cancel = vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
      callbacks.delete(id);
    });
    const onPlaybackStateChange = vi.fn();
    const { unmount } = render(
      <RetroScreenAnsiBytePlayer
        rows={1}
        cols={4}
        baud={8_000}
        byteStream={[encoder.encode("ABCD")]}
        complete
        onPlaybackStateChange={onPlaybackStateChange}
      />
    );

    await waitFor(() => expect(callbacks.size).toBe(1));
    const first = callbacks.values().next().value as FrameRequestCallback;
    callbacks.clear();

    act(() => first(performance.now() + 10));

    await waitFor(() => {
      const state = onPlaybackStateChange.mock.calls.at(-1)?.[0] as
        | RetroScreenAnsiBytePlayerState
        | undefined;
      expect(state?.processedBytes).toBe(4);
      expect(state?.status).toBe("complete");
    });

    expect(callbacks.size).toBe(0);
    unmount();
    expect(cancel).toHaveBeenCalled();
  });
});
