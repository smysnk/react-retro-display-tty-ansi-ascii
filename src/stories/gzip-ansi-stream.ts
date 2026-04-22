import {
  parseRetroScreenAnsiSauce,
  stripRetroScreenAnsiSauce,
  type RetroScreenAnsiByteChunk,
  type RetroScreenAnsiMetadata
} from "../core/ansi/player";

const ANSI_STREAM_SAUCE_HOLDBACK_BYTES = 129;
const DEFAULT_ANSI_STREAM_COLS = 80;
const DEFAULT_ANSI_STREAM_ROWS = 25;

export type GzipAnsiStreamAsset = {
  byteStream: readonly RetroScreenAnsiByteChunk[];
  frameDelayMs: number;
  url: string;
  complete: boolean;
  streamedByteCount: number;
} & RetroScreenAnsiMetadata;

export const concatUint8Arrays = (chunks: readonly Uint8Array[]) => {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return merged;
};

export const takeAnsiPayloadChunkWithSauceHoldback = (
  pendingTail: Uint8Array,
  nextChunk: Uint8Array,
  holdbackBytes = ANSI_STREAM_SAUCE_HOLDBACK_BYTES
) => {
  const combined = concatUint8Arrays([pendingTail, nextChunk]);

  if (combined.length <= holdbackBytes) {
    return {
      emitChunk: new Uint8Array(0),
      pendingTail: combined
    };
  }

  const emitLength = combined.length - holdbackBytes;

  return {
    emitChunk: combined.slice(0, emitLength),
    pendingTail: combined.slice(emitLength)
  };
};

const normalizeMetadataDimension = (value: number | null | undefined, fallback: number) => {
  const parsed = Math.floor(Number(value ?? Number.NaN));

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

const resolveFinalMetadata = (
  pendingTail: Uint8Array,
  fallbackMetadata: RetroScreenAnsiMetadata | null = null
): RetroScreenAnsiMetadata => {
  const parsedMetadata = parseRetroScreenAnsiSauce(pendingTail);

  if (parsedMetadata.hasSauce) {
    return parsedMetadata;
  }

  return {
    title: fallbackMetadata?.title ?? parsedMetadata.title,
    author: fallbackMetadata?.author ?? parsedMetadata.author,
    group: fallbackMetadata?.group ?? parsedMetadata.group,
    font: fallbackMetadata?.font ?? parsedMetadata.font,
    width: normalizeMetadataDimension(fallbackMetadata?.width, DEFAULT_ANSI_STREAM_COLS),
    height: normalizeMetadataDimension(fallbackMetadata?.height, DEFAULT_ANSI_STREAM_ROWS),
    hasSauce: false,
    geometrySource: "fallback"
  };
};

export const finalizeAnsiPayloadFromSauceTail = (
  pendingTail: Uint8Array,
  {
    fallbackMetadata = null
  }: {
    fallbackMetadata?: RetroScreenAnsiMetadata | null;
  } = {}
) => ({
  metadata: resolveFinalMetadata(pendingTail, fallbackMetadata),
  payloadBytes: stripRetroScreenAnsiSauce(pendingTail)
});

const createAssetSnapshot = ({
  byteStream,
  complete,
  metadata,
  streamedByteCount,
  frameDelayMs,
  url
}: {
  byteStream: readonly RetroScreenAnsiByteChunk[];
  complete: boolean;
  metadata: RetroScreenAnsiMetadata;
  streamedByteCount: number;
  frameDelayMs: number;
  url: string;
}) =>
  ({
    ...metadata,
    byteStream: [...byteStream],
    complete,
    frameDelayMs,
    streamedByteCount,
    url
  }) satisfies GzipAnsiStreamAsset;

const getGzipResponseBody = async (response: Response) => {
  if (response.body) {
    return response.body;
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  return new Response(bytes).body;
};

const getDecompressedResponseBody = async (response: Response) => {
  const body = await getGzipResponseBody(response);
  if (!body) {
    return null;
  }

  const contentEncoding = response.headers.get("content-encoding")?.toLowerCase() ?? "";
  if (contentEncoding.includes("gzip")) {
    return body;
  }

  if (typeof DecompressionStream === "undefined") {
    throw new Error(
      "This demo requires browser support for HTTP gzip decoding or DecompressionStream(\"gzip\")."
    );
  }

  return body.pipeThrough(new DecompressionStream("gzip"));
};

export const streamGzipAnsiAsset = async ({
  url,
  onUpdate,
  signal,
  fallbackMetadata,
  frameDelayMs = 72
}: {
  url: string;
  onUpdate: (asset: GzipAnsiStreamAsset) => void;
  signal?: AbortSignal;
  fallbackMetadata: RetroScreenAnsiMetadata;
  frameDelayMs?: number;
}) => {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Unable to load gzipped ANSI asset (${response.status}).`);
  }

  const decompressedBody = await getDecompressedResponseBody(response);
  if (!decompressedBody) {
    throw new Error("Unable to create a readable stream for the gzipped ANSI asset.");
  }

  const reader = decompressedBody.getReader();
  const emittedChunks: Uint8Array[] = [];
  let pendingTail = new Uint8Array(0);
  let streamedByteCount = 0;

  onUpdate(
    createAssetSnapshot({
      byteStream: emittedChunks,
      complete: false,
      metadata: fallbackMetadata,
      streamedByteCount,
      frameDelayMs,
      url
    })
  );

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    if (!(value instanceof Uint8Array) || value.length === 0) {
      continue;
    }

    const { emitChunk, pendingTail: nextPendingTail } = takeAnsiPayloadChunkWithSauceHoldback(
      pendingTail,
      value
    );

    pendingTail = nextPendingTail;

    if (emitChunk.length === 0) {
      continue;
    }

    emittedChunks.push(emitChunk);
    streamedByteCount += emitChunk.length;

    onUpdate(
      createAssetSnapshot({
        byteStream: emittedChunks,
        complete: false,
        metadata: fallbackMetadata,
        streamedByteCount,
        frameDelayMs,
        url
      })
    );
  }

  const { metadata, payloadBytes } = finalizeAnsiPayloadFromSauceTail(pendingTail, {
    fallbackMetadata
  });

  if (payloadBytes.length > 0) {
    emittedChunks.push(payloadBytes);
    streamedByteCount += payloadBytes.length;
  }

  const finalAsset = createAssetSnapshot({
    byteStream: emittedChunks,
    complete: true,
    metadata,
    streamedByteCount,
    frameDelayMs,
    url
  });

  onUpdate(finalAsset);

  return finalAsset;
};
