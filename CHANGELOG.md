# Changelog

## Unreleased

### Changed — 环境默认与标识
- `develop` 默认测试：`HDCOMMUNITY_BASE`=opentest-dataset、`HDGROW_BASE`=opctest-dataset（`main` 保持现网默认，禁止把测试配置带进 main）。
- 新增 `hdgrow_admin_env`：返回 `test/prod/mixed/custom` 与两个 base；所有写操作预览统一带 `env`。

### Changed — 写操作两步确认（防误操作）
- 所有新建/修改/删除工具默认 `dry_run=true`：只返回 `preview` + 一次性 `preview_confirm_token`，用户回复[确认]后以相同参数 + `dry_run:false` + 令牌执行。
- `change_create` 预览走后端 `POST /manage/change-request/preview`（不落库、不产生草案）；令牌 TTL 5 分钟、一次性、绑定参数。
- 覆盖范围：变更单 create/commit/approve/apply/revert/cancel/archive、补发 create/approve/issue、首个自然人 approve/reject、用户 block/unblock、博客审核/上下线/置顶、评论审核/上下线（含批量）。

### Added — 成长中心管理台（P1）
- 变更单：`hdgrow_admin_change_cancel` / `_archive`。
- 积分补发：`reissue_create|_page|_get|_approve|_issue`（approve/issue 需 approver/admin，审核人不得等于提交人；`reissue_issue` 必须显式 `confirm:true`）。
- 首个自然人变更申请：`natural_person_page|_get|_approve|_reject`（approver/admin，驳回原因必填）。
- 用户黑名单：`hdgrow_admin_user_block`（原因 ≤512 字）/ `_unblock`。
- 任务分类：`hdgrow_admin_task_categories`（只读，建任务取 `category_id`）。
- 任务修改：`hdgrow_admin_task_update`（只传脏字段；不含金额字段为 `basic`=LOW，自动排除 `task_tag`）。

### Changed — 查询筛选对齐管理台
- 审计工具 `record_points|_exchange|_issue|_job` 增加 `keyword`；`user_page` 增加 `keyword` 与 `blocked`；`change_page` 增加 `include_archived`。

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
