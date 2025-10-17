import type { ContentResponse } from '../types';

const BLOCKED_PROTOCOLS = new Set(['chrome:', 'edge:', 'about:', 'opera:', 'view-source:', 'chrome-extension:']);

export function canUseContentScript(url: string): boolean {
  try {
    const parsed = new URL(url);
    return !BLOCKED_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}

export async function ensureContentScript(tabId: number): Promise<void> {
  try {
    const injection = {
      target: { tabId },
      files: ['content/content.js'],
      world: 'ISOLATED',
    } as unknown;
  await (chrome.scripting.executeScript as unknown as Function)(injection);
  } catch (error) {
    console.warn('ensureContentScript failed:', error);
  }
}

export async function safeSendMessage<T extends ContentResponse = ContentResponse>(
  tabId: number,
  message: Record<string, unknown>
): Promise<T | undefined> {
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          resolve(undefined);
          return;
        }
        resolve(response as T);
      });
    } catch {
      resolve(undefined);
    }
  });
}
