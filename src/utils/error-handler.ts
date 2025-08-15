// 统一的错误处理工具

export interface ErrorInfo {
  message: string;
  code?: string;
  details?: unknown;
  timestamp: number;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorLog: ErrorInfo[] = [];

  private constructor() {}

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * 处理错误并记录日志
   */
  handleError(error: unknown, context?: string): ErrorInfo {
    const errorInfo: ErrorInfo = {
      message: this.getErrorMessage(error),
      code: this.getErrorCode(error),
      details: error,
      timestamp: Date.now(),
    };

    // 记录错误日志
    this.logError(errorInfo, context);

    // 在开发环境下输出到控制台
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) {
      const manifest = chrome.runtime.getManifest();
      if (manifest.version.includes('dev') || manifest.version.includes('beta')) {
        console.error(`[${context || 'Unknown'}] Error:`, errorInfo);
      }
    }

    return errorInfo;
  }

  /**
   * 获取用户友好的错误消息
   */
  getUserFriendlyMessage(error: unknown): string {
    const message = this.getErrorMessage(error);
    
    // 映射常见错误到用户友好的消息
    const errorMap: Record<string, string> = {
      'No active tab found': '未找到活动标签页，请确保有页面打开',
      '截图失败': '截图操作失败，请重试',
      '通信失败': '与浏览器扩展通信失败，请刷新页面重试',
      'Failed to save screenshot to storage': '保存截图失败，请检查存储空间',
      'Failed to download screenshot': '下载截图失败，请检查下载设置',
      'Content script not available': '页面脚本不可用，请刷新页面重试',
    };

    return errorMap[message] || message;
  }

  /**
   * 获取错误消息
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return '未知错误';
  }

  /**
   * 获取错误代码
   */
  private getErrorCode(error: unknown): string | undefined {
    if (error instanceof Error && 'code' in error) {
      return (error as Error & { code: string }).code;
    }
    return undefined;
  }

  /**
   * 记录错误日志
   */
  private logError(errorInfo: ErrorInfo, context?: string): void {
    this.errorLog.push({
      ...errorInfo,
      message: `[${context || 'Unknown'}] ${errorInfo.message}`,
    });

    // 限制日志数量，最多保存100条
    if (this.errorLog.length > 100) {
      this.errorLog = this.errorLog.slice(-100);
    }
  }

  /**
   * 获取错误日志
   */
  getErrorLog(): ErrorInfo[] {
    return [...this.errorLog];
  }

  /**
   * 清空错误日志
   */
  clearErrorLog(): void {
    this.errorLog = [];
  }
}

// 导出单例实例
export const errorHandler = ErrorHandler.getInstance();
