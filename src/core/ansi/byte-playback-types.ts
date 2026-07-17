import type { RetroScreenAnsiSnapshotFrame } from "./player";

export type RetroScreenAnsiBytePlaybackStatus =
  | "idle"
  | "buffering"
  | "playing"
  | "paused"
  | "complete";

export type RetroScreenAnsiBytePlaybackState = {
  status: RetroScreenAnsiBytePlaybackStatus;
  baud: number;
  availableBytes: number;
  processedBytes: number;
  totalBytes: number | null;
  sourceClosed: boolean;
  parserSettled: boolean;
  elapsedMs: number;
  estimatedDurationMs: number | null;
  loopCount: number;
  blinkVisible: boolean;
};

export type RetroScreenAnsiBytePlaybackEngine = {
  appendSource: (chunk: Uint8Array | ArrayBuffer | ArrayLike<number>) => void;
  closeSource: () => RetroScreenAnsiBytePlaybackState;
  advanceBytes: (count: number) => RetroScreenAnsiBytePlaybackState;
  advanceTime: (elapsedMs: number) => RetroScreenAnsiBytePlaybackState;
  drain: () => RetroScreenAnsiBytePlaybackState;
  pause: () => RetroScreenAnsiBytePlaybackState;
  resume: () => RetroScreenAnsiBytePlaybackState;
  restart: () => RetroScreenAnsiBytePlaybackState;
  loop: () => RetroScreenAnsiBytePlaybackState;
  setBaud: (baud: number) => RetroScreenAnsiBytePlaybackState;
  getPlaybackState: () => RetroScreenAnsiBytePlaybackState;
  getScreenSnapshot: () => RetroScreenAnsiSnapshotFrame;
  reset: () => RetroScreenAnsiBytePlaybackState;
};
