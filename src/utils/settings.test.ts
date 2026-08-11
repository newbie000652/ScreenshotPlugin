import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, normalizeSettings } from './settings';

describe('normalizeSettings', () => {
  it('applies defaults for missing fields', () => {
    const settings = normalizeSettings(undefined);
    expect(settings).toEqual(DEFAULT_SETTINGS);
    expect(settings.imageFormat).toBe('png');
    expect(settings.imageQuality).toBe(100);
  });

  it('migrates legacy settings (no imageFormat) from the quality heuristic', () => {
    const legacyJpeg = normalizeSettings({ imageQuality: 90 });
    expect(legacyJpeg.imageFormat).toBe('jpeg');
    expect(legacyJpeg.imageQuality).toBe(90);

    const legacyPng = normalizeSettings({ imageQuality: 100 });
    expect(legacyPng.imageFormat).toBe('png');
  });

  it('explicit imageFormat wins over the heuristic', () => {
    const settings = normalizeSettings({ imageFormat: 'png', imageQuality: 80 });
    expect(settings.imageFormat).toBe('png');

    const jpeg = normalizeSettings({ imageFormat: 'jpeg', imageQuality: 100 });
    expect(jpeg.imageFormat).toBe('jpeg');
  });

  it('normalizes invalid imageFormat values', () => {
    const settings = normalizeSettings({ imageFormat: 'webp' as never });
    expect(settings.imageFormat).toBe('png');
  });

  it('normalizes capture mode', () => {
    expect(normalizeSettings({ captureMode: 'bogus' as never }).captureMode).toBe('visible');
    expect(normalizeSettings({ captureMode: 'region' }).captureMode).toBe('region');
  });
});
