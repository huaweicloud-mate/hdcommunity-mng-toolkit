# Changelog

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
