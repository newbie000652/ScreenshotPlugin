// Popup Script for Screenshot Plugin

import type { CaptureMode, CaptureResponse } from '../types';
import { loadSettings, normalizeCaptureMode } from '../utils/settings';

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

    const missingElements = elements.filter((element, index) => {
      if (!element) {
        console.error(`Element at index ${index} not found`);
        return true;
      }
      return false;
    });

    if (missingElements.length > 0) {
      throw new Error(`Missing ${missingElements.length} required elements`);
    }

    // 初始调整高度
    setTimeout(() => this.adjustPopupHeight(), 100);
  }

  private bindEvents(): void {
    if (this.captureBtn) {
      this.captureBtn.addEventListener('click', () => this.handleCapture());
    }
    if (this.historyBtn) {
      this.historyBtn.addEventListener('click', () => this.openHistoryPage());
    }
    if (this.modeSelect) {
      this.modeSelect.addEventListener('change', () => this.saveSettings());
    }
    if (this.downloadBtn) {
      this.downloadBtn.addEventListener('click', () => this.downloadCurrentImage());
    }
    if (this.closePreviewBtn) {
      this.closePreviewBtn.addEventListener('click', () => this.hidePreview());
    }
    if (this.optionsLink) {
      this.optionsLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.openOptionsPage();
      });
    }
    if (this.helpLink) {
      this.helpLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.showHelp();
      });
    }

    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && this.captureBtn && !this.captureBtn.disabled) {
        this.handleCapture();
      } else if (e.key === 'Escape') {
        this.hidePreview();
      }
    });
  }

  private async loadSettings(): Promise<void> {
    try {
      const settings = await loadSettings();
      this.modeSelect.value = normalizeCaptureMode(settings.captureMode);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  private async saveSettings(): Promise<void> {
    try {
      // Merge into shared settings object for consistency
      const existing = await chrome.storage.local.get(['settings']);
      const settings = {
        ...(existing.settings || {}),
        captureMode: normalizeCaptureMode(this.modeSelect.value as CaptureMode),
      };
      await chrome.storage.local.set({ settings, captureMode: settings.captureMode });
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  private async handleCapture(): Promise<void> {
  const mode = normalizeCaptureMode(this.modeSelect.value as CaptureMode);

    this.setLoading(true);
    this.showStatus('正在截取...', 'loading');
    this.hidePreview();

    try {
      const response = await this.sendMessage({
        action: 'capture',
        mode,
      });

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
    this.adjustPopupHeight();
  }

  private hideStatus(): void {
    this.statusDiv.style.display = 'none';
    this.adjustPopupHeight();
  }

  private showPreview(dataUrl: string): void {
    this.previewImage.src = dataUrl;
    this.previewDiv.style.display = 'block';
    this.adjustPopupHeight();
  }

  private hidePreview(): void {
    this.previewDiv.style.display = 'none';
    this.previewImage.src = '';
    this.adjustPopupHeight();
  }

  private adjustPopupHeight(): void {
    // 使用 requestAnimationFrame 确保 DOM 更新后再调整高度
    requestAnimationFrame(() => {
      const container = document.querySelector('.popup-container') as HTMLElement;
      if (!container) return;

      // 计算容器完整高度（含外边距的可视余量）
      const rect = container.getBoundingClientRect();
      const styles = getComputedStyle(container);
      const marginTop = parseFloat(styles.marginTop || '0');
      const marginBottom = parseFloat(styles.marginBottom || '0');
      const chromePadding = 6; // 外层阴影/圆角视觉余量
      const epsilon = 1; // 防止出现 1px 溢出导致滚动条

      const contentHeight = rect.height + marginTop + marginBottom + chromePadding;
      const minHeight = 420;
      const maxHeight = 680;

      // 限制在最小和最大高度之间
      const targetHeight = Math.min(Math.max(Math.ceil(contentHeight) + epsilon, minHeight), maxHeight);
      document.body.style.height = `${targetHeight}px`;
    });
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

  private async sendMessage(message: Record<string, unknown>): Promise<CaptureResponse> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          const error = chrome.runtime.lastError;
          reject(new Error(error?.message || '通信失败'));
        } else {
          resolve(response as CaptureResponse);
        }
      });
    });
  }
}

// 初始化popup控制器
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});

export { PopupController };
