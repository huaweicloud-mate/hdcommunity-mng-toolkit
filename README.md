# HDCommunity MNG Toolkit

华为云社区 · **管理面/运营面 Agent 工具包**（MCP 工具 + Skill）。让 AI 编码助手（opencode / codex / 码道 等）以自然语言完成社区与成长中心**管理台**的运营操作，以及成长中心业务侧的查积分/发积分/发券/兑换。

- 本包为**端侧（工具包）**实现，结构/安装方式与用户面工具包 [`hdcommunity-toolkit`](https://github.com/huaweicloud-mate/hdcommunity-toolkit) 一致。
- 只含**管理面/运营面**能力；看/写/发博客、浏览任务与权益等**用户面**在 `hdcommunity-toolkit`。

## 安装

**要求**：Node.js ≥ 22。

```bash
npx --yes hdcommunity-mng-toolkit install --target opencode   # 或 codex / codearts / ... / all
npx --yes hdcommunity-mng-toolkit status
npx --yes hdcommunity-mng-toolkit uninstall --target opencode
```

安装后**重启会话**加载新工具/Skill。

> 让 Agent 帮你装：`请运行 npx --yes hdcommunity-mng-toolkit install --target opencode，status 确认，并提醒我重启会话。`

## 环境默认（本分支 = 测试）

- `develop`：`HDCOMMUNITY_BASE` / `HDGROW_BASE` 默认指向测试（`opentest-dataset` / `opctest-dataset`）。
- `main`：默认指向现网（`open-dataset` / `grow-dataset`）；不要把测试配置带进 main。
- 不确定时调 `hdgrow_admin_env`；所有写操作预览都会带 `env`。

## 认证

| 面 | 工具前缀 | 鉴权 |
|---|---|---|
| 博客管理台 | `hdcommunity_admin_*` | 内部账号登录 → Bearer（`/manage/auth/login`） |
| 成长中心管理台 | `hdgrow_admin_*` | 同上（登录 `/manage/auth/*`，接口 `/agent/admin/grow/**` 与 `/manage/**`；任务分类走只读 `/agent/show/grow/task/categories`） |
| 成长中心业务侧 | `hdgrow_*`（points/task/prize/发券） | 华为云 **AK/SK**（`HW_ACCESS_KEY`/`HW_SECRET_KEY`），与管理员登录无关 |
| 内容风控 | `hdcommunity_admin_blog_risk_check` | 无（本地词库） |

**统一登录**：`hdcommunity_admin_login` 与 `hdgrow_admin_login` 会**用同一账号同时登录两个管理台**；`*_logout` 同时登出。

管理台 401 自动重登（可选）：设 `HDCOMMUNITY_ADMIN_USER` / `HDCOMMUNITY_ADMIN_PASS`（或 `credentials.json` 的 `admin_user`/`admin_pass`）。

## 工具清单（博客管理台 + 成长管理台）

### 博客管理台 `hdcommunity_admin_*`
登录/注销、`blog_page`/`blog_detail`/`blog_review`/`blog_review_batch`、`blog_online`/`blog_top`/`blog_records`、`comment_page`/`comment_review`/`comment_review_batch`/`comment_online`、`stats`。

### 成长中心管理台 `hdgrow_admin_*`（36）
登录/注销；环境自检 `env`；变更单 `change_create|commit|approve|apply|revert|cancel|archive|get|page`；`task_page|_get`、`task_update`、`task_categories`、`prize_page|_get`、`whitelist_page`；记录审计 `record_points|_exchange|_issue|_job`、`user_page`、`user_block`/`user_unblock`；积分补发 `reissue_create|_page|_get|_approve|_issue`；首个自然人 `natural_person_page|_get|_approve|_reject`；`stats`。

### 成长中心业务侧 `hdgrow_*`（6，AK/SK）
查询：`points_query`（查积分）、`server_tasks`（带个人完成状态）、`server_prizes`；
写入：`points_add`（发积分）、`prize_exchange`（兑换）、`issue_coupon`（发券）。
涉钱写操作默认 `dry_run` 预演 + 一次性 `confirm_token` + 高风险阈值 + 强制 `biz_id`。

### 内容风控
`hdcommunity_admin_blog_risk_check`（本地词库；审核时自动附带，标记风险不阻断）。

## 写操作两步确认（强制）

所有新建/修改/删除工具默认 `dry_run=true`：只返回 `preview` + 一次性 `preview_confirm_token`，不写任何数据。
流程：调用（默认预览）→ 把 preview 展示给用户并等回复[确认] → 用相同参数 + `dry_run:false` + `preview_confirm_token` 再调用一次才执行。
令牌 5 分钟有效、一次性、绑定参数；`change_create` 的预览走后端 `POST /manage/change-request/preview`（不产生草案）。

## 配置（环境变量）

| 变量 | 默认 | 说明 |
|---|---|---|
| `HDCOMMUNITY_BASE` | develop=测试 `opentest-dataset`；main=现网 `open-dataset` | 博客服务地址（用户面+管理面合并单服务） |
| `HDGROW_BASE` | develop=测试 `opctest-dataset`；main=现网 `grow-dataset` | 成长服务地址，形如 `https://<网关>/api/v1/hdgrowservice` |
| `HDCOMMUNITY_ADMIN_USER` / `HDCOMMUNITY_ADMIN_PASS` | 空 | 管理台账号（401 自动重登用） |
| `HDGROW_RISK_FACE_AMOUNT_MAX` / `HDGROW_RISK_QUANTITY_MAX` | `100` / `10` | 涉钱高风险阈值（业务侧写入） |
| `HDCOMMUNITY_CONFIRM_TTL_MS` | `300000`（5 分钟） | 写操作预览令牌 `preview_confirm_token` 的有效期 |

> 在 Agent 的 MCP 配置里通过 `env` 传入。

## 内置 Skill

| Skill | 用途 |
|---|---|
| `hd-blog-operator` | 博客运营：待审清理 / 内容巡检 |
| `hd-grow-admin` | 成长中心管理台：变更单分级审批、任务/权益/白名单、记录审计、统计 |
| `hd-grow-operator` | 成长中心业务侧：查积分/任务/权益、发积分、发券、兑换（涉钱强制预演） |

## 开发

```bash
npm install
npm run smoke   # 协议层冒烟（无需网络）
node --test     # 单元测试
npm start       # 启动 MCP server（stdio）
```

## 许可

Apache-2.0
