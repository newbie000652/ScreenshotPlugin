import type { Settings, CaptureMode } from '../types';
import { deriveFormatFromQuality, normalizeImageFormat } from './image-format';

export const DEFAULT_SETTINGS: Settings = {
  captureMode: 'visible',
  autoDownload: true,
  saveHistory: true,
  maxHistory: 50,
  imageQuality: 100,
  imageFormat: 'png',
  filenamePattern: 'screenshot_{date}_{time}',
};

/**
 * Merge raw (possibly partial, possibly legacy) stored settings with defaults
 * and normalize every field. Legacy settings without `imageFormat` are
 * migrated via the old quality heuristic so behavior does not regress.
 */
export function normalizeSettings(raw: Partial<Settings> | undefined): Settings {
  const settings: Settings = { ...DEFAULT_SETTINGS, ...raw };
  settings.captureMode = normalizeCaptureMode(settings.captureMode);
  // Only derive from the legacy quality heuristic when the stored settings
  // had no explicit imageFormat (spread of DEFAULT_SETTINGS always fills it).
  const hasExplicitFormat = raw?.imageFormat !== undefined;
  settings.imageFormat = hasExplicitFormat
    ? normalizeImageFormat(raw.imageFormat)
    : normalizeImageFormat(deriveFormatFromQuality(settings.imageQuality));
  return settings;
}

export async function loadSettings(): Promise<Settings> {
  try {
    const result = await chrome.storage.local.get(['settings']);
    return normalizeSettings(result.settings as Partial<Settings> | undefined);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function normalizeCaptureMode(mode: CaptureMode | undefined): CaptureMode {
  if (mode === 'full' || mode === 'region') {
    return mode;
  }
  return 'visible';
}

export function formatFilename(pattern: string, ctx: { date: Date; tab?: chrome.tabs.Tab; timestamp: number; ext: string }): string {
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const yyyy = ctx.date.getFullYear();
  const MM = pad2(ctx.date.getMonth() + 1);
  const dd = pad2(ctx.date.getDate());
  const HH = pad2(ctx.date.getHours());
  const mm = pad2(ctx.date.getMinutes());
  const ss = pad2(ctx.date.getSeconds());

  const dateStr = `${yyyy}${MM}${dd}`;
  const timeStr = `${HH}${mm}${ss}`;
  const title = sanitizeFilenamePart(ctx.tab?.title || 'untitled');
  const urlHost = (() => {
    try {
      return ctx.tab?.url ? new URL(ctx.tab.url).hostname : 'page';
    } catch {
      return 'page';
    }
  })();

  let base = pattern || DEFAULT_SETTINGS.filenamePattern;
  base = replaceTokenAll(base, '{date}', dateStr);
  base = replaceTokenAll(base, '{time}', timeStr);
  base = replaceTokenAll(base, '{title}', title);
  base = replaceTokenAll(base, '{url}', urlHost);
  base = replaceTokenAll(base, '{timestamp}', String(ctx.timestamp));

  const sanitized = sanitizeFilenamePart(base || 'screenshot');
  return `${sanitized}.${ctx.ext}`;
}

function replaceTokenAll(input: string, token: string, value: string): string {
  return input.split(token).join(value);
}

function sanitizeFilenamePart(str: string): string {
  return str.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 80);
}
