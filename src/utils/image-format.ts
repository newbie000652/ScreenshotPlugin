// Image format resolution helpers — pure functions, unit-testable.
//
// Single source of truth for how a screenshot's output format is decided:
//   - Settings.imageFormat ('png' | 'jpeg') is the explicit user choice.
//   - Settings.imageQuality (50-100) only controls JPEG quality, NOT the format.
// Legacy stored settings (before the explicit format field) have no
// imageFormat; deriveFormatFromQuality() migrates them by the old heuristic
// (quality < 100 meant JPEG).

import type { ImageFormat, Settings } from '../types';

/** Defensive fallback JPEG quality (0-1) when the stored quality is unusable. */
export const DEFAULT_JPEG_QUALITY_01 = 0.85;

/** Lower bound of the options-page quality slider (kept in sync with UI). */
export const MIN_QUALITY = 50;
/** Upper bound of the options-page quality slider (kept in sync with UI). */
export const MAX_QUALITY = 100;

export function normalizeImageFormat(value: unknown): ImageFormat {
  return value === 'jpeg' ? 'jpeg' : 'png';
}

/**
 * Legacy migration: derive the format from the quality heuristic that the
 * codebase used before the explicit imageFormat field existed.
 */
export function deriveFormatFromQuality(imageQuality: number): ImageFormat {
  return imageQuality < MAX_QUALITY ? 'jpeg' : 'png';
}

/** Resolve the effective output format from settings. */
export function resolveImageFormat(settings: Pick<Settings, 'imageFormat'>): ImageFormat {
  return normalizeImageFormat(settings.imageFormat);
}

/** Map the stored 50-100 quality to the 0-1 range used by canvas/API calls. */
export function jpegQuality01(settings: Pick<Settings, 'imageQuality'>): number {
  const q = Number(settings.imageQuality);
  if (!Number.isFinite(q)) {
    return DEFAULT_JPEG_QUALITY_01;
  }
  return Math.min(1, Math.max(MIN_QUALITY / MAX_QUALITY, q / MAX_QUALITY));
}
