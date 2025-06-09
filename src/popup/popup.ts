// Popup Script for Screenshot Plugin

interface ScreenshotResponse {
  success: boolean;
  dataUrl?: string;
  filename?: string;
  error?: string;
}

class PopupController {
  private captureBtn!: HTMLButtonElement;
  private historyBtn!: HTMLButtonElement;
  private modeSelect!: HTMLSelectElement;
  private statusDiv!: HTMLDivElement;
  private statusText!: HTMLSpanElement;
  private previewDiv!: HTMLDivElement;
  private previewImage!: HTMLImageElement;
  private downloadBtn!: HTMLButtonElement;
  private closePreviewBtn!: HTMLButtonElement;
  private optionsLink!: HTMLAnchorElement;
  private helpLink!: HTMLAnchorElement;

  constructor() {
    this.initializeElements();
    this.bindEvents();
    this.loadSettings();
  }

  private initializeElements(): void {
    this.captureBtn = document.getElementById('capture-btn') as HTMLButtonElement;
    this.historyBtn = document.getElementById('history-btn') as HTMLButtonElement;
    this.modeSelect = document.getElementById('capture-mode') as HTMLSelectElement;
    this.statusDiv = document.getElementById('status') as HTMLDivElement;
    this.statusText = document.getElementById('status-text') as HTMLSpanElement;
    this.previewDiv = document.getElementById('preview') as HTMLDivElement;
    this.previewImage = document.getElementById('preview-image') as HTMLImageElement;
    this.downloadBtn = document.getElementById('download-btn') as HTMLButtonElement;
    this.closePreviewBtn = document.getElementById('close-preview-btn') as HTMLButtonElement;
    this.optionsLink = document.getElementById('options-link') as HTMLAnchorElement;
    this.helpLink = document.getElementById('help-link') as HTMLAnchorElement;

    // 验证所有元素都存在
    const elements = [
      this.captureBtn,
      this.historyBtn,
      this.modeSelect,
      this.statusDiv,
      this.statusText,
      this.previewDiv,
      this.previewImage,
      this.downloadBtn,
      this.closePreviewBtn,
      this.optionsLink,
      this.helpLink,
    ];

    elements.forEach((element, index) => {
      if (!element) {
        console.error(`Element at index ${index} not found`);
      }
    });
  }

  private bindEvents(): void {
    this.captureBtn.addEventListener('click', () => this.handleCapture());
    this.historyBtn.addEventListener('click', () => this.openHistoryPage());
    this.modeSelect.addEventListener('change', () => this.saveSettings());
    this.downloadBtn.addEventListener('click', () => this.downloadCurrentImage());
    this.closePreviewBtn.addEventListener('click', () => this.hidePreview());
    this.optionsLink.addEventListener('click', (e) => {
      e.preventDefault();
      this.openOptionsPage();
    });
    this.helpLink.addEventListener('click', (e) => {
      e.preventDefault();
      this.showHelp();
    });

    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !this.captureBtn.disabled) {
        this.handleCapture();
      } else if (e.key === 'Escape') {
        this.hidePreview();
      }
    });
  }

  private async loadSettings(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['captureMode']);
      if (result.captureMode) {
        this.modeSelect.value = result.captureMode;
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  private async saveSettings(): Promise<void> {
    try {
      await chrome.storage.local.set({
        captureMode: this.modeSelect.value,
      });
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  private async handleCapture(): Promise<void> {
    const mode = this.modeSelect.value as 'visible' | 'full';

    this.setLoading(true);
    this.showStatus('正在截取...', 'loading');
    this.hidePreview();

    try {
      const response = (await this.sendMessage({
        action: 'capture',
        mode,
      })) as ScreenshotResponse;

      if (response.success && response.dataUrl) {
        this.showStatus(`截图成功！文件名: ${response.filename}`, 'success');
        this.showPreview(response.dataUrl);

        // 3秒后隐藏状态消息
        setTimeout(() => this.hideStatus(), 3000);
      } else {
        this.showStatus(`截图失败: ${response.error || '未知错误'}`, 'error');
      }
    } catch (error) {
      console.error('Capture error:', error);
      this.showStatus('截图失败，请重试', 'error');
    } finally {
      this.setLoading(false);
    }
  }

  private setLoading(loading: boolean): void {
    this.captureBtn.disabled = loading;
    this.captureBtn.classList.toggle('loading', loading);

    const buttonText = this.captureBtn.querySelector('.button-text');
    if (buttonText) {
      buttonText.textContent = loading ? '截取中...' : '截取';
    }
  }

  private showStatus(message: string, type: 'loading' | 'success' | 'error'): void {
    this.statusText.textContent = message;
    this.statusDiv.className = `status-message ${type}`;
    this.statusDiv.style.display = 'block';
  }

  private hideStatus(): void {
    this.statusDiv.style.display = 'none';
  }

  private showPreview(dataUrl: string): void {
    this.previewImage.src = dataUrl;
    this.previewDiv.style.display = 'block';
  }

  private hidePreview(): void {
    this.previewDiv.style.display = 'none';
    this.previewImage.src = '';
  }

  private downloadCurrentImage(): void {
    if (this.previewImage.src) {
      const link = document.createElement('a');
      link.href = this.previewImage.src;
      link.download = `screenshot_${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  private openHistoryPage(): void {
    chrome.runtime.openOptionsPage();
    window.close();
  }

  private openOptionsPage(): void {
    chrome.runtime.openOptionsPage();
    window.close();
  }

  private showHelp(): void {
    const helpText = `
截图工具使用说明：

1. 选择截图模式：
   - 可视区域：截取当前浏览器窗口可见部分
   - 整个页面：截取完整网页内容

2. 点击"截取"按钮开始截图

3. 截图完成后会自动下载到默认下载文件夹

4. 点击"历史记录"查看和管理已保存的截图

快捷键：
- Enter：开始截图
- Escape：关闭预览

注意：首次使用时可能需要授权相关权限。
    `;

    alert(helpText);
  }

  private async sendMessage(message: Record<string, unknown>): Promise<ApiResponse> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response as ApiResponse);
        }
      });
    });
  }
}

// 初始化popup控制器
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});

// 导出类型供其他模块使用
export type { ScreenshotResponse };
export { PopupController };

// Screenshot popup controller
// Handles main screenshot functionality

interface ApiResponse {
  success: boolean;
  dataUrl?: string;
  message?: string;
}
