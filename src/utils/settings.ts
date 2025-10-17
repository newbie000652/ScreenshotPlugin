import type { Settings, CaptureMode } from '../types';

export const DEFAULT_SETTINGS: Settings = {
  captureMode: 'visible',
  autoDownload: true,
  saveHistory: true,
  maxHistory: 50,
  imageQuality: 100,
  filenamePattern: 'screenshot_{date}_{time}',
};

export async function loadSettings(): Promise<Settings> {
  try {
    const result = await chrome.storage.local.get(['settings']);
    return { ...DEFAULT_SETTINGS, ...(result.settings as Partial<Settings> | undefined) };
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
