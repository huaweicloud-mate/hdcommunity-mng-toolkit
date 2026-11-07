# Plan — Issue #13 uninstall opencode MCP 清理

## 方案概述

新增 `removeOpencodeMcp()`，与 `removeDshMcp()` / `src/dsh-patch.mjs::removeDshPatchEntry()` 同构：定位 `opencodeConfigFile()`，仅删除受管键 `cfg.mcp[PKG_NAME]`，保留其余内容并合法写回。

## 实现路径

1. `src/setup-cli.mjs`
   - 新增 `removeOpencodeMcp()`：
     - 文件不存在 → 输出 `not found`，直接返回（无害）。
     - 读取失败或 JSON 解析失败 → 不写回，输出提示，返回。
     - `cfg.mcp?.[PKG_NAME]` 不存在 → 输出 `not found`，不改文件。
     - 存在 → `delete cfg.mcp[PKG_NAME]`，`writeFileSync(file, JSON.stringify(cfg, null, 2))`，输出 `removed from`。
     - `cfg.mcp` 变空时保留空对象，避免过度清洗用户字段。
2. `uninstall(target)`：清理 skills 后追加 `if (targets.includes('opencode')) removeOpencodeMcp();`。
3. `test/setup-cli.test.mjs`：在 `uninstall` describe 增加对称/幂等/保留用户配置/无害/`all` 用例。

## 关键决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 删除粒度 | 按键 `mcp[PKG_NAME]` 删除 | 与 dsh 一致，避免误删用户其它 MCP |
| 文件缺失 | 静默跳过 | 满足未安装卸载无害 |
| 非法 JSON | 不写回并提示 | 保护用户已有配置 |
| 无匹配键 | 不改写文件 | 幂等、零副作用 |

## 测试 seam

CLI 端到端 seam（`bin/setup.cjs` + 隔离 `HOME`），断言用户可见行为（输出 + 文件内容），与现有 `test/setup-cli.test.mjs` 一致。

## 风险

| 风险 | 缓解 |
|------|------|
| `.jsonc` 含注释解析失败 | 不写回、提示，与 install 现有回退语义一致 |
| 用户手改 MCP 条目 | 只删受管键 `mcp[PKG_NAME]` |
| `--target all` 遗漏 | 显式 `targets.includes('opencode')` + 测试覆盖 |