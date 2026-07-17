import { ansiDisplayFacingCommandInventory } from "../terminal/conformance/ansi-sequence-matrix";

export type RetroScreenArtworkAnsiSupport = "implemented" | "partial" | "deferred";

const implementedInventoryIds = new Set([
  "c0-line-feed",
  "c0-carriage-return",
  "c0-backspace",
  "c0-tab",
  "c0-vertical-tab",
  "c0-form-feed",
  "csi-cursor-relative",
  "csi-cursor-position",
  "csi-ech",
  "csi-erase-line",
  "csi-save-restore-cursor",
  "sgr-visible-styling"
]);

const partialInventoryIds = new Set([
  "csi-erase-display"
]);

export const artworkAnsiControlInventory = ansiDisplayFacingCommandInventory.map((entry) => ({
  ...entry,
  artworkSupport: implementedInventoryIds.has(entry.id)
    ? "implemented"
    : partialInventoryIds.has(entry.id)
      ? "partial"
      : "deferred"
})) satisfies Array<
  (typeof ansiDisplayFacingCommandInventory)[number] & {
    artworkSupport: RetroScreenArtworkAnsiSupport;
  }
>;

export const artworkAnsiAdditionalControlCases = [
  {
    id: "c0-bell",
    description: "BEL is consumed without changing artwork pixels.",
    sequence: "\u0007",
    artworkSupport: "implemented"
  },
  {
    id: "csi-cancel-can",
    description: "CAN cancels a pending CSI sequence.",
    sequence: "\u001b[31\u0018Z",
    artworkSupport: "implemented"
  },
  {
    id: "csi-cancel-sub",
    description: "SUB cancels a pending CSI sequence.",
    sequence: "\u001b[31\u001aZ",
    artworkSupport: "implemented"
  }
] as const;

export const artworkAnsiImplementedSequences = [
  ...artworkAnsiControlInventory
    .filter((entry) => entry.artworkSupport === "implemented")
    .flatMap((entry) =>
      entry.sequences.map((sequence, index) => ({
        id: `${entry.id}-${index}`,
        sequence
      }))
    ),
  ...artworkAnsiAdditionalControlCases.map((entry) => ({
    id: entry.id,
    sequence: entry.sequence
  }))
];
