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
  action: 'capture';
  mode: 'visible' | 'full';
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
  switch (message.action) {
    case 'capture':
      handleCapture(message.mode, sender.tab)
        .then(sendResponse)
        .catch((error) => {
          console.error('Capture failed:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // 保持消息通道开放

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
});

// 截图处理函数
async function handleCapture(
  mode: 'visible' | 'full',
  tab?: chrome.tabs.Tab
): Promise<{ success: boolean; dataUrl?: string; filename?: string; error?: string }> {
  try {
    if (!tab?.id) {
      throw new Error('No active tab found');
    }

    let dataUrl: string;

    if (mode === 'visible') {
      // 截取可视区域
      dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: 'png',
        quality: 100,
      });
    } else {
      // 全页截图 - 通过content script实现
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'captureFullPage',
      });

      if (!response.success) {
        throw new Error(response.error || 'Full page capture failed');
      }

      dataUrl = response.dataUrl;
    }

    // 生成文件名
    const timestamp = Date.now();
    const date = new Date(timestamp);
    const filename = `screenshot_${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}_${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}_${timestamp}.png`;

    // 保存到历史记录
    const screenshotData: ScreenshotData = {
      id: `screenshot_${timestamp}`,
      dataUrl,
      timestamp,
      filename,
      url: tab.url || '',
      title: tab.title || '',
    };

    await saveScreenshot(screenshotData);

    // 自动下载
    await downloadScreenshot(dataUrl, filename);

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

// 保存截图到本地存储
async function saveScreenshot(screenshot: ScreenshotData): Promise<void> {
  try {
    const result = await chrome.storage.local.get(['screenshots']);
    const screenshots: ScreenshotData[] = result.screenshots || [];

    screenshots.unshift(screenshot); // 添加到开头

    // 限制历史记录数量（最多保存50张）
    if (screenshots.length > 50) {
      screenshots.splice(50);
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
