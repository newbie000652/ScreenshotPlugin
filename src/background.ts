// Background Service Worker for Screenshot Plugin

interface ScreenshotData {
  id: string;
  dataUrl: string;
  timestamp: number;
  filename: string;
  url: string;
  title: string;
}

interface CaptureMessage {
  action: 'capture' | 'captureVisibleTab';
  mode?: 'visible' | 'full' | 'region';
}

interface GetHistoryMessage {
  action: 'getHistory';
}

interface DeleteScreenshotMessage {
  action: 'deleteScreenshot';
  id: string;
}

type Message = CaptureMessage | GetHistoryMessage | DeleteScreenshotMessage;

// 监听来自popup和content script的消息
chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  try {
    switch (message.action) {
      case 'capture':
        if (!message.mode) {
          sendResponse({ success: false, error: 'Mode is required for capture action' });
          return true;
        }
        handleCapture(message.mode, sender.tab)
          .then(sendResponse)
          .catch((error) => {
            console.error('Capture failed:', error);
            sendResponse({ success: false, error: error.message });
          });
        return true; // 保持消息通道开放

      case 'captureVisibleTab':
        handleCaptureVisibleTab(sender.tab)
          .then(sendResponse)
          .catch((error) => {
            console.error('Capture visible tab failed:', error);
            sendResponse({ success: false, error: error.message });
          });
        return true;

      case 'getHistory':
        getScreenshotHistory()
          .then(sendResponse)
          .catch((error) => {
            console.error('Get history failed:', error);
            sendResponse({ success: false, error: error.message });
          });
        return true;

      case 'deleteScreenshot':
        deleteScreenshot(message.id)
          .then(sendResponse)
          .catch((error) => {
            console.error('Delete screenshot failed:', error);
            sendResponse({ success: false, error: error.message });
          });
        return true;

      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  } catch (error) {
    console.error('Message handler error:', error);
    sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// 截图处理函数
async function handleCapture(
  mode: 'visible' | 'full' | 'region',
  tab?: chrome.tabs.Tab
): Promise<{ success: boolean; dataUrl?: string; filename?: string; error?: string }> {
  try {
    let targetTab = tab;
    
    // 如果没有提供tab信息，获取当前活动标签页
    if (!targetTab?.id) {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length === 0) {
        throw new Error('No active tab found');
      }
      targetTab = tabs[0];
    }

  let dataUrl: string | undefined;

  // Load settings
  const settings = await loadSettings();

    if (mode === 'visible') {
      // 截取可视区域
      dataUrl = await chrome.tabs.captureVisibleTab(targetTab.windowId!, {
        format: settings.imageQuality < 100 ? 'jpeg' : 'png',
        quality: Math.min(100, Math.max(50, settings.imageQuality)),
      });
    } else if (mode === 'full') {
      // 全页截图 - 通过content script实现
      try {
        if (!canUseContentScript(targetTab.url || '')) {
          throw new Error('Content script not allowed on this page');
        }

        // 先尝试发送；如果失败再注入再重试
        let response = await safeSendMessage<ContentResponse>(targetTab.id!, {
          action: 'captureFullPage',
          options: {
            quality: Math.min(1, Math.max(0.5, settings.imageQuality / 100)),
            format: settings.imageQuality < 100 ? 'jpeg' : 'png',
          },
        });

        if (!response) {
          await ensureContentScript(targetTab.id!);
          response = await safeSendMessage<ContentResponse>(targetTab.id!, {
            action: 'captureFullPage',
            options: {
              quality: Math.min(1, Math.max(0.5, settings.imageQuality / 100)),
              format: settings.imageQuality < 100 ? 'jpeg' : 'png',
            },
          });
        }

        if (!response || !response.success) {
          throw new Error(response?.error || 'Full page capture failed');
        }

        dataUrl = response.dataUrl;
      } catch {
        // 如果content script不可用，回退到可视区域截图
        console.warn('Content script not available, falling back to visible area capture');
        dataUrl = await chrome.tabs.captureVisibleTab(targetTab.windowId!, {
          format: settings.imageQuality < 100 ? 'jpeg' : 'png',
          quality: Math.min(100, Math.max(50, settings.imageQuality)),
        });
      }
    } else if (mode === 'region') {
      // 区域选择截图
      try {
        if (!canUseContentScript(targetTab.url || '')) {
          throw new Error('Content script not allowed on this page');
        }

        let response = await safeSendMessage<ContentResponse>(targetTab.id!, {
          action: 'selectRegion',
          options: {
            quality: Math.min(1, Math.max(0.5, settings.imageQuality / 100)),
            format: settings.imageQuality < 100 ? 'jpeg' : 'png',
          },
        });

        if (!response) {
          await ensureContentScript(targetTab.id!);
          response = await safeSendMessage<ContentResponse>(targetTab.id!, {
            action: 'selectRegion',
            options: {
              quality: Math.min(1, Math.max(0.5, settings.imageQuality / 100)),
              format: settings.imageQuality < 100 ? 'jpeg' : 'png',
            },
          });
        }

        if (!response || !response.success) {
          throw new Error(response?.error || 'Region capture failed');
        }
        dataUrl = response.dataUrl;
      } catch {
        console.warn('Region selection not available, falling back to visible area capture');
        dataUrl = await chrome.tabs.captureVisibleTab(targetTab.windowId!, {
          format: settings.imageQuality < 100 ? 'jpeg' : 'png',
          quality: Math.min(100, Math.max(50, settings.imageQuality)),
        });
      }
    } else {
      throw new Error('Unknown capture mode');
    }

    // 生成文件名
    const timestamp = Date.now();
    const date = new Date(timestamp);
    const filename = formatFilename(settings.filenamePattern, {
      date,
      tab: targetTab,
      timestamp,
      ext: (settings.imageQuality < 100 ? 'jpg' : 'png'),
    });

    // 保存到历史记录
    const screenshotData: ScreenshotData = {
      id: `screenshot_${timestamp}`,
  dataUrl: dataUrl!,
      timestamp,
      filename,
      url: targetTab.url || '',
      title: targetTab.title || '',
    };

    if (settings.saveHistory) {
      await saveScreenshot(screenshotData, settings.maxHistory);
    }

    // 自动下载
    if (settings.autoDownload && dataUrl) {
      await downloadScreenshot(dataUrl, filename);
    }

    return {
      success: true,
      dataUrl,
      filename,
    };
  } catch (error) {
    console.error('Capture error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// 处理可视区域截图（供content script调用）
async function handleCaptureVisibleTab(
  tab?: chrome.tabs.Tab
): Promise<{ success: boolean; dataUrl?: string; error?: string }> {
  try {
    let targetTab = tab;
    
    // 如果没有提供tab信息，获取当前活动标签页
    if (!targetTab?.id) {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length === 0) {
        throw new Error('No active tab found');
      }
      targetTab = tabs[0];
    }

    const settings = await loadSettings();
    const dataUrl = await chrome.tabs.captureVisibleTab(targetTab.windowId!, {
      format: settings.imageQuality < 100 ? 'jpeg' : 'png',
      quality: Math.min(100, Math.max(50, settings.imageQuality)),
    });

    return {
      success: true,
      dataUrl,
    };
  } catch (error) {
    console.error('Capture visible tab error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// 保存截图到本地存储
async function saveScreenshot(screenshot: ScreenshotData, maxHistory: number = 50): Promise<void> {
  try {
    const result = await chrome.storage.local.get(['screenshots']);
    const screenshots: ScreenshotData[] = result.screenshots || [];

    screenshots.unshift(screenshot); // 添加到开头

    // 限制历史记录数量（最多保存50张）
    const limit = Math.max(10, Math.min(200, maxHistory));
    if (screenshots.length > limit) {
      screenshots.splice(limit);
    }

    await chrome.storage.local.set({ screenshots });
  } catch (error) {
    console.error('Save screenshot error:', error);
    throw new Error('Failed to save screenshot to storage');
  }
}

// 下载截图
async function downloadScreenshot(dataUrl: string, filename: string): Promise<void> {
  try {
    await chrome.downloads.download({
      url: dataUrl,
      filename,
      saveAs: false,
    });
  } catch (error) {
    console.error('Download error:', error);
    throw new Error('Failed to download screenshot');
  }
}

// 获取截图历史记录
async function getScreenshotHistory(): Promise<{
  success: boolean;
  screenshots?: ScreenshotData[];
  error?: string;
}> {
  try {
    const result = await chrome.storage.local.get(['screenshots']);
    return {
      success: true,
      screenshots: result.screenshots || [],
    };
  } catch (error) {
    console.error('Get history error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// 删除截图
async function deleteScreenshot(id: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const result = await chrome.storage.local.get(['screenshots']);
    const screenshots: ScreenshotData[] = result.screenshots || [];

    const filteredScreenshots = screenshots.filter((s) => s.id !== id);

    await chrome.storage.local.set({ screenshots: filteredScreenshots });

    return { success: true };
  } catch (error) {
    console.error('Delete screenshot error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// 扩展安装时的初始化
chrome.runtime.onInstalled.addListener(() => {
  console.log('Screenshot Plugin installed');
});

// Settings helpers
interface Settings {
  captureMode: 'visible' | 'full';
  autoDownload: boolean;
  saveHistory: boolean;
  maxHistory: number;
  imageQuality: number; // 50-100
  filenamePattern: string; // e.g. screenshot_{date}_{time}
}

async function loadSettings(): Promise<Settings> {
  const defaults: Settings = {
    captureMode: 'visible',
    autoDownload: true,
    saveHistory: true,
    maxHistory: 50,
    imageQuality: 100,
    filenamePattern: 'screenshot_{date}_{time}',
  };
  try {
    const result = await chrome.storage.local.get(['settings']);
    return { ...defaults, ...(result.settings || {}) } as Settings;
  } catch {
    return defaults;
  }
}

function sanitizeFilenamePart(str: string): string {
  return str
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function replaceTokenAll(input: string, token: string, value: string): string {
  return input.split(token).join(value);
}

function formatFilename(pattern: string, ctx: { date: Date; tab?: chrome.tabs.Tab; timestamp: number; ext: string }): string {
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
    try { return ctx.tab?.url ? new URL(ctx.tab.url).hostname : 'page'; } catch { return 'page'; }
  })();

  let base = pattern || 'screenshot_{date}_{time}';
  base = replaceTokenAll(base, '{date}', dateStr);
  base = replaceTokenAll(base, '{time}', timeStr);
  base = replaceTokenAll(base, '{title}', title);
  base = replaceTokenAll(base, '{url}', urlHost);
  base = replaceTokenAll(base, '{timestamp}', String(ctx.timestamp));

  const sanitized = sanitizeFilenamePart(base || 'screenshot');
  return `${sanitized}.${ctx.ext}`;
}

// Content script helpers
function canUseContentScript(url: string): boolean {
  try {
    const u = new URL(url);
    // Disallow special schemes where content scripts cannot run
    const blocked = new Set(['chrome:', 'edge:', 'about:', 'opera:', 'view-source:', 'chrome-extension:']);
    return !blocked.has(u.protocol);
  } catch {
    return false;
  }
}

async function ensureContentScript(tabId: number): Promise<void> {
  try {
    const injection = {
      target: { tabId },
      files: ['content/content.js'],
      world: 'ISOLATED',
    } as unknown;
  await (chrome.scripting.executeScript as unknown as Function)(injection);
  } catch (e) {
    // Best-effort: ignore injection errors, caller will handle fallback
    console.warn('ensureContentScript failed:', e);
  }
}

type GenericMessage = Record<string, unknown>;
type ContentResponse = { success: boolean; dataUrl?: string; error?: string };
async function safeSendMessage<T = unknown>(tabId: number, message: GenericMessage): Promise<T | undefined> {
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          // Receiving end does not exist -> undefined
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
