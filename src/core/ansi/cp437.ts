export type RetroScreenAnsiControlCharacterMode = "ansi" | "dos-cp437";

// Unicode equivalents for the glyphs stored in the IBM PC code page 437 ROM.
// The C0 range and 0x7f are graphic glyphs in DOS text mode, even though those
// byte values retain their control meaning when they are part of ANSI syntax.
export const CP437_GLYPH_CODE_POINTS = [
  0, 9786, 9787, 9829, 9830, 9827, 9824, 8226, 9688, 9675, 9689, 9794, 9792, 9834,
  9835, 9788, 9658, 9668, 8597, 8252, 182, 167, 9644, 8616, 8593, 8595, 8594, 8592,
  8735, 8596, 9650, 9660, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45,
  46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65,
  66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85,
  86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103,
  104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119,
  120, 121, 122, 123, 124, 125, 126, 8962, 199, 252, 233, 226, 228, 224, 229, 231,
  234, 235, 232, 239, 238, 236, 196, 197, 201, 230, 198, 244, 246, 242, 251, 249,
  255, 214, 220, 162, 163, 165, 8359, 402, 225, 237, 243, 250, 241, 209, 170, 186,
  191, 8976, 172, 189, 188, 161, 171, 187, 9617, 9618, 9619, 9474, 9508, 9569,
  9570, 9558, 9557, 9571, 9553, 9559, 9565, 9564, 9563, 9488, 9492, 9524, 9516,
  9500, 9472, 9532, 9566, 9567, 9562, 9556, 9577, 9574, 9568, 9552, 9580, 9575,
  9576, 9572, 9573, 9561, 9560, 9554, 9555, 9579, 9578, 9496, 9484, 9608, 9604,
  9612, 9616, 9600, 945, 223, 915, 960, 931, 963, 181, 964, 934, 920, 937, 948,
  8734, 966, 949, 8745, 8801, 177, 8805, 8804, 8992, 8993, 247, 8776, 176, 8729,
  183, 8730, 8319, 178, 9632, 160
] as const;

// Ansilove treats NUL as a blank, cursor-advancing cell in DOS ANSI artwork.
// These remaining bytes are structural while decoding the artwork. Other C0
// values, including BS, are CP437 glyph cells rather than terminal input.
const DOS_ANSI_CONTROL_BYTES = new Set([
  0x0a,
  0x0d,
  0x1a,
  0x1b
]);

const CP437_GLYPH_INDEX_BY_CHARACTER = new Map(
  CP437_GLYPH_CODE_POINTS.map((codePoint, glyphIndex) => [String.fromCodePoint(codePoint), glyphIndex])
);

export const decodeCp437Byte = (
  value: number,
  controlCharacterMode: RetroScreenAnsiControlCharacterMode = "ansi"
) => {
  const normalizedValue = value & 0xff;

  if (controlCharacterMode === "dos-cp437" && normalizedValue === 0x00) {
    return " ";
  }

  const useGraphicControl =
    controlCharacterMode === "dos-cp437" &&
    (normalizedValue === 0x7f ||
      (normalizedValue < 0x20 && !DOS_ANSI_CONTROL_BYTES.has(normalizedValue)));
  const codePoint = useGraphicControl
    ? CP437_GLYPH_CODE_POINTS[normalizedValue]
    : normalizedValue < 0x80
      ? normalizedValue
      : CP437_GLYPH_CODE_POINTS[normalizedValue];

  return String.fromCodePoint(codePoint ?? 32);
};

export const getCp437GlyphIndex = (character: string) =>
  CP437_GLYPH_INDEX_BY_CHARACTER.get(character) ??
  CP437_GLYPH_INDEX_BY_CHARACTER.get(character.normalize("NFC")) ??
  0x20;
