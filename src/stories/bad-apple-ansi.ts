import badAppleAnsiUrl from "./assets/bad-apple.ans?url";

const CP437_CODE_POINTS = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
  22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40,
  41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59,
  60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78,
  79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97,
  98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113,
  114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 199,
  252, 233, 226, 228, 224, 229, 231, 234, 235, 232, 239, 238, 236, 196, 197,
  201, 230, 198, 244, 246, 242, 251, 249, 255, 214, 220, 162, 163, 165, 8359,
  402, 225, 237, 243, 250, 241, 209, 170, 186, 191, 8976, 172, 189, 188, 161,
  171, 187, 9617, 9618, 9619, 9474, 9508, 9569, 9570, 9558, 9557, 9571, 9553,
  9559, 9565, 9564, 9563, 9488, 9492, 9524, 9516, 9500, 9472, 9532, 9566, 9567,
  9562, 9556, 9577, 9574, 9568, 9552, 9580, 9575, 9576, 9572, 9573, 9561, 9560,
  9554, 9555, 9579, 9578, 9496, 9484, 9608, 9604, 9612, 9616, 9600, 945, 223,
  915, 960, 931, 963, 181, 964, 934, 920, 937, 948, 8734, 966, 949, 8745, 8801,
  177, 8805, 8804, 8992, 8993, 247, 8776, 176, 8729, 183, 8730, 8319, 178, 9632,
  160
] as const;

const SAUCE_RECORD_SIZE = 128;
const SAUCE_SIGNATURE = "SAUCE00";
const FRAME_MARKER = "\u001b[1;1H";
const ABSOLUTE_CURSOR_POSITION_PATTERN = /\u001b\[(\d+);(\d+)([Hf])/gu;

export type BadAppleAnsiAsset = {
  title: string;
  author: string;
  group: string;
  font: string;
  width: number;
  height: number;
  frames: string[];
  frameDelayMs: number;
  url: string;
};

let badAppleAnsiPromise: Promise<BadAppleAnsiAsset> | null = null;

const decodeCp437Byte = (value: number) =>
  String.fromCodePoint(CP437_CODE_POINTS[value] ?? 32);

const decodeCp437Text = (bytes: Uint8Array) => {
  let result = "";

  for (const byte of bytes) {
    result += decodeCp437Byte(byte);
  }

  return result;
};

const readSauceText = (bytes: Uint8Array, start: number, length: number) =>
  decodeCp437Text(bytes.slice(start, start + length)).replace(/\0+$/u, "").trimEnd();

const findSauceIndex = (bytes: Uint8Array) => {
  const signatureBytes = Array.from(SAUCE_SIGNATURE, (char) => char.codePointAt(0) ?? 0);

  for (let index = bytes.length - SAUCE_RECORD_SIZE; index >= 0; index -= 1) {
    let matched = true;

    for (let offset = 0; offset < signatureBytes.length; offset += 1) {
      if (bytes[index + offset] !== signatureBytes[offset]) {
        matched = false;
        break;
      }
    }

    if (matched) {
      return index;
    }
  }

  return -1;
};

const stripSauce = (bytes: Uint8Array) => {
  const sauceIndex = findSauceIndex(bytes);
  if (sauceIndex < 0) {
    return bytes;
  }

  const payloadEnd =
    sauceIndex > 0 && bytes[sauceIndex - 1] === 0x1a ? sauceIndex - 1 : sauceIndex;
  return bytes.slice(0, payloadEnd);
};

const parseSauce = (bytes: Uint8Array) => {
  const sauceIndex = findSauceIndex(bytes);
  if (sauceIndex < 0) {
    return {
      title: "Bad Apple!!",
      author: "Unknown",
      group: "Unknown",
      font: "IBM VGA",
      width: 80,
      height: 25
    };
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset + sauceIndex, SAUCE_RECORD_SIZE);
  return {
    title: readSauceText(bytes, sauceIndex + 7, 35) || "Bad Apple!!",
    author: readSauceText(bytes, sauceIndex + 42, 20) || "Unknown",
    group: readSauceText(bytes, sauceIndex + 62, 20) || "Unknown",
    width: view.getUint16(96, true) || 80,
    height: view.getUint16(98, true) || 25,
    font: readSauceText(bytes, sauceIndex + 106, 22) || "IBM VGA"
  };
};

const splitAnsiFrames = (payload: string) => {
  const cursorMatches = Array.from(payload.matchAll(ABSOLUTE_CURSOR_POSITION_PATTERN));

  if (cursorMatches.length === 0) {
    return payload.includes(FRAME_MARKER) ? payload.split(FRAME_MARKER).filter(Boolean) : [payload];
  }

  const frames: string[] = [];
  let frameStart = 0;
  let previousRow = Number(cursorMatches[0]?.[1] ?? "1");
  let previousCol = Number(cursorMatches[0]?.[2] ?? "1");

  for (let index = 1; index < cursorMatches.length; index += 1) {
    const match = cursorMatches[index];
    const nextRow = Number(match?.[1] ?? previousRow);
    const nextCol = Number(match?.[2] ?? previousCol);
    const nextIndex = match?.index ?? 0;

    if (nextRow < previousRow || (nextRow === previousRow && nextCol < previousCol)) {
      const frame = payload.slice(frameStart, nextIndex);
      if (frame.length > 0) {
        frames.push(frame);
      }
      frameStart = nextIndex;
    }

    previousRow = nextRow;
    previousCol = nextCol;
  }

  const trailingFrame = payload.slice(frameStart);
  if (trailingFrame.length > 0) {
    frames.push(trailingFrame);
  }

  return frames;
};

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
    const sauce = parseSauce(bytes);
    const payload = decodeCp437Text(stripSauce(bytes));
    const frames = splitAnsiFrames(payload).filter(Boolean);

    return {
      ...sauce,
      frames,
      frameDelayMs: 72,
      url: badAppleAnsiUrl
    } satisfies BadAppleAnsiAsset;
  });

  return badAppleAnsiPromise;
};
