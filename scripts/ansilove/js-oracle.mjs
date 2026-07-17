import { readFile } from "node:fs/promises";
import vm from "node:vm";

import { ansiloveJsVendorPath } from "./oracle-paths.mjs";

let oraclePromise;

const loadOracle = async () => {
  const context = vm.createContext({
    self: {},
    console,
    Uint8Array,
    Uint8ClampedArray,
    ArrayBuffer,
    DataView,
    Math,
    Number,
    String,
    Object,
    Array,
    Error,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval
  });
  vm.runInContext(await readFile(ansiloveJsVendorPath, "utf8"), context, {
    filename: ansiloveJsVendorPath
  });

  if (!context.AnsiLove) {
    throw new Error("Vendored Ansilove.js did not expose AnsiLove.");
  }

  return context.AnsiLove;
};

export const getAnsiloveJsOracle = () => {
  oraclePromise ??= loadOracle();
  return oraclePromise;
};

export const renderAnsiloveJsBytes = async (bytes, options = {}) => {
  const oracle = await getAnsiloveJsOracle();
  let result;
  let failure;

  oracle.renderBytes(
    Uint8Array.from(bytes),
    (displayData, sauce) => {
      result = {
        width: displayData.width,
        height: displayData.height,
        data: Uint8Array.from(displayData.rgbaData),
        sauce
      };
    },
    {
      imagedata: 1,
      filetype: "ans",
      font: "80x25",
      bits: "8",
      icecolors: 0,
      thumbnail: 0,
      "2x": 0,
      ...options
    },
    (error) => {
      failure = error;
    }
  );

  if (failure) {
    throw new Error(`Ansilove.js render failed: ${String(failure)}`);
  }

  if (!result) {
    throw new Error("Ansilove.js render did not return image data.");
  }

  return result;
};
