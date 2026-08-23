import { useEffect, useState } from "react";
import {
  RetroScreenAnsiPlayer,
  parseRetroScreenAnsiSauce,
  splitRetroScreenAnsiBytes,
  stripRetroScreenAnsiSauce,
  type RetroScreenAnsiByteChunk,
  type RetroScreenAnsiMetadata
} from "react-retro-display-tty-ansi-ascii";
import "react-retro-display-tty-ansi-ascii/styles.css";

export type LoadedAnsiAsset = RetroScreenAnsiMetadata & {
  byteStream: readonly RetroScreenAnsiByteChunk[];
};

export const loadAnsiAsset = async (assetUrl: string): Promise<LoadedAnsiAsset> => {
  const response = await fetch(assetUrl);
  if (!response.ok) {
    throw new Error(`Unable to load ANSI asset (${response.status}).`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  return {
    ...parseRetroScreenAnsiSauce(bytes),
    byteStream: splitRetroScreenAnsiBytes(stripRetroScreenAnsiSauce(bytes), 4096)
  };
};

export function BadAppleAnsiPlayback({ assetUrl }: { assetUrl: string }) {
  const [asset, setAsset] = useState<LoadedAnsiAsset | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    loadAnsiAsset(assetUrl)
      .then((nextAsset) => {
        if (active) setAsset(nextAsset);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : String(reason));
      });

    return () => {
      active = false;
    };
  }, [assetUrl]);

  if (error) return <p role="alert">{error}</p>;
  if (!asset) return <p>Loading ANSI artwork…</p>;

  return (
    <RetroScreenAnsiPlayer
      byteStream={asset.byteStream}
      rows={asset.height}
      cols={asset.width}
      baud={14_400}
      complete
      loop
      canvasAccessibleText={false}
      canvasAccessibilityLabel={`${asset.title} by ${asset.author}`}
      displayColorMode="ansi-classic"
      displayGlyphMode="ibm-vga-8x16"
      displayLayoutMode="fit-width"
      displayPadding={0}
      displayScanlines={false}
      renderBackend="canvas"
      style={{ width: "100%" }}
    />
  );
}
