import { gunzipSync } from "node:zlib";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { RetroScreenByteParityFixture } from "../types";

export type RetroScreenAnsiGalleryManifestItem = {
  assetPath: string;
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

type RetroScreenAnsiGalleryManifest = {
  count: number;
  generatedAt: string;
  sourceRoot: string;
  totalSizeBytes: number;
  totalGzipSizeBytes: number;
  items: RetroScreenAnsiGalleryManifestItem[];
};

const conformanceDir =
  typeof import.meta.dirname === "string" ? import.meta.dirname : dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(conformanceDir, "../../../../..");
const galleryRoot = resolve(projectRoot, "public/ansi-gallery");
const manifestPath = resolve(galleryRoot, "manifest.json");

export const isAnsiGalleryCorpusAvailable = () => existsSync(manifestPath);

export type RetroScreenAnsiGalleryFixtureLoadOptions = {
  maxBytes?: number;
};

export const loadAnsiGalleryManifest = async (): Promise<RetroScreenAnsiGalleryManifest> =>
  JSON.parse(await readFile(manifestPath, "utf8")) as RetroScreenAnsiGalleryManifest;

export const loadAnsiGalleryFixture = async (
  item: RetroScreenAnsiGalleryManifestItem,
  options: RetroScreenAnsiGalleryFixtureLoadOptions = {}
): Promise<RetroScreenByteParityFixture> => {
  const assetPath = resolve(galleryRoot, item.assetPath || item.url);
  const gzipBytes = await readFile(assetPath);
  const bytes = new Uint8Array(gunzipSync(gzipBytes));
  const maxBytes = options.maxBytes;

  return {
    name: item.id,
    description: `${item.title || item.filename} (${item.filename}) from the ANSI gallery corpus.`,
    rows: item.height || 25,
    cols: item.width || 80,
    bytes: typeof maxBytes === "number" && maxBytes > 0 ? bytes.slice(0, maxBytes) : bytes
  };
};

export const selectAnsiGalleryItemsByIds = async (ids: readonly string[]) => {
  const manifest = await loadAnsiGalleryManifest();
  const index = new Map(manifest.items.map((item) => [item.id, item]));

  return ids.map((id) => {
    const item = index.get(id);

    if (!item) {
      throw new Error(`Unknown ANSI gallery item id: ${id}`);
    }

    return item;
  });
};

export const formatAnsiGalleryFailureContext = ({
  item,
  reproduction
}: {
  item: RetroScreenAnsiGalleryManifestItem;
  reproduction: string;
}) =>
  [
    `gallery id: ${item.id}`,
    `file: ${item.filename}`,
    `title: ${item.title || "ANSI Stream"}`,
    `author: ${item.author || "Unknown"}`,
    `group: ${item.group || "Unknown"}`,
    `geometry: ${item.width}x${item.height}`,
    `source zip: ${item.sourceZipPath}`,
    reproduction
  ].join("\n");

export const loadAnsiGalleryFixtures = async () => {
  const manifest = await loadAnsiGalleryManifest();
  return Promise.all(
    manifest.items.map(async (item) => ({
      item,
      fixture: await loadAnsiGalleryFixture(item)
    }))
  );
};
