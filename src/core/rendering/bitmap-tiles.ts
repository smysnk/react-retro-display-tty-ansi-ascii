export const DEFAULT_RETRO_SCREEN_BITMAP_TILE_ROWS = 256;

export type RetroScreenBitmapTile = {
  index: number;
  startRow: number;
  endRow: number;
  rowCount: number;
};

export const buildBitmapTiles = (
  rows: number,
  tileRows = DEFAULT_RETRO_SCREEN_BITMAP_TILE_ROWS
): RetroScreenBitmapTile[] => {
  const normalizedRows = Math.max(0, Math.floor(rows));
  const normalizedTileRows = Math.max(1, Math.floor(tileRows));
  const tiles: RetroScreenBitmapTile[] = [];

  for (let startRow = 0, index = 0; startRow < normalizedRows; startRow += normalizedTileRows, index += 1) {
    const endRow = Math.min(normalizedRows, startRow + normalizedTileRows);
    tiles.push({
      index,
      startRow,
      endRow,
      rowCount: endRow - startRow
    });
  }

  return tiles.length > 0
    ? tiles
    : [{ index: 0, startRow: 0, endRow: 0, rowCount: 0 }];
};
