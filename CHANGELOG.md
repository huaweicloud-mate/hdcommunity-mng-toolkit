# Changelog

## 0.8.0

### Added — 成长中心能力回归 main
- 恢复成长中心管理台 `hdgrow_admin_*` 与业务侧 `hdgrow_*`，并将默认环境按分支固定：`main`=现网、`develop`=测试（不要混用）。
- 新增 `hdgrow_admin_env`：返回当前 `test/prod/mixed/custom` 与两个 base，写操作预览统一带 `env`。

### Added — 成长管理台 P1/P2（develop 已验证，随本次回到 main）
- 变更单 `change_cancel` / `change_archive`。
- 积分补发 `reissue_create|_page|_get|_approve|_issue`（approve/issue 需 approver/admin，审核人不得等于提交人；`reissue_issue` 执行需 `confirm:true`）。
- 首个自然人变更申请 `natural_person_page|_get|_approve|_reject`（approver/admin，驳回原因必填）。
- 用户黑名单 `user_block`（原因 ≤512 字）/ `user_unblock`。
- 任务分类 `task_categories`（建任务取 `category_id`）。
- 任务修改 `task_update`（只需传脏字段；自动判定 `field_group`，描述/指南等非涉钱字段为 LOW）。
- 审计筛选 `keyword`、用户 `blocked`、变更单 `include_archived`。

### Changed — 写操作两步确认（防误操作）
- 所有新建/修改/删除工具默认 `dry_run=true`：只返回 `preview` + `env` + 一次性 `preview_confirm_token`，用户回复[确认]后以相同参数 + `dry_run:false` + 令牌执行。
- `change_create` 预览走后端 `POST /manage/change-request/preview`（不落库、不产生草案）；令牌 TTL 5 分钟、一次性、绑定参数。
- 批量审核预览时冻结目标 id，执行严格按预览集合处理。
- 覆盖范围：变更单 create/commit/approve/apply/revert/cancel/archive、补发 create/approve/issue、首个自然人 approve/reject、用户 block/unblock、博客审核/上下线/置顶、评论审核/上下线（含批量）。

## 0.7.0

### Features
- uninstall --target opencode 时同步清理 MCP 配置（#13，PR #14）。

## 0.6.0

### Added
- `install --target dsh` 自动写入 cordis.patch.yml MCP 注册：按 id 幂等、uninstall 同步移除、doctor 集成（#11，PR #12）。

## Unreleased

### Added — dsh MCP 自动注册
- `install --target dsh` 在安装 Skills 的同时，自动写入 `$DSH_HOME/profiles/<profile>/cordis.patch.yml` 的受管 `insert:` 条目（`id: mcp-hdcommunity`；profile 默认 `web`，支持 `DSH_PROFILE` 覆盖，`HDCOMMUNITY_BASE` 可覆盖）。
- 按 id 幂等：重复安装不重复写入；手写同 id 条目不被重复写入，也不会被卸载删除。
- `uninstall --target dsh` 仅移除受管条目，保留用户手写内容。
- `doctor` 显示 dsh MCP `OK` / `MISSING` / `INVALID`。
- `DSH_HOME` 不可写或已有 patch 不是 YAML 序列时 fail-fast，输出修复指引且无部分写入。

## 0.5.0

### Added — README 多 Agent 支持
- SUPPORTED_TARGETS 单一事实源，省略 `--target` 自动检测；README 重写为逐 Agent 安装流程，doctor/update 语义与实现对齐（#6/#7，PR #7）。

### Added — 默认域名现网化
- BACKEND_BASE 兜底默认切换为现网 `open-dataset.huaweicloud.com`，`HDCOMMUNITY_BASE` 覆盖保留；新增 config 默认值/覆盖行为与文档无残留防护测试（#9，PR #10）。

## 0.4.0

### Removed — 上线前收敛为博客管理台
- 本项目面向外部生产发布，成长中心仍在开发中，相关能力仅保留在 `develop` 分支。
- 移除成长中心管理台（`hdgrow_admin_*`）、业务侧（`hdgrow_*`）、端点常量、令牌缓存与 403 白名单提示。
- 登录/注销收敛为博客管理台单一账号体系。
- 移除 Skill `hd-grow-admin`、`hd-grow-operator`；README / 插件清单不再包含成长中心内容。

## 0.3.0

### Added — 错误可观测性
- 业务侧网关 403 追加白名单 auth_type 排查提示（iam 类型白名单 / appcode 替代 / `hdgrow_admin_whitelist_page`）（#3，PR #4）。

### Fixed — 安装器
- `install/uninstall` 携带 `--help` 时只打印帮助，不再误触发安装/卸载（#2，PR #5）。

## 0.2.0

### Added — 成长中心业务侧能力（自 hdcommunity-toolkit 迁移）
- 业务侧工具组 `hdgrow_*`（6，AK/SK）：查询 `points_query` / `server_tasks` / `server_prizes`；写入 `points_add` / `prize_exchange` / `issue_coupon`。
- 涉钱写防护：默认 `dry_run` 预演 → 一次性 `confirm_token`（HMAC/TTL 5min/绑定请求体）→ 高风险阈值（面额>100/数量>10）→ 强制 `biz_id` → 禁自动重试。
- Skill：`hd-grow-operator`。
- 工具名与迁移前保持一致，调用方无需改名；业务侧鉴权用 AK/SK，与管理台 Bearer 登录无关。

## 0.1.0

### Added — 管理面 Agent 工具包（自 hdcommunity-toolkit 迁移）
- 博客管理台 `hdcommunity_admin_*`：登录/注销、博客与评论审核（含批量 + `dry_run` 预览 + 按 id 回执）、上下线、置顶、审核记录、工作台统计；登录 401 自动重登。
- 本地内容风控 `hdcommunity_admin_blog_risk_check`（内置词库，标记风险不阻断）。
- 成长中心管理台 `hdgrow_admin_*`（20）：登录/注销；变更单 `change_create|commit|approve|apply|revert|get|page`；任务/权益/白名单查询；记录审计（积分/兑换/发券/定时任务）+ 用户查询；统计。
- **统一管理面登录/登出**：一次 `admin_login`（博客或成长入口）用同一账号同时登录两个管理台；`admin_logout` 同时登出。
- Skill：`hd-blog-operator`、`hd-grow-admin`。

### 说明
- 与用户面工具包 [`hdcommunity-toolkit`](https://github.com/huaweicloud-mate/hdcommunity-toolkit) 分仓；本仓只含**管理台**能力。
- 鉴权：博客管理台 `/manage/auth/*` + `/agent/admin/blog/**`（Bearer）；成长管理台 `/agent/admin/grow/**`（Bearer，登录 `/manage/auth/*`）。