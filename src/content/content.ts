// Screenshot content script
// Handles full page screenshot capture and region selection

interface CaptureOptions {
  quality?: number;
  format?: 'png' | 'jpeg';
}

interface CaptureMessage {
  action: 'captureFullPage' | 'selectRegion';
  options?: CaptureOptions;
}

class ContentScriptController {
  private isCapturing: boolean = false;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  constructor() {
    this.initializeMessageListener();
  }

  private initializeMessageListener(): void {
    chrome.runtime.onMessage.addListener((message: CaptureMessage, _sender, sendResponse) => {
      if (message.action === 'captureFullPage') {
        this.captureFullPage(message.options)
          .then((dataUrl) => sendResponse({ success: true, dataUrl }))
          .catch((error) => sendResponse({ success: false, error: error.message }));
        return true; // Keep message channel open for async response
      }

      if (message.action === 'selectRegion') {
        this.startRegionSelection()
          .then((dataUrl) => sendResponse({ success: true, dataUrl }))
          .catch((error) => sendResponse({ success: false, error: error.message }));
        return true;
      }
    });
  }

  private async captureFullPage(options: CaptureOptions = {}): Promise<string> {
    if (this.isCapturing) {
      throw new Error('截图正在进行中，请稍候');
    }

    this.isCapturing = true;

    try {
      // Get page dimensions
      const pageHeight = Math.max(
        document.body.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.clientHeight,
        document.documentElement.scrollHeight,
        document.documentElement.offsetHeight
      );

      const pageWidth = Math.max(
        document.body.scrollWidth,
        document.body.offsetWidth,
        document.documentElement.clientWidth,
        document.documentElement.scrollWidth,
        document.documentElement.offsetWidth
      );

      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      // Create canvas for full page
      this.canvas = document.createElement('canvas');
      this.canvas.width = pageWidth;
      this.canvas.height = pageHeight;
      this.ctx = this.canvas.getContext('2d');

      if (!this.ctx) {
        throw new Error('无法创建 Canvas 上下文');
      }

      // Save original scroll position
      const originalScrollX = window.scrollX;
      const originalScrollY = window.scrollY;

      // Calculate number of screenshots needed
      const rows = Math.ceil(pageHeight / viewportHeight);
      const cols = Math.ceil(pageWidth / viewportWidth);

      // Capture screenshots in grid pattern
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = col * viewportWidth;
          const y = row * viewportHeight;

          // Scroll to position
          window.scrollTo(x, y);

          // Wait for scroll to complete
          await this.wait(100);

          // Capture visible area
          const dataUrl = await this.captureVisibleArea();

          // Draw to canvas
          await this.drawImageToCanvas(dataUrl, x, y);
        }
      }

      // Restore original scroll position
      window.scrollTo(originalScrollX, originalScrollY);

      // Convert canvas to data URL
      const quality = typeof options.quality === 'number' ? options.quality : 0.9;
      const format = typeof options.format === 'string' ? options.format : 'png';
      const finalDataUrl = this.canvas.toDataURL(`image/${format}`, quality);
    
      return finalDataUrl;
    } finally {
      this.isCapturing = false;
      if (this.canvas) {
        this.canvas.remove();
        this.canvas = null;
        this.ctx = null;
      }
    }
  }

  private async captureVisibleArea(): Promise<string> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: 'captureVisibleTab' }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response.success) {
          resolve(response.dataUrl);
        } else {
          reject(new Error(response.error || '截图失败'));
        }
      });
    });
  }

  private async drawImageToCanvas(dataUrl: string, x: number, y: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        if (this.ctx) {
          this.ctx.drawImage(img, x, y);
          resolve();
        } else {
          reject(new Error('Canvas 上下文不可用'));
        }
      };
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = dataUrl;
    });
  }

  private async startRegionSelection(): Promise<string> {
    // This would implement a region selection UI
    // For now, just return visible area capture
    return this.captureVisibleArea();
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Initialize content script
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new ContentScriptController();
  });
} else {
  new ContentScriptController();
}

export { ContentScriptController };
