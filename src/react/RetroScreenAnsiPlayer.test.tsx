import { render, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { RetroScreenAnsiPlayer } from "./RetroScreenAnsiPlayer";
import type { RetroScreenAnsiPlayerState } from "./useRetroScreenAnsiPlayer";

const getBodyText = (container: HTMLElement) =>
  container.querySelector(".retro-screen__body")?.textContent?.replace(/\u00a0/gu, " ") ?? "";

describe("RetroScreenAnsiPlayer", () => {
  it("renders streamed ANSI bytes without requiring RetroScreen to load files", async () => {
    const encoder = new TextEncoder();
    const states: RetroScreenAnsiPlayerState[] = [];
    const { container, rerender } = render(
      <RetroScreenAnsiPlayer
        rows={2}
        cols={6}
        byteStream={[]}
        loadingValue="waiting"
        onPlaybackStateChange={(state) => {
          states.push(state);
        }}
      />
    );

    expect(getBodyText(container)).toContain("waiting");

    rerender(
      <RetroScreenAnsiPlayer
        rows={2}
        cols={6}
        byteStream={[encoder.encode("\u001b[1;1HAB")]}
        loadingValue="waiting"
        onPlaybackStateChange={(state) => {
          states.push(state);
        }}
      />
    );

    await waitFor(() => {
      expect(getBodyText(container)).toContain("AB");
    });

    expect(states.at(-1)?.isStreaming).toBe(true);
  });

  it("continues playback as additional byte chunks arrive", async () => {
    const encoder = new TextEncoder();
    const onPlaybackStateChange = vi.fn();
    const firstChunk = encoder.encode("\u001b[24;1Htail");
    const secondChunk = encoder.encode("\u001b[1;1Hhead");
    const { container, rerender } = render(
      <RetroScreenAnsiPlayer
        rows={25}
        cols={8}
        byteStream={[firstChunk]}
        frameDelayMs={72}
        onPlaybackStateChange={onPlaybackStateChange}
      />
    );

    await waitFor(() => {
      expect(getBodyText(container)).toContain("tail");
    });

    rerender(
      <RetroScreenAnsiPlayer
        rows={25}
        cols={8}
        byteStream={[firstChunk, secondChunk]}
        frameDelayMs={72}
        onPlaybackStateChange={onPlaybackStateChange}
      />
    );

    await waitFor(() => {
      const bodyText = getBodyText(container);
      expect(bodyText).toContain("head");
      expect(bodyText).toContain("tail");
    });

    expect(onPlaybackStateChange).toHaveBeenCalled();
    expect(
      onPlaybackStateChange.mock.calls.some(
        ([state]) => (state as RetroScreenAnsiPlayerState).frameCount >= 1
      )
    ).toBe(true);
  });

  it("does not recurse when the playback callback stores state in the parent", async () => {
    const encoder = new TextEncoder();

    function Harness() {
      const [state, setState] = useState<RetroScreenAnsiPlayerState | null>(null);

      return (
        <>
          <RetroScreenAnsiPlayer
            rows={2}
            cols={6}
            byteStream={[encoder.encode("\u001b[1;1HAB")]}
            frameDelayMs={10_000}
            complete
            onPlaybackStateChange={setState}
          />
          <output data-testid="frame-status">
            {state ? `${state.frameIndex}/${state.frameCount}` : "pending"}
          </output>
        </>
      );
    }

    const { getByTestId } = render(<Harness />);

    await waitFor(() => {
      expect(getByTestId("frame-status").textContent).toBe("0/1");
    });
  });
});
