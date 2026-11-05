# Plan — Issue #6 README 多 agent 支持与安装脚本同步

## 1. 设计决策

| 决策 | 选择 | 理由 |
|---|---|---|
| target 集合维护 | 单一 `export const TARGETS` | 从根上防止 `all`/`status` 再次漏项，测试可直接断言 |
| README 与脚本谁先改 | 脚本为真源，README 由真源派生 | 单改文档会把「漏 codex-desktop」「包名错误」固化成文档事实 |
| 省略 `--target` 语义 | 保持默认 `opencode`，并在 stdout + README 明写 | 零行为变更；自动检测属新功能，另开 issue |
| 未知 target | 报错 + 列出合法值 + exit 1 + 不落盘 | 避免静默生成 `~/.<target>/skills` 垃圾目录 |
| `all` 安装 | 按落盘目录去重（codex / codex-desktop 共用 `~/.codex/skills`） | 避免重复拷贝与重复片段刷屏，输出仍逐个 target 可辨识 |
| doctor 深度 | 只读体检，不修改任何文件；仅环境性故障 exit 1 | 满足「每节统一命令」，不触碰用户环境 |
| update 深度 | 版本检测 + 重装指引，不自动升级 | 不擅自改写用户环境；离线时降级为指引 |
| 测试 seam | ① `TARGETS` 具名导出 ② `bin/setup.cjs` 子进程端到端（`HOME` 指向临时目录） | 复用现有入口，测用户可见行为而非内部实现 |

## 2. 模块设计

### `src/setup-cli.mjs`（修改）

```
export const TARGETS = [...10]

skillsDirFor(target)     // 保持现路径；default 分支改为抛错（防御，不应可达）
mcpAutoFor(target)       // 仅 opencode 自动合并 opencode.json
install(target)          // 'all' -> installAll()；单 target -> copySkills + MCP 分支
installAll()             // 按 dest 去重分组，逐组拷贝；opencode 合并；通用片段打印一次
uninstall(target)        // 'all' -> 逐 target 移除；单 target 保持现状
status()                 // 遍历 TARGETS（10 行）
doctor()                 // Node 版本 / skills 源 / 各 target / opencode MCP 条目，只读
update()                 // 当前版本 + npm registry 尽力查询（2.5s 超时，失败降级为指引）
printHelp()              // 包名修正 + 默认行为 + 10 个 target 路径 + MCP 说明
main()                   // --target 校验前置；cmd 分发加 doctor/update
```

入口运行方式：模块导出 `main`，既支持 `bin/setup.cjs` 动态 import 后调用，也支持 `node src/setup-cli.mjs`
直接执行（用 `process.argv[1]` 与 `import.meta.url` 比对守卫），保证测试 import 时无副作用。

### `bin/setup.cjs`（修改）

```js
import(fileUrl).then((mod) => mod.main()).catch(...)
```

### `README.md`（重写安装章节）

```
## 安装
  要求 Node.js ≥ 22
  ### 支持的 Agent（表格：target / agent / skills 路径 / MCP 自动注册）
  ### Quick Start（省略 --target = opencode；install/doctor/status/update/uninstall；重启提醒）
  ### OpenCode / Codex / Codex Desktop / CodeArts Agent / CodeArts Work / WorkBuddy /
      DeepSeek Harness (DSH) / Hermes / OpenClaw / AtomCode
  ### Other Agents（通用 MCP 片段 local stdio + 环境变量）
```

每个 agent 小节统一结构：安装命令 → 落盘路径 → MCP 是否自动配置 → 重启会话提醒 → `status`/`uninstall`/`doctor`。

### `test/setup-cli.test.mjs`（新增）

| 用例 | 断言 |
|---|---|
| target 真源 | `TARGETS.length === 10` 且集合精确匹配 |
| help | 含 `hdcommunity-mng-toolkit`、不含误写包名、含全部 target、含默认 opencode 说明 |
| status | 输出覆盖 10 个 target |
| install all | 10 个 target 均可辨识，`~/.codex/skills`、`~/.dsh/skills` 等落盘 |
| install codex-desktop | 写入 `~/.codex/skills`（回归：all/status 漏项） |
| 默认 target | 无 `--target` 时落 `~/.config/opencode/skills` 且 stdout 说明默认值 |
| 未知 target | exit 1、stderr 列出合法值、不创建 `~/.bogus/skills` |
| uninstall all | 移除后各目录无本包 skill |
| doctor | exit 0、含 Node 与 target 信息、不写文件 |
| update | exit 0、含 `npx --yes hdcommunity-mng-toolkit@latest` 指引 |
| README 一致性 | 10 个 target 均出现且 `--target <t>` 至少出现两次（表格 + 小节） |

## 3. 提交策略（TDD 红/绿分提交）

1. `docs(#6): 需求文档与方案设计`
2. `test(#6): setup-cli target 真源与 README 一致性失败测试`（红）
3. `feat(#6): setup-cli TARGETS 单一真源 + target 校验 + doctor/update`（绿）
4. `docs(#6): README 安装章节重写为 10 个 agent 逐节说明`（测试转全绿）

## 4. 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| 10 个 agent 的 MCP 配置格式各异，无法逐一实机验证 | 中 | README 只描述脚本实际写入路径与已验证命令，不虚构厂商细节 |
| 测试污染真实 HOME | 中 | 所有 CLI 用例 `HOME` 指向 `mkdtempSync` 临时目录，用完清理 |
| `update` 查询 npm 在离线环境挂起 | 低 | `AbortSignal.timeout(2500)` + 失败降级为指引，不影响退出码 |