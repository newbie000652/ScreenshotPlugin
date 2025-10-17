export type CaptureMode = 'visible' | 'full' | 'region';

export interface ScreenshotData {
  id: string;
  dataUrl: string;
  timestamp: number;
  filename: string;
  url: string;
  title: string;
}

export interface Settings {
  captureMode: CaptureMode;
  autoDownload: boolean;
  saveHistory: boolean;
  maxHistory: number;
  imageQuality: number;
  filenamePattern: string;
}

export interface ContentResponse {
  success: boolean;
  dataUrl?: string;
  error?: string;
}

export interface CaptureResponse {
  success: boolean;
  dataUrl?: string;
  filename?: string;
  error?: string;
}

export interface HistoryResponse {
  success: boolean;
  screenshots?: ScreenshotData[];
  error?: string;
}
