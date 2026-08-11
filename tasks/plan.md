# Implementation Plan: Explicit PNG/JPEG Format Selection

> 试运行（22 槽 AI Agent Workflow）· 2026-08-11
> 需求来源：trial/00-requirements.md（S03 确认版，方案 A）
> 架构：trial/04-design-findings.md（S08）

## Overview

将截图格式从隐式推断（imageQuality<100=JPEG）改为显式 `imageFormat: 'png'|'jpeg'` 设置：新增设置字段 + 存量迁移、popup/options 双入口、region 路径修复、历史徽标修正、滑杆门控、首个单元测试套件 + CI。

## Architecture Decisions

- **AD1** `imageFormat` 为格式唯一真源；`imageQuality` 仅作 JPEG 质量（滑杆 50-100，PNG 时禁用）
- **AD2** 纯函数集中到 `src/utils/image-format.ts`（可单测）：`normalizeImageFormat` / `deriveFormatFromQuality` / `resolveImageFormat(settings)` / `jpegQuality01(settings)`
- **AD3** 迁移：loadSettings 后统一 normalize；旧设置无 imageFormat → quality<100 ? jpeg : png
- **AD4** 历史徽标从 dataUrl 前缀推导（不改存储）
- **AD5** 新增 `typecheck` 脚本（tsc --noEmit）；CI = lint → typecheck → test → build

## Task List

### Phase 1: Foundation（串行，先行）
- [ ] T1: settings-model（types + image-format.ts + settings.ts 集成）+ 单元测试

### Checkpoint 1: 测试绿 + typecheck 绿

### Phase 2: 并行实现（T1 完成后 3 路并行）
- [ ] T2: capture-engine（background.ts 显式格式；content.ts region 修复）
- [ ] T3: popup 格式选择控件
- [ ] T4: options 格式选择 + 滑杆门控 + G3 默认值 + G4 徽标

### Checkpoint 2: build 绿 + lint 绿 + 集成验证

### Phase 3: 收尾
- [ ] T5: CI workflow（.github/workflows/ci.yml）+ README 更新

### Checkpoint 3: CI 全绿（S16 门禁）

## Task Dependencies

```
T1 (contract: imageFormat + normalize API)
 ├─▶ T2 (engine 消费 contract)
 ├─▶ T3 (popup 消费 contract)
 ├─▶ T4 (options 消费 contract)
 └─▶ T5 (依赖 T2/T3/T4 完成)
```

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| 迁移边界 | Med | normalize 单测（缺失字段/非法值/边界 100） |
| region 路径复发 | Med | 统一 options 传递；code review 兜底 |
| 并行写冲突 | Low | T2/T3/T4 文件集不重叠（background/content vs popup vs options） |

## Open Questions

- 无（需求已确认；S17 推送方式现场决策）
