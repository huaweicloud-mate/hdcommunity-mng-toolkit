# Spec — Issue #13 uninstall --target opencode 残留 MCP 配置条目

## 1. 目标

让 `uninstall --target opencode` 与 `install --target opencode` 对称：卸载时移除 skills 后，同时删除 `opencode.json`（或 `.jsonc`）中本工具写入的 `mcp.hdcommunity-mng-toolkit` 配置块，不残留无效 MCP 条目。

## 2. 背景

`install --target opencode` 通过 `mergeOpencodeConfig()` 向 `~/.config/opencode/opencode.json` 写入 `mcp.hdcommunity-mng-toolkit`；`uninstall()` 只清理 skills，仅对 `dsh` 调用 `removeDshMcp()`，opencode 无对应删除逻辑。用户实测 v0.6.0 卸载后 `grep -c hdcommunity opencode.json` = 3。

## 3. 范围

### In Scope
- `src/setup-cli.mjs`：新增 `removeOpencodeMcp()`，`uninstall()` 对 `opencode`（含 `all`）调用。
- 复用 `opencodeConfigFile()` / `PKG_NAME`，按 `cfg.mcp[PKG_NAME]` 幂等删除，保留用户其它 MCP 条目与顶层字段。
- 文件缺失、无 `mcp`、无该键时静默跳过；JSON 解析失败时不写回并提示。
- `test/setup-cli.test.mjs`：新增 install→uninstall 对称、保留用户配置、未安装无害、重装幂等、`--target all` 清理用例。

### Out of Scope
- 不改动其它 target 的安装/卸载逻辑。
- 不改动 MCP server 协议/工具实现。
- 不引入新配置格式或数据迁移。

## 4. 期望行为

1. `install --target opencode` 后 `uninstall --target opencode`，`opencode.json` 中不再含 `hdcommunity`，且文件仍为合法 JSON。
2. 用户已有其它 MCP 条目与顶层字段在卸载后保持不变。
3. 未安装时 `uninstall --target opencode` 正常退出（退出码 0），不创建空文件、不报错。
4. 卸载后再次 install 不产生重复条目（幂等）。
5. `uninstall --target all` 同样清理 opencode MCP 条目。

## 5. 验收标准

- [ ] 复现脚本：install → uninstall 后 `grep -c hdcommunity opencode.json` 输出 0。
- [ ] 用户其它 MCP 配置与其余字段不变，JSON 合法。
- [ ] 未安装场景 uninstall 退出码 0 且不创建文件。
- [ ] uninstall → install 无重复条目。
- [ ] `--target all` 清理 opencode MCP 条目。
- [ ] `npm test` 全部通过。