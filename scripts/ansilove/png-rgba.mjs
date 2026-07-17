import { inflateSync } from "node:zlib";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const paeth = (left, above, upperLeft) => {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);

  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) {
    return left;
  }

  return aboveDistance <= upperLeftDistance ? above : upperLeft;
};

const unpackSample = (row, index, bitDepth) => {
  if (bitDepth === 8) {
    return row[index];
  }

  const samplesPerByte = 8 / bitDepth;
  const byte = row[Math.floor(index / samplesPerByte)];
  const shift = (samplesPerByte - 1 - (index % samplesPerByte)) * bitDepth;

  return (byte >> shift) & ((1 << bitDepth) - 1);
};

export const decodePngToRgba = (input) => {
  const png = Buffer.from(input);

  if (!png.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error("Expected a PNG signature.");
  }

  let offset = PNG_SIGNATURE.length;
  let header;
  let palette;
  let transparency;
  const imageChunks = [];

  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString("ascii", offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === "IHDR") {
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        interlace: data[12]
      };
    } else if (type === "PLTE") {
      palette = data;
    } else if (type === "tRNS") {
      transparency = data;
    } else if (type === "IDAT") {
      imageChunks.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  if (!header) {
    throw new Error("PNG is missing IHDR.");
  }

  if (header.interlace !== 0) {
    throw new Error("Interlaced PNGs are not supported by the parity decoder.");
  }

  const channelsByColorType = new Map([
    [0, 1],
    [2, 3],
    [3, 1],
    [4, 2],
    [6, 4]
  ]);
  const channels = channelsByColorType.get(header.colorType);

  if (!channels || ![1, 2, 4, 8].includes(header.bitDepth)) {
    throw new Error(
      `Unsupported PNG format: colorType=${header.colorType}, bitDepth=${header.bitDepth}.`
    );
  }

  if (header.colorType !== 0 && header.colorType !== 3 && header.bitDepth !== 8) {
    throw new Error("Sub-byte samples are supported only for grayscale and indexed PNGs.");
  }

  const rowLength = Math.ceil((header.width * channels * header.bitDepth) / 8);
  const filterBytesPerPixel = Math.max(1, Math.ceil((channels * header.bitDepth) / 8));
  const compressed = Buffer.concat(imageChunks);
  const inflated = inflateSync(compressed);
  const rows = [];
  let inputOffset = 0;

  for (let rowIndex = 0; rowIndex < header.height; rowIndex += 1) {
    const filter = inflated[inputOffset];
    inputOffset += 1;
    const encoded = inflated.subarray(inputOffset, inputOffset + rowLength);
    inputOffset += rowLength;
    const row = Buffer.alloc(rowLength);
    const previous = rows[rowIndex - 1];

    for (let byteIndex = 0; byteIndex < rowLength; byteIndex += 1) {
      const left = byteIndex >= filterBytesPerPixel ? row[byteIndex - filterBytesPerPixel] : 0;
      const above = previous?.[byteIndex] ?? 0;
      const upperLeft =
        byteIndex >= filterBytesPerPixel
          ? previous?.[byteIndex - filterBytesPerPixel] ?? 0
          : 0;
      let value = encoded[byteIndex];

      if (filter === 1) {
        value += left;
      } else if (filter === 2) {
        value += above;
      } else if (filter === 3) {
        value += Math.floor((left + above) / 2);
      } else if (filter === 4) {
        value += paeth(left, above, upperLeft);
      } else if (filter !== 0) {
        throw new Error(`Unsupported PNG row filter ${filter}.`);
      }

      row[byteIndex] = value & 0xff;
    }

    rows.push(row);
  }

  const rgba = new Uint8Array(header.width * header.height * 4);
  const maxSample = (1 << header.bitDepth) - 1;

  for (let y = 0; y < header.height; y += 1) {
    const row = rows[y];

    for (let x = 0; x < header.width; x += 1) {
      const outputOffset = (y * header.width + x) * 4;

      if (header.colorType === 3) {
        if (!palette) {
          throw new Error("Indexed PNG is missing PLTE.");
        }
        const paletteIndex = unpackSample(row, x, header.bitDepth);
        const paletteOffset = paletteIndex * 3;
        rgba[outputOffset] = palette[paletteOffset] ?? 0;
        rgba[outputOffset + 1] = palette[paletteOffset + 1] ?? 0;
        rgba[outputOffset + 2] = palette[paletteOffset + 2] ?? 0;
        rgba[outputOffset + 3] = transparency?.[paletteIndex] ?? 255;
      } else if (header.colorType === 0) {
        const value = Math.round((unpackSample(row, x, header.bitDepth) / maxSample) * 255);
        rgba.set([value, value, value, 255], outputOffset);
      } else {
        const inputPixelOffset = x * channels;
        rgba[outputOffset] = row[inputPixelOffset];
        rgba[outputOffset + 1] = row[inputPixelOffset + (header.colorType === 4 ? 0 : 1)];
        rgba[outputOffset + 2] = row[inputPixelOffset + (header.colorType === 4 ? 0 : 2)];
        rgba[outputOffset + 3] =
          header.colorType === 4
            ? row[inputPixelOffset + 1]
            : header.colorType === 6
              ? row[inputPixelOffset + 3]
              : 255;
      }
    }
  }

  return {
    width: header.width,
    height: header.height,
    data: rgba,
    source: {
      bitDepth: header.bitDepth,
      colorType: header.colorType
    }
  };
};
