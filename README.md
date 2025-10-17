# Screenshot Plugin

A Chrome/Edge MV3 extension for capturing the visible area, full page, or a selected region. Built with TypeScript, Vite, and Tailwind CSS v4.

## Develop

```powershell
npm install
npm run dev
```

This builds Tailwind styles and starts Vite for live reload. Load the `dist` folder as an unpacked extension in your browser (Developer mode).

## Build

```powershell
npm run build
```

Outputs to `dist/` and copies static assets.

## Test

- Unit tests (placeholder): `npm run test`
- Lint: `npm run lint`

## Features

- Visible area, full page, and region capture
- History management and quick download
- Adaptive popup layout with accessible keyboard navigation

## Implementation notes

- Full page capture stitches multiple visible frames. Before capture, the content script temporarily:
  - Disables animations/transitions and smooth scrolling
  - Hides fixed/sticky UI to prevent duplication
  - Locks scrollbars to avoid layout shift
  - Restores everything after capture
- Extreme pages are downscaled during stitching to avoid canvas memory limits.

## Known limitations / TODO

- Some sites using complex overlays or canvas-only UIs may still require per-site tuning (selector allow/deny list).
- Optional: capture progress indicator for very long pages.
- Optional: overlap-and-blend stitching for pixel-perfect seams on ultra-long documents.

## License

MIT# Screenshot Plugin

一个 Chrome 浏览器扩展，用于快速截取网页截图并管理历史记录。

## 功能特性

- 🖼️ 一键截取可视区域或整个页面
- 📁 本地历史记录管理
- ⚙️ 可自定义设置
- 💾 自动下载截图
- 🔍 截图搜索和排序

## 开发

### 安装依赖
```bash
npm install