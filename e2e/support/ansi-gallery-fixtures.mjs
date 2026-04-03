import { gunzipSync } from "node:zlib";
import { readFile } from "node:fs/promises";

const manifestUrl = new URL("../../public/ansi-gallery/manifest.json", import.meta.url);
const galleryRootUrl = new URL("../../public/ansi-gallery/", import.meta.url);

export const loadAnsiGalleryManifest = async () =>
  JSON.parse(await readFile(manifestUrl, "utf8"));

export const selectAnsiGalleryItemsByIds = async (ids) => {
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

export const loadAnsiGalleryFixture = async (item, { maxBytes } = {}) => {
  const assetUrl = new URL(item.assetPath || item.url, galleryRootUrl);
  const gzipBytes = await readFile(assetUrl);
  const bytes = new Uint8Array(gunzipSync(gzipBytes));

  return {
    name: item.id,
    rows: item.height || 25,
    cols: item.width || 80,
    bytes: typeof maxBytes === "number" && maxBytes > 0 ? bytes.slice(0, maxBytes) : bytes,
    item
  };
};

export const formatAnsiGalleryFailureContext = ({ item, reproduction }) =>
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
