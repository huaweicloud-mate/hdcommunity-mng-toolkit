# Plan — Issue #11 dsh target MCP 自动注册

## 1. 设计决策

| 决策 | 选择 | 理由 |
|---|---|---|
| 写入方式 | 受管注释块 + 文本外科 | 零依赖，对齐 toolkit 0.7.0，避免破坏用户手写内容 |
| 幂等键 | 按 id 判重 + 按注释块增删 | 手写同 id 不重复；手写条目不被误删 |
| profile | 默认 `web`，`DSH_PROFILE` 覆盖 | 与 toolkit 一致 |
| 默认地址 | `BACKEND_BASE`（`HDCOMMUNITY_BASE` 可覆盖） | 与 `src/config.mjs` 单一来源一致 |
| fail-fast | 写入前校验 DSH_HOME、路径组件、patch 可写性与末文档序列 | 避免半成品，满足验收 |
| doctor | `dshPatchState()` 三态 | README/验收要求 OK/MISSING/INVALID |

## 2. 模块设计

### `src/dsh-patch.mjs`（新增）
- `DSH_DEFAULT_PROFILE` / `DSH_PATCH_ID` / `DSH_PATCH_MANAGED_COMMENT`
- `dshHome()` / `dshPatchFile()` / `dshBackendBase()`
- `renderDshPatchEntry(base)` / `findDshPatchEntry(text)` / `isSequenceDocument(text)`
- `upsertDshPatch(file, base)` → `created | updated | skipped | invalid`
- `removeDshPatchEntry(file)` → `{ removed }`
- `dshPatchState(file)` → `OK | MISSING | INVALID`
- `validateDshConfig(file)` → `{ ok, code?, reason? }`，只读校验，不建目录

### `src/setup-cli.mjs`（修改）
- `MCP_AUTO_TARGETS = ['opencode', 'dsh']`
- `install` / `installAll`：写文件前先 `ensureDshReady()`；失败设置 exitCode=1 并直接返回（不拷贝 skills）。
- `mergeDshMcp()`：调用 `upsertDshPatch`，区分 created/updated/skipped/invalid。
- `uninstall`：targets 含 dsh 时调用 `removeDshPatchEntry`。
- `doctor`：输出 `dsh MCP: <STATE> (<file>)`，INVALID 计入 problems。

### 文档与测试
- README target 表、Quick Start、DSH 小节更新。
- CHANGELOG Unreleased 条目。
- `test/dsh-patch.test.mjs` 纯函数边界；`test/setup-cli.test.mjs` CLI 端到端（临时 HOME/DSH_HOME）。

## 3. 测试 seam

- 纯模块：`src/dsh-patch.mjs` 导出的公开函数。
- CLI：`bin/setup.cjs` 进程边界，隔离 `HOME` / `DSH_HOME` / `DSH_PROFILE`，断言文件与退出码。