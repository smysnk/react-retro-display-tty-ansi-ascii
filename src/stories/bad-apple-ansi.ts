import badAppleAnsiUrl from "./assets/bad-apple.ans?url";
import {
  parseRetroScreenAnsiSauce,
  splitRetroScreenAnsiBytes,
  stripRetroScreenAnsiSauce,
  type RetroScreenAnsiByteChunk,
  type RetroScreenAnsiMetadata
} from "../core/ansi/player";

export type BadAppleAnsiAsset = {
  byteStream: readonly RetroScreenAnsiByteChunk[];
  url: string;
  complete: true;
} & RetroScreenAnsiMetadata;

let badAppleAnsiPromise: Promise<BadAppleAnsiAsset> | null = null;

const loadBadAppleAnsiBytes = async () => {
  const response = await fetch(badAppleAnsiUrl);
  if (!response.ok) {
    throw new Error(`Unable to load Bad Apple ANSI asset (${response.status}).`);
  }

  return new Uint8Array(await response.arrayBuffer());
};

export const loadBadAppleAnsiAsset = () => {
  if (badAppleAnsiPromise) {
    return badAppleAnsiPromise;
  }

  badAppleAnsiPromise = loadBadAppleAnsiBytes().then((bytes) => {
    const sauce = parseRetroScreenAnsiSauce(bytes);
    const byteStream = splitRetroScreenAnsiBytes(stripRetroScreenAnsiSauce(bytes), 4096);

    return {
      ...sauce,
      byteStream,
      url: badAppleAnsiUrl,
      complete: true
    } satisfies BadAppleAnsiAsset;
  });

  return badAppleAnsiPromise;
};
