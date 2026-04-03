import { describe, expect, it } from "vitest";
import { createHeadlessByteParityAdapter } from "./headless-byte-parity-adapter";
import { createRetroByteParityAdapter } from "./retro-byte-parity-adapter";
import { formatByteParityReport } from "./format-byte-parity-diff";
import {
  formatAnsiGalleryFailureContext,
  isAnsiGalleryCorpusAvailable,
  loadAnsiGalleryFixture,
  loadAnsiGalleryFixtures,
  loadAnsiGalleryManifest,
  selectAnsiGalleryItemsByIds
} from "./fixtures/ansi-gallery-corpus";
import { runSampledByteParity } from "./run-sampled-byte-parity";

const galleryLimit = Number.parseInt(process.env.ANSI_GALLERY_PARITY_LIMIT ?? "", 10);
const galleryWarmupBytes = Number.parseInt(process.env.ANSI_GALLERY_PARITY_WARMUP_BYTES ?? "", 10);
const gallerySampleEvery = Number.parseInt(process.env.ANSI_GALLERY_PARITY_SAMPLE_EVERY ?? "", 10);
const galleryIds = (process.env.ANSI_GALLERY_PARITY_IDS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const galleryCorpusAvailable = isAnsiGalleryCorpusAvailable();
const galleryManifestIt = galleryCorpusAvailable ? it : it.skip;
const maybeGalleryReplayIt =
  process.env.ANSI_GALLERY_PARITY === "1" && galleryCorpusAvailable ? it : it.skip;

describe("real tty byte parity ansi gallery corpus", () => {
  galleryManifestIt("tracks the full ansi gallery manifest locally", async () => {
    const manifest = await loadAnsiGalleryManifest();

    expect(manifest.count).toBeGreaterThanOrEqual(1);
    expect(manifest.items.length).toBe(manifest.count);
  });

  maybeGalleryReplayIt("replays every ansi-gallery asset through the sampled parity runner", async () => {
    const entries =
      galleryIds.length > 0
        ? (await selectAnsiGalleryItemsByIds(galleryIds)).map((item) => ({
            item,
            fixture: undefined
          }))
        : await loadAnsiGalleryFixtures();
    const selectedEntries =
      Number.isFinite(galleryLimit) && galleryLimit > 0 ? entries.slice(0, galleryLimit) : entries;

    for (const entry of selectedEntries) {
      const fixture = entry.fixture ?? (await loadAnsiGalleryFixture(entry.item));
      const result = await runSampledByteParity({
        fixture,
        retroScreen: createRetroByteParityAdapter(fixture),
        reference: createHeadlessByteParityAdapter(fixture),
        sampling: {
          mode: "sample-after-warmup",
          warmupBytes:
            Number.isFinite(galleryWarmupBytes) && galleryWarmupBytes >= 0 ? galleryWarmupBytes : 64,
          sampleEvery:
            Number.isFinite(gallerySampleEvery) && gallerySampleEvery > 0 ? gallerySampleEvery : 65536,
          locateExactMismatch: true
        }
      });

      expect(
        result.mismatch,
        `${formatAnsiGalleryFailureContext({
          item: entry.item,
          reproduction: result.reproduction
        })}\n${formatByteParityReport(result)}`
      ).toBeNull();
    }
  }, 300_000);
});
