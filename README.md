# HDCommunity MNG Toolkit

华为云社区 · **管理面 Agent 工具包**（MCP 工具 + Skill）。让 AI 编码助手（opencode / codex / 码道 等）以自然语言完成社区**管理台**的运营操作。

- 本包为**端侧（工具包）**实现，结构/安装方式与用户面工具包 [`hdcommunity-toolkit`](https://github.com/huaweicloud-mate/hdcommunity-toolkit) 一致。
- 只含**管理面**能力；看/写/发博客等**用户面**在 `hdcommunity-toolkit`。

## 安装

**要求**：Node.js ≥ 22。

### 支持的 Agent（10 个）

安装器支持以下 10 个 agent target（以 `src/setup-cli.mjs` 的 `TARGETS` 为单一真源，`install --target all` 与 `status` 均覆盖）：

| target | Agent | Skills 落盘路径 | MCP 配置 |
|---|---|---|---|
| `opencode` | OpenCode | `~/.config/opencode/skills` | 自动写入 `opencode.json` |
| `codex` | Codex CLI | `~/.codex/skills` | 手动（见 Other Agents） |
| `codex-desktop` | Codex 桌面版 | `~/.codex/skills` | 手动（见 Other Agents） |
| `codearts` | CodeArts Agent（码道） | `~/.codeartsdoer/skills` | 手动（见 Other Agents） |
| `codearts-work` | CodeArts Work | `~/.codeartswork/skills` | 手动（见 Other Agents） |
| `workbuddy` | WorkBuddy | `~/.workbuddy/skills` | 手动（见 Other Agents） |
| `dsh` | DeepSeek Harness (DSH) | `~/.dsh/skills`（`DSH_HOME` 可覆盖） | 自动写入 `profiles/<profile>/cordis.patch.yml` |
| `hermes` | Hermes | `~/.hermes/skills` | 手动（见 Other Agents） |
| `openclaw` | OpenClaw | `~/.openclaw/skills` | 手动（见 Other Agents） |
| `atomcode` | AtomCode | `~/.atomcode/skills` | 手动（见 Other Agents） |

> `codex` 与 `codex-desktop` 共用 `~/.codex/skills`（`install --target all` 只拷贝一次）。

### Quick Start

```bash
npx --yes hdcommunity-mng-toolkit install              # 省略 --target = 默认 opencode
npx --yes hdcommunity-mng-toolkit doctor               # 只读体检：Node / Skills / MCP 配置
npx --yes hdcommunity-mng-toolkit status               # 查看 10 个 target 的安装状态
npx --yes hdcommunity-mng-toolkit update               # 检查版本并给出升级指引
npx --yes hdcommunity-mng-toolkit uninstall --target opencode
```

- **省略 `--target` 的行为**：`install` / `uninstall` 都以 **`opencode`** 为目标（不是自动检测已装 agent），命令会打印默认提示。
- **未知 target**：命令报错、列出全部合法值（10 个 + `all`）、退出码 1，且不会创建任何目录。
- 安装完成后**重启会话**，新 Skills 与 MCP 工具才会被加载。
- **MCP 自动注册覆盖 `opencode` 与 `dsh`**；其余 target 安装后按 [Other Agents](#other-agents) 的片段手动注册。

> 让 Agent 帮你装：`请运行 npx --yes hdcommunity-mng-toolkit install --target <你的 agent>，再用 status 确认，并提醒我重启会话。`

### OpenCode

```bash
npx --yes hdcommunity-mng-toolkit install --target opencode
```

- Skills 落盘：`~/.config/opencode/skills/`
- MCP：**自动合并**到 `~/.config/opencode/opencode.json` 的 `mcp.hdcommunity-mng-toolkit`（local stdio，`npx -y -p hdcommunity-mng-toolkit hdcommunity-mng-toolkit-mcp`）；已有配置无法解析时回退为打印片段。
- `uninstall --target opencode` 在移除 skills 的同时**删除该 MCP 条目**，保留其它 MCP 条目与配置字段；未安装时卸载为无害操作。
- **重启会话**后生效。

```bash
npx --yes hdcommunity-mng-toolkit doctor
npx --yes hdcommunity-mng-toolkit status
npx --yes hdcommunity-mng-toolkit uninstall --target opencode
```

### Codex

```bash
npx --yes hdcommunity-mng-toolkit install --target codex
```

- Skills 落盘：`~/.codex/skills/`
- MCP：**不自动写入**，安装后按 [Other Agents](#other-agents) 的片段加入 Codex 的 `mcpServers`。
- **重启 Codex 会话**（重开 CLI）后生效。

```bash
npx --yes hdcommunity-mng-toolkit doctor
npx --yes hdcommunity-mng-toolkit status
npx --yes hdcommunity-mng-toolkit uninstall --target codex
```

### Codex Desktop

```bash
npx --yes hdcommunity-mng-toolkit install --target codex-desktop
```

- Skills 落盘：`~/.codex/skills/`（与 `codex` 共用同一目录）
- MCP：**不自动写入**，按 [Other Agents](#other-agents) 的片段手动注册。
- **重启 Codex 桌面应用**后生效。

```bash
npx --yes hdcommunity-mng-toolkit doctor
npx --yes hdcommunity-mng-toolkit status
npx --yes hdcommunity-mng-toolkit uninstall --target codex-desktop
```

### CodeArts Agent（码道）

```bash
npx --yes hdcommunity-mng-toolkit install --target codearts
```

- Skills 落盘：`~/.codeartsdoer/skills/`
- MCP：**不自动写入**，按 [Other Agents](#other-agents) 的片段注册到 CodeArts 的 MCP 设置。
- **重启会话**后生效。

```bash
npx --yes hdcommunity-mng-toolkit doctor
npx --yes hdcommunity-mng-toolkit status
npx --yes hdcommunity-mng-toolkit uninstall --target codearts
```

### CodeArts Work

```bash
npx --yes hdcommunity-mng-toolkit install --target codearts-work
```

- Skills 落盘：`~/.codeartswork/skills/`
- MCP：**不自动写入**，按 [Other Agents](#other-agents) 的片段注册。
- **重启会话**后生效。

```bash
npx --yes hdcommunity-mng-toolkit doctor
npx --yes hdcommunity-mng-toolkit status
npx --yes hdcommunity-mng-toolkit uninstall --target codearts-work
```

### WorkBuddy

```bash
npx --yes hdcommunity-mng-toolkit install --target workbuddy
```

- Skills 落盘：`~/.workbuddy/skills/`
- MCP：**不自动写入**，按 [Other Agents](#other-agents) 的片段注册。
- **重启会话**后生效。

```bash
npx --yes hdcommunity-mng-toolkit doctor
npx --yes hdcommunity-mng-toolkit status
npx --yes hdcommunity-mng-toolkit uninstall --target workbuddy
```

### DeepSeek Harness (DSH)

```bash
npx --yes hdcommunity-mng-toolkit install --target dsh
```

- Skills 落盘：`$DSH_HOME/skills`（未设置 `DSH_HOME` 时为 `~/.dsh/skills`）
- MCP：**自动写入** `$DSH_HOME/profiles/<profile>/cordis.patch.yml`（profile 默认 `web`，可用 `DSH_PROFILE` 覆盖），使用 `insert:` 键语法注册 `id: mcp-hdcommunity`；`env.HDCOMMUNITY_BASE` 取当前 `HDCOMMUNITY_BASE`（未设置时为现网默认地址）。
  - 按 id 幂等：重复 install 不会产生重复条目；若你已手写同 id 条目，install 不会重复写入，uninstall 也不会删除它。
  - `uninstall --target dsh` 仅移除本工具写入的受管条目，保留其它用户内容。
  - 若 `DSH_HOME` 不是可写目录，或已有 `cordis.patch.yml` 不是 YAML 序列（如 mapping），install 会 fail-fast（非 0 退出）并给出修复指引，当次不写入 skills 或 MCP 条目。
- **重启 DSH 会话**后生效。

```bash
npx --yes hdcommunity-mng-toolkit doctor
npx --yes hdcommunity-mng-toolkit status
npx --yes hdcommunity-mng-toolkit uninstall --target dsh
```

### Hermes

```bash
npx --yes hdcommunity-mng-toolkit install --target hermes
```

- Skills 落盘：`~/.hermes/skills/`
- MCP：**不自动写入**，按 [Other Agents](#other-agents) 的片段注册。
- **重启会话**后生效。

```bash
npx --yes hdcommunity-mng-toolkit doctor
npx --yes hdcommunity-mng-toolkit status
npx --yes hdcommunity-mng-toolkit uninstall --target hermes
```

### OpenClaw

```bash
npx --yes hdcommunity-mng-toolkit install --target openclaw
```

- Skills 落盘：`~/.openclaw/skills/`
- MCP：**不自动写入**，按 [Other Agents](#other-agents) 的片段注册。
- **重启会话**后生效。

```bash
npx --yes hdcommunity-mng-toolkit doctor
npx --yes hdcommunity-mng-toolkit status
npx --yes hdcommunity-mng-toolkit uninstall --target openclaw
```

### AtomCode

```bash
npx --yes hdcommunity-mng-toolkit install --target atomcode
```

- Skills 落盘：`~/.atomcode/skills/`
- MCP：**不自动写入**，按 [Other Agents](#other-agents) 的片段注册。
- **重启会话**后生效。

```bash
npx --yes hdcommunity-mng-toolkit doctor
npx --yes hdcommunity-mng-toolkit status
npx --yes hdcommunity-mng-toolkit uninstall --target atomcode
```

### Other Agents

未内置 target 的 agent，只要支持 MCP，就手动注册本包的 MCP server（local stdio）：

```json
{
  "mcpServers": {
    "hdcommunity-mng-toolkit": {
      "command": "npx",
      "args": ["-y", "-p", "hdcommunity-mng-toolkit", "hdcommunity-mng-toolkit-mcp"],
      "env": {
        "HDGROW_BASE": "<你的 HDGROW_BASE>",
        "HDCOMMUNITY_BASE": "<你的 HDCOMMUNITY_BASE>"
      }
    }
  }
}
```

- OpenCode 使用 `mcp.<name>` 结构（`type: local` + `command` 数组），由 `install --target opencode` 自动写入。
- Skills 仍需落盘，装到对应 agent 的 skills 目录：`npx --yes hdcommunity-mng-toolkit install --target <agent>`；未内置的 agent 可用 `npx --yes hdcommunity-mng-toolkit install --target all` 后手工复制 `skills/`。
- **remote HTTP（Streamable HTTP）传输尚未实现**：`--transport remote` 目前会回退 stdio，请使用上面的 stdio 片段。
- 认证类环境变量（`HDCOMMUNITY_ADMIN_USER`、`HW_ACCESS_KEY` 等）同样通过这些 `env` 传入，见[配置](#配置环境变量)。

## 认证

| 面 | 工具前缀 | 鉴权 |
|---|---|---|
| 博客管理台 | `hdcommunity_admin_*` | 内部账号登录 → Bearer（`/manage/auth/login`） |
| 内容风控 | `hdcommunity_admin_blog_risk_check` | 无（本地词库） |

管理台 401 自动重登（可选）：设 `HDCOMMUNITY_ADMIN_USER` / `HDCOMMUNITY_ADMIN_PASS`（或 `credentials.json` 的 `admin_user`/`admin_pass`）。

## 工具清单（博客管理台）

### 博客管理台 `hdcommunity_admin_*`
登录/注销、`blog_page`/`blog_detail`/`blog_review`/`blog_review_batch`、`blog_online`/`blog_top`/`blog_records`、`comment_page`/`comment_review`/`comment_review_batch`/`comment_online`、`stats`。

### 内容风控
`hdcommunity_admin_blog_risk_check`（本地词库；审核时自动附带，标记风险不阻断）。

## 配置（环境变量）

| 变量 | 默认 | 说明 |
|---|---|---|
| `HDCOMMUNITY_BASE` | （见 config） | 博客服务地址（用户面+管理面合并单服务） |
| `HDCOMMUNITY_ADMIN_USER` / `HDCOMMUNITY_ADMIN_PASS` | 空 | 管理台账号（401 自动重登用） |

> 在 Agent 的 MCP 配置里通过 `env` 传入。

## 内置 Skill

| Skill | 用途 |
|---|---|
| `hd-blog-operator` | 博客运营：待审清理 / 内容巡检 |

## 开发

```bash
npm install
npm run smoke   # 协议层冒烟（无需网络）
node --test     # 单元测试
npm start       # 启动 MCP server（stdio）
```

## 许可

Apache-2.0