// Options Page Script for Screenshot Plugin

interface ScreenshotData {
  id: string;
  dataUrl: string;
  timestamp: number;
  filename: string;
  url: string;
  title: string;
}

interface Settings {
  captureMode: 'visible' | 'full';
  autoDownload: boolean;
  saveHistory: boolean;
  maxHistory: number;
  imageQuality: number;
  filenamePattern: string;
}

interface ApiResponse {
  success: boolean;
  screenshots?: ScreenshotData[];
  message?: string;
}

class OptionsController {
  private currentTab: string = 'history';
  private screenshots: ScreenshotData[] = [];
  private settings: Settings = {
    captureMode: 'visible',
    autoDownload: true,
    saveHistory: true,
    maxHistory: 50,
    imageQuality: 90,
    filenamePattern: 'screenshot_{date}_{time}',
  };
  private currentPage: number = 1;
  private itemsPerPage: number = 12;
  private filteredScreenshots: ScreenshotData[] = [];

  constructor() {
    this.initializeElements();
    this.bindEvents();
    this.loadData();
  }

  private initializeElements(): void {
    // Tab buttons
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach((button) => {
      button.addEventListener('click', (e) => {
        const target = e.target as HTMLButtonElement;
        this.switchTab(target.dataset.tab || 'history');
      });
    });

    // Modal close buttons
    const modalCloseButtons = document.querySelectorAll('.modal-close');
    modalCloseButtons.forEach((button) => {
      button.addEventListener('click', () => this.closeModal());
    });

    // Click outside modal to close
    const modal = document.getElementById('modal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.closeModal();
        }
      });
    }
  }

  private bindEvents(): void {
    // History tab events
    this.bindHistoryEvents();

    // Settings tab events
    this.bindSettingsEvents();

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeModal();
      }
    });
  }

  private bindHistoryEvents(): void {
    // Toolbar buttons
    const clearAllBtn = document.getElementById('clear-all-btn');
    const exportBtn = document.getElementById('export-btn');
    const refreshBtn = document.getElementById('refresh-btn');

    clearAllBtn?.addEventListener('click', () => this.clearAllScreenshots());
    exportBtn?.addEventListener('click', () => this.exportData());
    refreshBtn?.addEventListener('click', () => this.loadScreenshots());

    // Search and sort
    const searchInput = document.getElementById('search-input') as HTMLInputElement;
    const sortSelect = document.getElementById('sort-select') as HTMLSelectElement;

    searchInput?.addEventListener('input', () => this.filterScreenshots());
    sortSelect?.addEventListener('change', () => this.filterScreenshots());

    // Pagination
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');

    prevPageBtn?.addEventListener('click', () => this.changePage(-1));
    nextPageBtn?.addEventListener('click', () => this.changePage(1));
  }

  private bindSettingsEvents(): void {
    // Settings form elements
    const imageQuality = document.getElementById('image-quality') as HTMLInputElement;
    const qualityValue = document.getElementById('quality-value');

    // Update quality display
    imageQuality?.addEventListener('input', () => {
      if (qualityValue) {
        qualityValue.textContent = `${imageQuality.value}%`;
      }
    });

    // Settings buttons
    const saveSettingsBtn = document.getElementById('save-settings');
    const resetSettingsBtn = document.getElementById('reset-settings');

    saveSettingsBtn?.addEventListener('click', () => this.saveSettings());
    resetSettingsBtn?.addEventListener('click', () => this.resetSettings());
  }

  private async loadData(): Promise<void> {
    await Promise.all([this.loadScreenshots(), this.loadSettings()]);
  }

  private async loadScreenshots(): Promise<void> {
    this.showLoading(true);

    try {
      const response = await this.sendMessage({ action: 'getHistory' }) as ApiResponse;

      if (response.success) {
        this.screenshots = response.screenshots || [];
        this.filterScreenshots();
      } else {
        this.showError('加载历史记录失败');
      }
    } catch (error) {
      console.error('Load screenshots error:', error);
      this.showError('加载历史记录失败');
    } finally {
      this.showLoading(false);
    }
  }

  private async loadSettings(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['settings']);
      if (result.settings) {
        this.settings = { ...this.settings, ...result.settings };
      }
      this.updateSettingsUI();
    } catch (error) {
      console.error('Load settings error:', error);
    }
  }

  private updateSettingsUI(): void {
    const defaultMode = document.getElementById('default-mode') as HTMLSelectElement;
    const autoDownload = document.getElementById('auto-download') as HTMLInputElement;
    const saveHistory = document.getElementById('save-history') as HTMLInputElement;
    const maxHistory = document.getElementById('max-history') as HTMLInputElement;
    const imageQuality = document.getElementById('image-quality') as HTMLInputElement;
    const qualityValue = document.getElementById('quality-value');
    const filenamePattern = document.getElementById('filename-pattern') as HTMLInputElement;

    if (defaultMode) defaultMode.value = this.settings.captureMode;
    if (autoDownload) autoDownload.checked = this.settings.autoDownload;
    if (saveHistory) saveHistory.checked = this.settings.saveHistory;
    if (maxHistory) maxHistory.value = this.settings.maxHistory.toString();
    if (imageQuality) {
      imageQuality.value = this.settings.imageQuality.toString();
      if (qualityValue) {
        qualityValue.textContent = `${this.settings.imageQuality}%`;
      }
    }
    if (filenamePattern) filenamePattern.value = this.settings.filenamePattern;
  }

  private async saveSettings(): Promise<void> {
    try {
      const defaultMode = document.getElementById('default-mode') as HTMLSelectElement;
      const autoDownload = document.getElementById('auto-download') as HTMLInputElement;
      const saveHistory = document.getElementById('save-history') as HTMLInputElement;
      const maxHistory = document.getElementById('max-history') as HTMLInputElement;
      const imageQuality = document.getElementById('image-quality') as HTMLInputElement;
      const filenamePattern = document.getElementById('filename-pattern') as HTMLInputElement;

      this.settings = {
        captureMode: (defaultMode?.value as 'visible' | 'full') || 'visible',
        autoDownload: autoDownload?.checked || true,
        saveHistory: saveHistory?.checked || true,
        maxHistory: parseInt(maxHistory?.value || '50'),
        imageQuality: parseInt(imageQuality?.value || '90'),
        filenamePattern: filenamePattern?.value || 'screenshot_{date}_{time}',
      };

      await chrome.storage.local.set({ settings: this.settings });
      this.showSuccess('设置已保存');
    } catch (error) {
      console.error('Save settings error:', error);
      this.showError('保存设置失败');
    }
  }

  private async resetSettings(): Promise<void> {
    if (confirm('确定要重置所有设置为默认值吗？')) {
      this.settings = {
        captureMode: 'visible',
        autoDownload: true,
        saveHistory: true,
        maxHistory: 50,
        imageQuality: 90,
        filenamePattern: 'screenshot_{date}_{time}',
      };

      await chrome.storage.local.set({ settings: this.settings });
      this.updateSettingsUI();
      this.showSuccess('设置已重置');
    }
  }

  private filterScreenshots(): void {
    const searchInput = document.getElementById('search-input') as HTMLInputElement;
    const sortSelect = document.getElementById('sort-select') as HTMLSelectElement;

    const searchTerm = searchInput?.value.toLowerCase() || '';
    const sortBy = sortSelect?.value || 'newest';

    // Filter by search term
    this.filteredScreenshots = this.screenshots.filter(
      (screenshot) =>
        screenshot.title.toLowerCase().includes(searchTerm) ||
        screenshot.url.toLowerCase().includes(searchTerm) ||
        screenshot.filename.toLowerCase().includes(searchTerm)
    );

    // Sort
    this.filteredScreenshots.sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return a.timestamp - b.timestamp;
        case 'name':
          return a.filename.localeCompare(b.filename);
        case 'newest':
        default:
          return b.timestamp - a.timestamp;
      }
    });

    this.currentPage = 1;
    this.renderScreenshots();
  }

  private renderScreenshots(): void {
    const grid = document.getElementById('screenshots-grid');
    const emptyState = document.getElementById('empty-state');

    if (!grid || !emptyState) return;

    if (this.filteredScreenshots.length === 0) {
      grid.style.display = 'none';
      emptyState.style.display = 'block';
      this.updatePagination();
      return;
    }

    grid.style.display = 'grid';
    emptyState.style.display = 'none';

    // Calculate pagination
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const pageScreenshots = this.filteredScreenshots.slice(startIndex, endIndex);

    // Render screenshots
    grid.innerHTML = pageScreenshots
      .map((screenshot) => this.createScreenshotItem(screenshot))
      .join('');

    // Bind click events
    grid.querySelectorAll('.screenshot-item').forEach((item, index) => {
      item.addEventListener('click', () => {
        this.showScreenshotModal(pageScreenshots[index]);
      });
    });

    // Bind action buttons
    grid.querySelectorAll('.action-btn[data-action="download"]').forEach((btn, index) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.downloadScreenshot(pageScreenshots[index]);
      });
    });

    grid.querySelectorAll('.action-btn[data-action="delete"]').forEach((btn, index) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteScreenshot(pageScreenshots[index].id);
      });
    });

    this.updatePagination();
  }

  private createScreenshotItem(screenshot: ScreenshotData): string {
    const date = new Date(screenshot.timestamp);
    const formattedDate = date.toLocaleDateString('zh-CN');
    const formattedTime = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

    return `
      <div class="screenshot-item" data-id="${screenshot.id}">
        <img src="${screenshot.dataUrl}" alt="${screenshot.title}" class="screenshot-thumbnail">
        <div class="screenshot-info">
          <div class="screenshot-title">${screenshot.title || '无标题'}</div>
          <div class="screenshot-meta">
            <span class="screenshot-date">${formattedDate} ${formattedTime}</span>
            <span class="screenshot-size">PNG</span>
          </div>
          <div class="screenshot-actions">
            <button class="action-btn btn-primary" data-action="download">下载</button>
            <button class="action-btn btn-danger" data-action="delete">删除</button>
          </div>
        </div>
      </div>
    `;
  }

  private showScreenshotModal(screenshot: ScreenshotData): void {
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modal-title');
    const modalImage = document.getElementById('modal-image') as HTMLImageElement;
    const modalInfo = document.getElementById('modal-info');
    const modalDownload = document.getElementById('modal-download');
    const modalDelete = document.getElementById('modal-delete');

    if (!modal || !modalTitle || !modalImage || !modalInfo) return;

    const date = new Date(screenshot.timestamp);

    modalTitle.textContent = screenshot.title || '无标题';
    modalImage.src = screenshot.dataUrl;
    modalInfo.innerHTML = `
      <p><strong>文件名：</strong>${screenshot.filename}</p>
      <p><strong>创建时间：</strong>${date.toLocaleString('zh-CN')}</p>
      <p><strong>来源页面：</strong>${screenshot.url}</p>
      <p><strong>页面标题：</strong>${screenshot.title}</p>
    `;

    // Bind modal actions
    modalDownload?.replaceWith(modalDownload.cloneNode(true));
    modalDelete?.replaceWith(modalDelete.cloneNode(true));

    const newDownloadBtn = document.getElementById('modal-download');
    const newDeleteBtn = document.getElementById('modal-delete');

    newDownloadBtn?.addEventListener('click', () => {
      this.downloadScreenshot(screenshot);
      this.closeModal();
    });

    newDeleteBtn?.addEventListener('click', () => {
      this.deleteScreenshot(screenshot.id);
      this.closeModal();
    });

    modal.style.display = 'flex';
  }

  private closeModal(): void {
    const modal = document.getElementById('modal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  private downloadScreenshot(screenshot: ScreenshotData): void {
    const link = document.createElement('a');
    link.href = screenshot.dataUrl;
    link.download = screenshot.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  private async deleteScreenshot(id: string): Promise<void> {
    if (!confirm('确定要删除这张截图吗？')) return;

    try {
      const response = await this.sendMessage({ action: 'deleteScreenshot', id }) as ApiResponse;

      if (response.success) {
        this.screenshots = this.screenshots.filter((s) => s.id !== id);
        this.filterScreenshots();
        this.showSuccess('截图已删除');
      } else {
        this.showError('删除失败');
      }
    } catch (error) {
      console.error('Delete screenshot error:', error);
      this.showError('删除失败');
    }
  }

  private async clearAllScreenshots(): Promise<void> {
    if (!confirm('确定要清空所有截图历史记录吗？此操作不可恢复。')) return;

    try {
      await chrome.storage.local.set({ screenshots: [] });
      this.screenshots = [];
      this.filterScreenshots();
      this.showSuccess('历史记录已清空');
    } catch (error) {
      console.error('Clear all error:', error);
      this.showError('清空失败');
    }
  }

  private exportData(): void {
    const data = {
      screenshots: this.screenshots,
      settings: this.settings,
      exportTime: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `screenshot-plugin-backup-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    this.showSuccess('数据已导出');
  }

  private changePage(direction: number): void {
    const totalPages = Math.ceil(this.filteredScreenshots.length / this.itemsPerPage);
    const newPage = this.currentPage + direction;

    if (newPage >= 1 && newPage <= totalPages) {
      this.currentPage = newPage;
      this.renderScreenshots();
    }
  }

  private updatePagination(): void {
    const totalPages = Math.ceil(this.filteredScreenshots.length / this.itemsPerPage);
    const prevBtn = document.getElementById('prev-page') as HTMLButtonElement;
    const nextBtn = document.getElementById('next-page') as HTMLButtonElement;
    const pageInfo = document.getElementById('page-info');

    if (prevBtn) prevBtn.disabled = this.currentPage <= 1;
    if (nextBtn) nextBtn.disabled = this.currentPage >= totalPages;
    if (pageInfo) {
      pageInfo.textContent = `第 ${this.currentPage} 页，共 ${totalPages} 页`;
    }
  }

  private switchTab(tabName: string): void {
    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach((btn) => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-content').forEach((content) => {
      content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`)?.classList.add('active');

    this.currentTab = tabName;

    // 根据当前标签页执行特定逻辑
    if (this.currentTab === 'history') {
      this.loadScreenshots();
    }
  }

  private showLoading(show: boolean): void {
    const loading = document.getElementById('loading');
    if (loading) {
      loading.style.display = show ? 'block' : 'none';
    }
  }

  private showSuccess(message: string): void {
    this.showToast(message, 'success');
  }

  private showError(message: string): void {
    this.showToast(message, 'error');
  }

  private showToast(message: string, type: 'success' | 'error'): void {
    // Simple toast implementation
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 6px;
      color: white;
      font-weight: 500;
      z-index: 10000;
      animation: slideIn 0.3s ease;
      background: ${type === 'success' ? '#28a745' : '#dc3545'};
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    }, 3000);
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

// Initialize options controller
document.addEventListener('DOMContentLoaded', () => {
  new OptionsController();
});

// Add toast animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
`;
document.head.appendChild(style);

export type { ScreenshotData, Settings };
export { OptionsController };
