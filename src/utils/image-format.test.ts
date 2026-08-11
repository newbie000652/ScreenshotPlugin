import { describe, expect, it } from 'vitest';
import {
  DEFAULT_JPEG_QUALITY_01,
  deriveFormatFromQuality,
  jpegQuality01,
  normalizeImageFormat,
  resolveImageFormat,
} from './image-format';
import type { Settings } from '../types';

describe('normalizeImageFormat', () => {
  it('accepts explicit formats', () => {
    expect(normalizeImageFormat('png')).toBe('png');
    expect(normalizeImageFormat('jpeg')).toBe('jpeg');
  });

  it('falls back to png for anything else', () => {
    expect(normalizeImageFormat(undefined)).toBe('png');
    expect(normalizeImageFormat('bmp')).toBe('png');
    expect(normalizeImageFormat(null)).toBe('png');
  });
});

describe('deriveFormatFromQuality (legacy migration)', () => {
  it('quality 100 means png', () => {
    expect(deriveFormatFromQuality(100)).toBe('png');
  });

  it('quality below 100 means jpeg', () => {
    expect(deriveFormatFromQuality(99)).toBe('jpeg');
    expect(deriveFormatFromQuality(50)).toBe('jpeg');
    expect(deriveFormatFromQuality(0)).toBe('jpeg');
  });
});

describe('resolveImageFormat', () => {
  it('returns the explicit setting', () => {
    expect(resolveImageFormat({ imageFormat: 'jpeg' } as Settings)).toBe('jpeg');
    expect(resolveImageFormat({ imageFormat: 'png' } as Settings)).toBe('png');
  });
});

describe('jpegQuality01', () => {
  it('maps the 50-100 scale to 0-1', () => {
    expect(jpegQuality01({ imageQuality: 100 } as Settings)).toBe(1);
    expect(jpegQuality01({ imageQuality: 90 } as Settings)).toBe(0.9);
    expect(jpegQuality01({ imageQuality: 50 } as Settings)).toBe(0.5);
  });

  it('clamps out-of-range values', () => {
    expect(jpegQuality01({ imageQuality: 0 } as Settings)).toBe(0.5);
    expect(jpegQuality01({ imageQuality: 200 } as Settings)).toBe(1);
  });

  it('uses the named fallback constant for unusable values', () => {
    expect(jpegQuality01({ imageQuality: Number.NaN } as Settings)).toBe(DEFAULT_JPEG_QUALITY_01);
  });
});
