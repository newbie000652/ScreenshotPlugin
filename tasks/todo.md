# TODO — 显式 PNG/JPEG 格式选择

## Phase 1: Foundation
- [ ] T1: settings-model（types + image-format.ts + settings.ts）+ 单测
  - [ ] types/index.ts: Settings 增加 `imageFormat: 'png' | 'jpeg'`，导出 ImageFormat 类型
  - [ ] utils/image-format.ts（新）: normalizeImageFormat / deriveFormatFromQuality / resolveImageFormat / jpegQuality01
  - [ ] utils/settings.ts: DEFAULT_SETTINGS.imageFormat='png'；loadSettings 后 normalize
  - [ ] tests: image-format.test.ts（规范化/迁移/边界）
  - 验收: vitest 绿；typecheck 绿

## Phase 2: 并行实现
- [ ] T2: capture-engine
  - [ ] background.ts: `isJpeg` 推断 → resolveImageFormat(settings)；ext 同步
  - [ ] content.ts: region 裁剪接收 options 并用于 toDataURL；full 路径保持
  - 验收: build 绿；代码审查通过
- [ ] T3: popup 格式选择
  - [ ] popup/index.html: 格式 select（PNG/JPEG）
  - [ ] popup.ts: 加载 + 保存 imageFormat
  - 验收: build 绿；手工：popup 切换生效
- [ ] T4: options 设置页
  - [ ] options/index.html: 格式 select；滑杆门控（PNG 禁用）；首屏默认 100
  - [ ] options.ts: 加载/保存 imageFormat；G3 默认修正；G4 徽标按 dataUrl 推导
  - 验收: build 绿；手工：滑杆门控 + 徽标正确

## Checkpoint 2: 集成验证（S15）
- [ ] npm run lint / typecheck / test / build 全绿
- [ ] git diff 审查（无无关改动）

## Phase 3: 收尾
- [ ] T5: CI + README
  - [ ] .github/workflows/ci.yml（node 20: lint → typecheck → test → build）
  - [ ] package.json: typecheck 脚本
  - [ ] README: 格式功能说明
  - 验收: CI 全绿（S16）

## 后续（S17-S22）
- [ ] 分支/PR/合并
- [ ] AGENTS.md（S20）
- [ ] 文档同步（S21）
- [ ] 复盘收尾（S22）
