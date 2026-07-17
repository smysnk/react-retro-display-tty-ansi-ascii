import { useEffect, useMemo, useState } from "react";
import { RetroScreenAnsiBytePlayer as RetroScreenAnsiPlayer } from "../react/RetroScreenAnsiBytePlayer";
import type { RetroScreenAnsiBytePlayerState as RetroScreenAnsiPlayerState } from "../react/useRetroScreenAnsiBytePlayer";
import { streamGzipAnsiAsset, type GzipAnsiStreamAsset } from "./gzip-ansi-stream";

type AnsiGalleryManifestItem = {
  id: string;
  index: number;
  filename: string;
  sourceZipPath: string;
  sourceEntryName: string;
  sizeBytes: number;
  gzipSizeBytes: number;
  width: number;
  height: number;
  title: string;
  author: string;
  group: string;
  font: string;
  url: string;
};

type AnsiGalleryManifest = {
  count: number;
  generatedAt: string;
  sourceRoot: string;
  totalSizeBytes: number;
  totalGzipSizeBytes: number;
  items: readonly AnsiGalleryManifestItem[];
};

const resolveGalleryManifestUrl = () => new URL("ansi-gallery/manifest.json", window.location.href);

const formatByteCount = (value: number) => {
  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(value / 1024))} KB`;
};

export function AnsiGalleryViewer() {
  const [manifest, setManifest] = useState<AnsiGalleryManifest | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [asset, setAsset] = useState<GzipAnsiStreamAsset | null>(null);
  const [assetState, setAssetState] = useState<"loading" | "ready" | "failed">("loading");
  const [playerState, setPlayerState] = useState<RetroScreenAnsiPlayerState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    fetch(resolveGalleryManifestUrl())
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Unable to load ANSI gallery manifest (${response.status}).`);
        }

        return (await response.json()) as AnsiGalleryManifest;
      })
      .then((nextManifest) => {
        if (!active) {
          return;
        }

        setManifest(nextManifest);
        setCurrentIndex(0);
        setAssetState("loading");
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        console.error("ANSI gallery manifest failed to load.", error);
        setErrorMessage(error instanceof Error ? error.message : String(error));
        setAssetState("failed");
      });

    return () => {
      active = false;
    };
  }, []);

  const selectedEntry = manifest?.items[currentIndex] ?? null;
  const manifestUrl = useMemo(() => (typeof window === "undefined" ? null : resolveGalleryManifestUrl()), []);

  useEffect(() => {
    if (!manifest || !selectedEntry || !manifestUrl) {
      return;
    }

    const abortController = new AbortController();
    let active = true;
    const assetUrl = new URL(selectedEntry.url, manifestUrl).toString();

    setAsset(null);
    setPlayerState(null);
    setErrorMessage(null);
    setAssetState("loading");

    streamGzipAnsiAsset({
      url: assetUrl,
      signal: abortController.signal,
      fallbackMetadata: {
        title: selectedEntry.title,
        author: selectedEntry.author,
        group: selectedEntry.group,
        font: selectedEntry.font,
        width: selectedEntry.width,
        height: selectedEntry.height
      },
      onUpdate(nextAsset) {
        if (!active) {
          return;
        }

        setAsset(nextAsset);
        setAssetState(nextAsset.complete ? "ready" : "loading");
      }
    }).catch((error) => {
      if (!active || (error instanceof DOMException && error.name === "AbortError")) {
        return;
      }

      console.error("ANSI gallery asset failed to load.", error);
      setErrorMessage(error instanceof Error ? error.message : String(error));
      setAssetState("failed");
    });

    return () => {
      active = false;
      abortController.abort();
    };
  }, [manifest, manifestUrl, selectedEntry]);

  useEffect(() => {
    if (!manifest || manifest.items.length === 0) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        setCurrentIndex((current) => (current + 1) % manifest.items.length);
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        setCurrentIndex((current) => (current - 1 + manifest.items.length) % manifest.items.length);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [manifest]);

  return (
    <div
      style={{
        alignItems: "center",
        background:
          "radial-gradient(circle at top, rgba(151, 255, 155, 0.08), transparent 38%), #060906",
        color: "#97ff9b",
        display: "flex",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "32px 24px"
      }}
    >
      <div
        style={{
          alignItems: "center",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          width: "100%"
        }}
      >
        <RetroScreenAnsiPlayer
          rows={asset?.height ?? selectedEntry?.height ?? 25}
          cols={asset?.width ?? selectedEntry?.width ?? 80}
          byteStream={asset ? asset.byteStream : []}
          baud={14_400}
          complete={asset?.complete ?? false}
          loop={Boolean(asset?.complete)}
          onPlaybackStateChange={setPlayerState}
          displayColorMode="ansi-classic"
          displayFontScale={1.08}
          displayRowScale={1.04}
          displayPadding={{ block: 8, inline: 12 }}
          style={{
            height: "min(78vh, 860px)",
            maxWidth: "min(94vw, 1500px)",
            width: "min(94vw, 1500px)"
          }}
        />
        <div
          style={{
            display: "flex",
            fontFamily:
              '"IBM Plex Mono", "SFMono-Regular", "Menlo", "Consolas", monospace',
            fontSize: "13px",
            gap: "18px",
            justifyContent: "center",
            letterSpacing: "0.03em",
            opacity: 0.9,
            textAlign: "center",
            textTransform: "uppercase",
            width: "100%"
          }}
        >
          <span>
            {manifest && selectedEntry
              ? `${String(currentIndex + 1).padStart(3, "0")} / ${String(manifest.items.length).padStart(3, "0")}`
              : "Loading"}
          </span>
          <span>{selectedEntry?.filename ?? "Preparing ANSI gallery..."}</span>
          <span>
            {selectedEntry
              ? `${selectedEntry.width}x${selectedEntry.height} · ${formatByteCount(selectedEntry.sizeBytes)} raw · ${formatByteCount(selectedEntry.gzipSizeBytes)} gzip`
              : "ANSI gallery"}
          </span>
          <span>
            {selectedEntry
              ? asset?.complete
                ? "Loaded"
                : `Streaming ${formatByteCount(asset?.streamedByteCount ?? 0)}`
              : "Waiting"}
          </span>
          <span>{playerState ? `${playerState.processedBytes}/${playerState.totalBytes ?? "..."} bytes` : "Arrow keys browse"}</span>
        </div>
      </div>
    </div>
  );
}
