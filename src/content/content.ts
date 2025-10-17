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
  private pageWidth = 0;
  private pageHeight = 0;
  private viewportWidth = 0;
  private viewportHeight = 0;

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

      // cache dimensions for draw phase
      this.pageWidth = pageWidth;
      this.pageHeight = pageHeight;
      this.viewportWidth = viewportWidth;
      this.viewportHeight = viewportHeight;

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

          // Wait for scroll to settle and content to render
          await this.waitForScrollSettled(x, y);
          // extra small delay to ensure paints completed on heavy pages
          await this.wait(50);

          // Capture visible area
          const dataUrl = await this.captureVisibleArea();

          // Draw to canvas at the correct position
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
      // 通过background script来截取当前标签页
      chrome.runtime.sendMessage({ action: 'captureVisibleTab' }, (response) => {
        if (chrome.runtime.lastError) {
          const error = chrome.runtime.lastError;
          reject(new Error(error?.message || '截图失败'));
        } else if (response && response.success) {
          resolve(response.dataUrl);
        } else {
          reject(new Error(response?.error || '截图失败'));
        }
      });
    });
  }

  private async drawImageToCanvas(dataUrl: string, x: number, y: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        if (!this.ctx || !this.canvas) {
          reject(new Error('Canvas 上下文不可用'));
          return;
        }

        // Account for device pixel ratio. captureVisibleTab returns bitmap in device pixels.
        const scaleX = img.naturalWidth / this.viewportWidth;
        const scaleY = img.naturalHeight / this.viewportHeight;

        // Destination size within page bounds (CSS pixels)
        const destW = Math.min(this.viewportWidth, this.pageWidth - x);
        const destH = Math.min(this.viewportHeight, this.pageHeight - y);

        // Corresponding source rectangle (device pixels)
        const srcW = Math.round(destW * scaleX);
        const srcH = Math.round(destH * scaleY);

        this.ctx.drawImage(
          img,
          0,
          0,
          srcW,
          srcH,
          x,
          y,
          destW,
          destH
        );
        resolve();
      };
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = dataUrl;
    });
  }

  private async startRegionSelection(): Promise<string> {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      cursor: crosshair;
      background: rgba(0,0,0,0.05);
    `;
    document.documentElement.appendChild(overlay);

    const selection = document.createElement('div');
    selection.style.cssText = `
      position: absolute;
      border: 2px solid #4C8BF5;
      background: rgba(76,139,245,0.15);
      pointer-events: none;
    `;
    overlay.appendChild(selection);

    const start = { x: 0, y: 0 };
    const end = { x: 0, y: 0 };

    const toRect = () => {
      const x1 = Math.min(start.x, end.x);
      const y1 = Math.min(start.y, end.y);
      const x2 = Math.max(start.x, end.x);
      const y2 = Math.max(start.y, end.y);
      return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
    };

    const onMouseDown = (e: MouseEvent) => {
      start.x = e.clientX;
      start.y = e.clientY;
      end.x = e.clientX;
      end.y = e.clientY;
      selection.style.left = `${start.x}px`;
      selection.style.top = `${start.y}px`;
      selection.style.width = '0px';
      selection.style.height = '0px';
      overlay.addEventListener('mousemove', onMouseMove);
      e.preventDefault();
    };

    const onMouseMove = (e: MouseEvent) => {
      end.x = e.clientX;
      end.y = e.clientY;
      const r = toRect();
      selection.style.left = `${r.x}px`;
      selection.style.top = `${r.y}px`;
      selection.style.width = `${r.w}px`;
      selection.style.height = `${r.h}px`;
    };

    const cleanup = () => {
      overlay.removeEventListener('mousemove', onMouseMove);
      overlay.removeEventListener('mousedown', onMouseDown);
      if (overlay.parentElement) overlay.parentElement.removeChild(overlay);
    };

    const result = await new Promise<string>((resolve, reject) => {
      const onMouseUp = async (e: MouseEvent) => {
        end.x = e.clientX;
        end.y = e.clientY;
        try {
          const rect = toRect();
          if (rect.w < 5 || rect.h < 5) {
            cleanup();
            // too small, fallback to visible
            const url = await this.captureVisibleArea();
            resolve(url);
            return;
          }

          // capture visible and crop to rect
          const fullUrl = await this.captureVisibleArea();
          const img = new Image();
          img.onload = () => {
            // compute DPR scale
            const scaleX = img.naturalWidth / window.innerWidth;
            const scaleY = img.naturalHeight / window.innerHeight;

            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = Math.round(rect.w * scaleX);
            cropCanvas.height = Math.round(rect.h * scaleY);
            const cctx = cropCanvas.getContext('2d');
            if (!cctx) throw new Error('无法创建 Canvas 上下文');
            cctx.drawImage(
              img,
              Math.round(rect.x * scaleX),
              Math.round(rect.y * scaleY),
              Math.round(rect.w * scaleX),
              Math.round(rect.h * scaleY),
              0,
              0,
              Math.round(rect.w * scaleX),
              Math.round(rect.h * scaleY)
            );
            const data = cropCanvas.toDataURL('image/png');
            resolve(data);
          };
          img.onerror = () => reject(new Error('区域截图失败'));
          img.src = fullUrl;
        } catch (err) {
          reject(err as Error);
        } finally {
          cleanup();
        }
      };
      overlay.addEventListener('mousedown', onMouseDown);
      // esc to cancel
      const onKey = (ke: KeyboardEvent) => {
        if (ke.key === 'Escape') {
          cleanup();
          document.removeEventListener('keydown', onKey);
          reject(new Error('取消'));
        }
      };
      document.addEventListener('keydown', onKey);
      const mouseUpListener = (evt: Event) => {
        overlay.removeEventListener('mouseup', mouseUpListener);
        onMouseUp(evt as MouseEvent);
      };
      overlay.addEventListener('mouseup', mouseUpListener, { once: true });
    });

    return result;
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async waitForScrollSettled(targetX: number, targetY: number): Promise<void> {
    const start = Date.now();
    const timeoutMs = 2000;

    // resolve after two consecutive frames where position is stable and close to target
    await new Promise<void>((resolve) => {
      let lastX = -1;
      let lastY = -1;
      let stableFrames = 0;

      const tick = () => {
        const cx = Math.round(window.scrollX);
        const cy = Math.round(window.scrollY);

        if (cx === lastX && cy === lastY) {
          stableFrames += 1;
        } else {
          stableFrames = 0;
        }
        lastX = cx;
        lastY = cy;

        const closeToTarget = Math.abs(cx - targetX) < 2 && Math.abs(cy - targetY) < 2;
        const timedOut = Date.now() - start > timeoutMs;

        if ((closeToTarget && stableFrames >= 2) || timedOut) {
          resolve();
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
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
