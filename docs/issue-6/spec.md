# Spec — Issue #6 README 多 agent 支持与逐 agent 安装说明重写（含安装脚本同步）

> 来源：Issue #6 正文 + VOD 收敛结论（issuecomment-6652481533）+ Issue Agent Spec（issuecomment-6652516721）
> 目标分支：`main`（仓库默认分支，`GRAPE_WORK_BRANCH` 未注入）｜优先级 P2

## 1. 背景与目标

README 安装节只有一行 `install --target opencode`，用 `...` 省略了其余 target：读者无法得知本工具链实际支持 10 个
agent target，也查不到每个 agent 的落盘路径、是否自动配置 MCP、是否需要重启会话。

同时 `src/setup-cli.mjs` 与 README 存在多处偏差：`install('all')` / `status()` 只遍历 9 个 target（漏
`codex-desktop`）、`printHelp()` 包名误写为姊妹仓 `hdcommunity-toolkit`、未知 target 不校验（静默创建
`~/.<target>/skills`）、无 `doctor` / `update` 子命令、无安装器测试。

目标：README 与脚本以**单一 `TARGETS` 真源**对齐——文档由真源派生，测试锁定一致性。

## 2. 现状核对（源码取证 `src/setup-cli.mjs` @ 17c4852）

| 事实 | 结论 |
|---|---|
| `skillsDirFor()` | 支持 10 个 target，另有 `~/.<target>/skills` 兜底分支 |
| `install('all')` | 只遍历 9 个，漏 `codex-desktop` |
| `status()` | 只列 9 个，漏 `codex-desktop` |
| `printHelp()` | 包名误写 `hdcommunity-toolkit`；未说明省略 `--target` 的默认行为 |
| `--target` 省略 | 静默默认 `opencode`，无提示；未知 target 不校验 |
| MCP 自动配置 | 仅 `opencode` 合并 `opencode.json`；其余 target 只打印通用片段（dsh 无自动注册） |
| 子命令 | 仅 install / uninstall / status / help；无 doctor / update；无安装器测试 |

## 3. 范围

### In Scope
1. `src/setup-cli.mjs`：导出单一 `TARGETS`（10 个），`install('all')` / `status()` / `printHelp()` 全部派生。
2. `--target` 校验：未知 target 明确报错、列出合法值、`process.exitCode = 1`、不创建任何目录。
3. 省略 `--target` 时打印默认说明（默认 `opencode`，行为不变）。
4. `printHelp()` 包名修正为 `hdcommunity-mng-toolkit`，补默认行为、逐 target 路径、MCP 自动注册范围。
5. 新增 `doctor`（只读体检）与 `update`（版本检测 + 重装指引，不改写用户环境）。
6. `test/setup-cli.test.mjs`：锁定 target 集合、help/status 覆盖、未知 target 退出码、README 一致性。
7. `README.md` 安装章节按 huaweicloud-devkit 结构重写：支持列表 → Quick Start → 10 个 agent 独立小节 →
   Other Agents 通用 MCP 片段 → dsh 说明。

### Out of Scope
- 为 dsh / codearts 等实现厂商级 MCP 自动注册（README 只说明现状 + 后续进展）。
- 省略 `--target` 时实现「自动检测已装 agent」（本期明确文档化为默认 opencode）。
- 姊妹仓 `hdcommunity-toolkit` 的 README / 安装器同步、npm 发布与版本号策略。

## 4. 期望行为

### 4.1 target 真源
```js
export const TARGETS = [
  'opencode', 'codex', 'codex-desktop', 'codearts', 'codearts-work',
  'workbuddy', 'dsh', 'hermes', 'openclaw', 'atomcode',
];
```
`codex` 与 `codex-desktop` 共用 `~/.codex/skills`（保持现有 switch 语义）；`all` 安装按落盘目录去重，
避免重复拷贝，但输出仍逐个 target 可辨识。

### 4.2 命令
| 命令 | 行为 |
|---|---|
| `install --target <agent\|all>` | 拷贝 skills；opencode 额外合并 MCP 配置；其余 target 打印通用片段 |
| `install`（无 `--target`） | 等同 `--target opencode`，并输出默认行为说明 |
| `install --target <未知>` | stderr 报错 + 列出合法值，exit 1，不落盘 |
| `uninstall --target <agent\|all>` | 移除本包 skills（按目录遍历） |
| `status` | 列出全部 10 个 target 的安装状态与路径 |
| `doctor` | 只读体检：Node ≥ 22、skills 源、各 target 落地、opencode MCP 条目；不修改任何文件 |
| `update` | 打印当前版本、尽力查询 npm 最新版本、给出 `npx --yes hdcommunity-mng-toolkit@latest` 重装指引 |
| `help` | 包名、用法、默认行为、10 个 target 及其路径 |

`doctor` 的退出码只在环境性故障（Node < 22、skills 源缺失）时为 1；「未安装」属信息项，不影响退出码。

## 5. 验收标准

- [ ] README 安装节列出全部 10 个 target，与 `TARGETS` 完全一致
- [ ] 每个 target 有独立小节：install 命令 + 落盘路径 + 是否自动配 MCP + 重启会话提醒 + `status`/`uninstall`（+ `doctor`）
- [ ] README 明写省略 `--target` = 默认 `opencode`；未知 target 报错并列出合法值
- [ ] `install --target all` 与 `status` 均覆盖 10 个 target（含 `codex-desktop`）
- [ ] `help` 包名为 `hdcommunity-mng-toolkit`，含完整 target 列表与省略行为说明
- [ ] dsh 小节说明 MCP 接入方式（当前手动片段 / 自动注册进展）
- [ ] Other Agents 小节给出通用 MCP 配置片段（local stdio）
- [ ] `node --test` 全绿，新增 setup-cli 测试通过；`npm run smoke` 通过

## 6. 参考
- huaweicloud-devkit README 安装节结构（Quick Start / 逐 agent / Other Agents）
- 姊妹仓 `hdcommunity-toolkit` PR #22：`install --target dsh` 自动写入 `~/.dsh/profiles/<profile>/cordis.patch.yml`
  （本仓尚未同步，README 只说明现状与进展）