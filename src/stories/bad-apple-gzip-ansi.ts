import badAppleAnsiGzipUrl from "./assets/bad-apple.ans.gz?url";
import type { RetroScreenAnsiMetadata } from "../core/ansi/player";
import {
  finalizeAnsiPayloadFromSauceTail,
  takeAnsiPayloadChunkWithSauceHoldback,
  concatUint8Arrays,
  streamGzipAnsiAsset,
  type GzipAnsiStreamAsset
} from "./gzip-ansi-stream";

const BAD_APPLE_GZIP_FALLBACK_METADATA = {
  title: "Bad Apple!!",
  author: "NDH",
  group: "Mistigris",
  font: "IBM VGA",
  width: 80,
  height: 25
} satisfies RetroScreenAnsiMetadata;

export type BadAppleGzipAnsiAsset = GzipAnsiStreamAsset;

export {
  concatUint8Arrays,
  finalizeAnsiPayloadFromSauceTail,
  takeAnsiPayloadChunkWithSauceHoldback
};

export const streamBadAppleGzipAnsiAsset = ({
  onUpdate,
  signal
}: {
  onUpdate: (asset: BadAppleGzipAnsiAsset) => void;
  signal?: AbortSignal;
}) =>
  streamGzipAnsiAsset({
    url: badAppleAnsiGzipUrl,
    onUpdate,
    signal,
    fallbackMetadata: BAD_APPLE_GZIP_FALLBACK_METADATA
  });
