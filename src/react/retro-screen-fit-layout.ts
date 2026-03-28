export type RetroScreenFitWidthLayoutInput = {
  availableOuterWidth: number;
  chromeWidth: number;
  chromeHeight: number;
  contentAspectRatio: number;
  maxOuterHeight?: number;
};

export type RetroScreenFitWidthLayout = {
  width: number;
  height: number;
  chromeWidth: number;
  chromeHeight: number;
  aspectRatio: number;
};

export const resolveRetroScreenFitWidthLayout = ({
  availableOuterWidth,
  chromeWidth,
  chromeHeight,
  contentAspectRatio,
  maxOuterHeight
}: RetroScreenFitWidthLayoutInput): RetroScreenFitWidthLayout => {
  const safeAvailableOuterWidth = Math.max(1, Math.floor(availableOuterWidth || 0));
  const safeChromeWidth = Math.max(0, Math.floor(chromeWidth || 0));
  const safeChromeHeight = Math.max(0, Math.floor(chromeHeight || 0));
  const aspectRatio = Math.max(0.01, Number.isFinite(contentAspectRatio) ? contentAspectRatio : 1);
  let width = safeAvailableOuterWidth;
  let innerTargetWidth = Math.max(1, width - safeChromeWidth);
  let innerTargetHeight = Math.max(1, Math.floor(innerTargetWidth / Math.max(0.01, aspectRatio)));
  let height = innerTargetHeight + safeChromeHeight;
  const safeMaxOuterHeight =
    Number.isFinite(maxOuterHeight) && (maxOuterHeight ?? 0) > 0
      ? Math.max(1, Math.floor(maxOuterHeight as number))
      : null;

  if (safeMaxOuterHeight !== null && height > safeMaxOuterHeight) {
    height = safeMaxOuterHeight;
  }

  return {
    width,
    height,
    chromeWidth: safeChromeWidth,
    chromeHeight: safeChromeHeight,
    aspectRatio
  };
};
