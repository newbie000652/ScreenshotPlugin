// Background service worker orchestrates capture requests and history management

import type { CaptureMode, CaptureResponse, ContentResponse, HistoryResponse, ScreenshotData } from './types';
import { loadSettings, formatFilename } from './utils/settings';
import { canUseContentScript, ensureContentScript, safeSendMessage } from './utils/content-script';

interface CaptureMessage {
  action: 'capture';
  mode: CaptureMode;
}

interface CaptureVisibleTabMessage {
  action: 'captureVisibleTab';
}

interface GetHistoryMessage {
  action: 'getHistory';
}

interface DeleteScreenshotMessage {
  action: 'deleteScreenshot';
  id: string;
}

type Message = CaptureMessage | CaptureVisibleTabMessage | GetHistoryMessage | DeleteScreenshotMessage;

chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  switch (message.action) {
    case 'capture':
      handleCapture(message.mode, sender.tab)
        .then(sendResponse)
        .catch((error) => {
          console.error('Background handler error:', error);
          sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
        });
      return true;
    case 'captureVisibleTab':
      handleCaptureVisibleTab(sender.tab)
        .then(sendResponse)
        .catch((error) => {
          console.error('Background handler error:', error);
          sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
        });
      return true;
    case 'getHistory':
      getScreenshotHistory()
        .then(sendResponse)
        .catch((error) => {
          console.error('Background handler error:', error);
          sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
        });
      return true;
    case 'deleteScreenshot':
      deleteScreenshot(message.id)
        .then(sendResponse)
        .catch((error) => {
          console.error('Background handler error:', error);
          sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
        });
      return true;
    default:
      sendResponse({ success: false, error: 'Unknown action' });
      return false;
  }
});

async function handleCapture(mode: CaptureMode, tab?: chrome.tabs.Tab): Promise<CaptureResponse> {
  try {
    const targetTab = await resolveTargetTab(tab);
    const settings = await loadSettings();
    const isJpeg = settings.imageQuality < 100;
    const windowId = getWindowId(targetTab);

    let dataUrl: string | undefined;
    if (mode === 'visible') {
      dataUrl = await captureVisibleArea(windowId, settings.imageQuality);
    } else if (mode === 'full') {
      dataUrl = await captureFullPage(targetTab, settings.imageQuality);
    } else if (mode === 'region') {
      dataUrl = await captureRegion(targetTab, settings.imageQuality);
    }

    if (!dataUrl) {
      throw new Error('Failed to capture screenshot');
    }

    const timestamp = Date.now();
    const filename = formatFilename(settings.filenamePattern, {
      date: new Date(timestamp),
      tab: targetTab,
      timestamp,
      ext: isJpeg ? 'jpg' : 'png',
    });

    const screenshotData: ScreenshotData = {
      id: `screenshot_${timestamp}`,
      dataUrl,
      timestamp,
      filename,
      url: targetTab.url || '',
      title: targetTab.title || '',
    };

    if (settings.saveHistory) {
      await saveScreenshot(screenshotData, settings.maxHistory);
    }

    if (settings.autoDownload) {
      await downloadScreenshot(dataUrl, filename);
    }

    return { success: true, dataUrl, filename };
  } catch (error) {
    console.error('Capture error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function resolveTargetTab(tab?: chrome.tabs.Tab): Promise<chrome.tabs.Tab> {
  const resolved = tab ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  if (!resolved) {
    throw new Error('No active tab found');
  }
  if (resolved.id === undefined || resolved.windowId === undefined) {
    throw new Error('Tab metadata unavailable');
  }
  return resolved;
}

async function captureVisibleArea(windowId: number, quality: number): Promise<string> {
  return chrome.tabs.captureVisibleTab(windowId, {
    format: quality < 100 ? 'jpeg' : 'png',
    quality: clampQuality(quality),
  });
}

async function captureFullPage(tab: chrome.tabs.Tab, quality: number): Promise<string | undefined> {
  if (!canUseContentScript(tab.url || '')) {
    console.warn('Full page capture unavailable on this page, falling back to visible area');
    return captureVisibleArea(getWindowId(tab), quality);
  }

  const response = await executeContentCapture(tab, 'captureFullPage', quality);
  if (!response?.success || !response.dataUrl) {
    console.warn('Full page capture failed, falling back to visible area');
    return captureVisibleArea(getWindowId(tab), quality);
  }

  return response.dataUrl;
}

async function captureRegion(tab: chrome.tabs.Tab, quality: number): Promise<string | undefined> {
  if (!canUseContentScript(tab.url || '')) {
    console.warn('Region capture unavailable on this page, falling back to visible area');
    return captureVisibleArea(getWindowId(tab), quality);
  }

  const response = await executeContentCapture(tab, 'selectRegion', quality);
  if (!response?.success || !response.dataUrl) {
    console.warn('Region capture failed, falling back to visible area');
    return captureVisibleArea(getWindowId(tab), quality);
  }

  return response.dataUrl;
}

async function executeContentCapture(
  tab: chrome.tabs.Tab,
  action: 'captureFullPage' | 'selectRegion',
  quality: number
): Promise<ContentResponse | undefined> {
  if (tab.id === undefined) {
    throw new Error('Tab id unavailable for content capture');
  }
  const request = {
    action,
    options: {
      quality: clampContentQuality(quality),
      format: quality < 100 ? 'jpeg' : 'png',
    },
  } as const;

  let response = await safeSendMessage<ContentResponse>(tab.id, request);
  if (!response) {
    await ensureContentScript(tab.id);
    response = await safeSendMessage<ContentResponse>(tab.id, request);
  }
  return response;
}

async function handleCaptureVisibleTab(tab?: chrome.tabs.Tab): Promise<ContentResponse> {
  try {
    const targetTab = await resolveTargetTab(tab);
    const settings = await loadSettings();
    const dataUrl = await captureVisibleArea(getWindowId(targetTab), settings.imageQuality);
    return { success: true, dataUrl };
  } catch (error) {
    console.error('Capture visible tab error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function saveScreenshot(screenshot: ScreenshotData, maxHistory: number): Promise<void> {
  const result = await chrome.storage.local.get(['screenshots']);
  const screenshots: ScreenshotData[] = result.screenshots || [];

  screenshots.unshift(screenshot);

  const limit = Math.max(10, Math.min(200, maxHistory));
  if (screenshots.length > limit) {
    screenshots.splice(limit);
  }

  await chrome.storage.local.set({ screenshots });
}

async function downloadScreenshot(dataUrl: string, filename: string): Promise<void> {
  await chrome.downloads.download({ url: dataUrl, filename, saveAs: false });
}

async function getScreenshotHistory(): Promise<HistoryResponse> {
  try {
    const result = await chrome.storage.local.get(['screenshots']);
    return { success: true, screenshots: result.screenshots || [] };
  } catch (error) {
    console.error('Get history error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function deleteScreenshot(id: string): Promise<ContentResponse> {
  try {
    const result = await chrome.storage.local.get(['screenshots']);
    const screenshots: ScreenshotData[] = result.screenshots || [];
    const filtered = screenshots.filter((item) => item.id !== id);
    await chrome.storage.local.set({ screenshots: filtered });
    return { success: true };
  } catch (error) {
    console.error('Delete screenshot error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

function getWindowId(tab: chrome.tabs.Tab): number {
  if (tab.windowId === undefined) {
    throw new Error('No window associated with target tab');
  }
  return tab.windowId;
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('Screenshot Plugin installed');
});

function clampQuality(quality: number): number {
  return Math.min(100, Math.max(50, Math.round(quality)));
}

function clampContentQuality(quality: number): number {
  return Math.min(1, Math.max(0.5, quality / 100));
}
