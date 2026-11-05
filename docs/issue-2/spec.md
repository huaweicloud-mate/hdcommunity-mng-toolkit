# Spec — Issue #2: `install --help` / `uninstall --help` 应只打印帮助

## Objective

`hdcommunity-mng-toolkit` 的 CLI 在 `install` / `uninstall` 子命令携带 `--help`（或 `-h`）时，必须只打印帮助文本并正常退出，**不得产生任何文件系统改动**。

- 用户：使用该 CLI 的开发者与 Agent（`npx --yes hdcommunity-mng-toolkit install --help`）。
- 现状缺陷：`parseArgs` 已识别 `--help`，但 `main()` 的 `case 'install'` / `case 'uninstall'` 未检查 `args.help`，直接执行真实安装/卸载，导致误写用户目录。
- 成功标准：`install --help`、`uninstall --help` 输出帮助文本、退出码 0、目标目录零改动；`install <target>` / `uninstall <target>` 正常行为不变；无命令时 `--help` 行为不变。

## Commands

```
测试: npm test            # node --test
单测: node --test test/setup-cli-help.test.mjs
复现: npx --yes hdcommunity-mng-toolkit install --help
```

## Project Structure

```
src/setup-cli.mjs          → 安装器 CLI（parseArgs / printHelp / install / uninstall / main）
test/*.test.mjs            → node:test 测试（与源码同属 ESM）
docs/issue-2/              → 本 Issue 的 spec / plan / task 文档
```

## Acceptance Criteria

- [ ] `install --help`：stdout 含帮助文本（`Usage:` 等），无 `[opencode] skills ->` 安装输出，退出码 0。
- [ ] `uninstall --help`：同上，无 `[...] removed skills from` 输出，退出码 0。
- [ ] 两者在隔离 `HOME`/`DSH_HOME` 下运行后，目标目录不存在、无任何文件创建。
- [ ] `-h` 短选项同样生效（parseArgs 已归一为 `args.help`）。
- [ ] `install --target <t>` 依然执行安装并创建 skills 目录。
- [ ] `uninstall --target <t>` 依然删除已安装 skills。
- [ ] 无命令 `--help` 仍打印帮助；现有测试全绿。

## Scope

### In Scope
- `src/setup-cli.mjs` `main()`：`case 'install'` / `case 'uninstall'` 开头增加 `args.help` 短路。
- 新增回归测试 `test/setup-cli-help.test.mjs`。

### Out of Scope
- 帮助文本内容改写、其他子命令行为、`hdcommunity-toolkit` 同源仓库修复（另开 Issue）。

## Assumptions
1. `parseArgs` 对 `--help`/`-h` 已统一置 `args.help = true`，无需新增解析逻辑。
2. `main()` 是顶层函数，`switch` 内 `return` 即结束进程入口，退出码为 0。
3. 帮助优先于实际执行：`install --help --target codex` 亦只打印帮助。