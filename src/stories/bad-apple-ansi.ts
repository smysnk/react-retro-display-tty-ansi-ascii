import badAppleAnsiUrl from "./assets/bad-apple.ans?url";
import {
  loadAnsiAsset,
  type LoadedAnsiAsset
} from "../../examples/readme/ansi-art-playback/BadAppleAnsiPlayback";
import {
  type RetroScreenAnsiMetadata
} from "../core/ansi/player";

export type BadAppleAnsiAsset = {
  url: string;
  complete: true;
} & LoadedAnsiAsset & RetroScreenAnsiMetadata;

let badAppleAnsiPromise: Promise<BadAppleAnsiAsset> | null = null;

export const loadBadAppleAnsiAsset = () => {
  if (badAppleAnsiPromise) {
    return badAppleAnsiPromise;
  }

  badAppleAnsiPromise = loadAnsiAsset(badAppleAnsiUrl).then((asset) => {
    return {
      ...asset,
      url: badAppleAnsiUrl,
      complete: true
    } satisfies BadAppleAnsiAsset;
  });

  return badAppleAnsiPromise;
};
