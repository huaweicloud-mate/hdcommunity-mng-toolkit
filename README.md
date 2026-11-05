# HDCommunity MNG Toolkit

华为云社区 · **管理面 Agent 工具包**（MCP 工具 + Skill）。让 AI 编码助手（opencode / codex / 码道 等）以自然语言完成社区**管理台**的运营操作。

- 本包为**端侧（工具包）**实现，结构/安装方式与用户面工具包 [`hdcommunity-toolkit`](https://github.com/huaweicloud-mate/hdcommunity-toolkit) 一致。
- 只含**管理面**能力；看/写/发博客等**用户面**在 `hdcommunity-toolkit`。

## 安装

**要求**：Node.js ≥ 22。

```bash
npx --yes hdcommunity-mng-toolkit install --target opencode   # 或 codex / codearts / ... / all
npx --yes hdcommunity-mng-toolkit status
npx --yes hdcommunity-mng-toolkit uninstall --target opencode
```

安装后**重启会话**加载新工具/Skill。

> 让 Agent 帮你装：`请运行 npx --yes hdcommunity-mng-toolkit install --target opencode，status 确认，并提醒我重启会话。`

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