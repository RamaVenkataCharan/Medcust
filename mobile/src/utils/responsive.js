import { useMemo } from 'react';
import { PixelRatio, useWindowDimensions } from 'react-native';

const BASE_WIDTH = 360;        // design baseline (a typical Android phone)
const TABLET_MIN = 600;        // shortest side >= 600dp counts as a tablet
const MAX_CONTENT_WIDTH = 720; // forms/lists never stretch wider than this

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
const px = (v) => PixelRatio.roundToNearestPixel(v);

export function getMetrics(width, height) {
  const shortSide = Math.min(width, height);
  const isTablet = shortSide >= TABLET_MIN;
  const isLandscape = width > height;

  // Scale factor is clamped so tiny phones don't get cramped
  // and tablets don't get comically large UI.
  const factor = clamp(shortSide / BASE_WIDTH, 0.85, isTablet ? 1.35 : 1.2);

  const scale = (n) => px(n * factor);                         // sizes, spacing, icons
  const moderate = (n, f = 0.5) => px(n + (n * factor - n) * f); // radii, padding
  const font = (n) => px(n + (n * factor - n) * 0.35);          // text (gentle growth)

  return {
    width,
    height,
    isTablet,
    isLandscape,
    isSmallPhone: !isTablet && shortSide < 340,
    scale,
    moderate,
    font,
    contentMaxWidth: isTablet ? MAX_CONTENT_WIDTH : width,
    columns: isTablet && isLandscape ? 2 : 1, // for two-pane / grid layouts
    touch: Math.max(44, scale(44)),            // minimum touch target
  };
}

// Re-computes automatically on rotation, split-screen and foldable changes.
export function useResponsive() {
  const { width, height } = useWindowDimensions();
  return useMemo(() => getMetrics(width, height), [width, height]);
}

// Layout-critical text should not explode with the system font size setting.
export const TEXT_PROPS = { maxFontSizeMultiplier: 1.3 };
