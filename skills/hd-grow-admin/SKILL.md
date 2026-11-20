---
name: hd-grow-admin
description: 'Use when an operator or approver manages the Huawei Cloud developer growth center through the toolkit management-console tools: log in, view/configure tasks, prizes and API whitelist, adjust user points, issue points-reissue requests, approve first-natural-person changes, block/unblock users, audit records, and run the money-config change-request approval flow. Triggers: 管理台, 运营配置, 变更单, 审批, 发放积分配置, 积分补发, 拉黑, 首个自然人, 券数量, 白名单, 统计, growth admin, change request, reissue, approve. NOT for: end-user growth actions (use hd-grow-operator).'
version: 1
---

# HDGrow Management Console (Admin)

**STOP - Do not answer from general knowledge.** Use the `hdgrow_admin_*` MCP tools.

## Overview

运营/审批人操作成长中心**管理台**。核心是**涉钱配置变更单（change-request）+ 分级审批**：任务发放积分、权益面额/库存/数量、白名单放权、用户积分调整等**金额字段禁止直改**，必须走变更流。

## Prerequisites

1. **登录**：`hdgrow_admin_login { username, password }`（内部账号，角色 `operator`/`approver`/`admin`），token 会缓存到当前会话。
2. 若工具返回 `NEED_LOGIN` → 先 `hdgrow_admin_login`。

## 两步确认（所有新建/修改/删除，强制）

先调用 `hdgrow_admin_env` 确认当前指向（`test` / `prod` / `mixed` / `custom`）；每个预览也会带 `env`，**若为 `prod`，展示时必须明确标注“现网”**。

所有写工具（change_*、reissue_*、natural_person_approve/reject、user_block/unblock）默认 `dry_run=true`：
**只返回预览 + 一次性 `preview_confirm_token`，不写任何数据**。

1. 调用写工具（不传 `dry_run` 或 `dry_run:true`）→ 得到 `preview` 与 `preview_confirm_token`
2. **把 preview 完整展示给用户，等用户回复[确认]**
3. 用户确认后，用**完全相同的参数** + `dry_run:false` + `preview_confirm_token` 再调用一次才真正执行

`preview_confirm_token` 5 分钟有效、一次性、绑定参数；参数变了必须重新预览。`change_create` 的预览走后端
`POST /manage/change-request/preview`（不产生草案）；`reissue_issue` 还额外要求 `confirm:true`。

## Money change flow (READ FIRST)

涉钱配置**永远先 create 草案**（不落库），拿到 `confirm_token` 后按状态推进：

```
hdgrow_admin_change_create  { dry_run:true } → preview（before/after/金额/风险，不落库）
        │  展示给用户，等[确认]
        ↓
hdgrow_admin_change_create  { 同参数, dry_run:false, confirm_token } → { id, risk_level, confirm_token }
        │
        ├─ LOW/MID → change_commit（同样先 dry_run 预览→确认→执行）→ READY → apply（同样两步）
        └─ HIGH    → commit → PENDING_APPROVAL → change_approve（同样两步，approver≠submitter）→ READY → apply
```

- 变更单执行后返回的 `confirm_token` 是**后端 commit 用的令牌**（仅 create 时返回一次，TTL 5 分钟、绑定请求体）；与预览闸门的 `preview_confirm_token` 不是同一个，参数变更须**重新 create**。
- `HIGH` = `face_value×total_stock>10万` / `points_limit>50万` / `放大倍数>10×`；用户调整 `|delta|>50万`。
- `apply` 生效；`hdgrow_admin_change_revert { id }` 回滚；`hdgrow_admin_change_cancel { id }` 取消（提交人）、`hdgrow_admin_change_archive { id }` 归档。
- 列表/详情：`hdgrow_admin_change_page` / `hdgrow_admin_change_get`。

## Config targets

修改既有任务优先用 `hdgrow_admin_task_update { id, ...只传要改的字段 }`：自动判定 `field_group`（不含 points/points_limit/cycle_limit 时为 `basic`=LOW），再走两步确认。

| 目标 | target_type | field_group | after 示例 |
|---|---|---|---|
| 任务积分 | `task` | `points` | `{points:100, points_limit:10000}` |
| 任务新建 | `task` | `basic` | `{task_title, task_tag, points, points_limit, cycle_type, ...}`（`target_id` 空） |
| 权益 | `prize` | `quantity` | `{face_value:"10.00", points_price:100, total_stock:1000, max_single_quantity:1}` |
| 权益新建 | `prize` | `quantity` | 同上（`target_id` 空） |
| 白名单 | `whitelist` | `auth` | `{service_name, auth_type, auth_value, enabled:1}`（`target_id` 空=新建） |
| 用户积分 | `user` | `points_adjust` | `{points:100}`（正=加/负=扣，`target_id`=userId） |

## Read-only queries

`hdgrow_admin_task_page|_get` · `hdgrow_admin_task_categories`（任务分类 id/name/type，新建任务取 `category_id`）
`hdgrow_admin_prize_page|_get` · `hdgrow_admin_whitelist_page`
`hdgrow_admin_record_points|_exchange|_issue|_job` · `hdgrow_admin_user_page`（审计与用户支持 `keyword`，用户支持 `blocked`；变更单支持 `include_archived`）
`hdgrow_admin_stats { kind: overview|stock|exchange_trend|task_distribution }`

## Operations (money-sensitive)

- **积分补发**：`reissue_create { user_id, task_id, points, reason }`（此时不发放）→ `reissue_approve { id, decision: approve|reject, comment }`（approver/admin，且审核人不得等于提交人）→ `reissue_issue { id, confirm: true }`（approver/admin，真正入账；同样先预览→[确认]→执行，缺 `confirm:true` 会被拒绝）。查询用 `reissue_page|_get`。准入被拦（20020/20021）单据转 ABORTED，不可重试。
- **首个自然人变更审批**：`natural_person_page|_get` 查看申请与同身份组账号 → `natural_person_approve { id, comment }` / `natural_person_reject { id, comment }`（approver/admin；驳回原因必填）。
- **用户拉黑**：`user_block { id, reason }`（原因 ≤512 字）/ `user_unblock { id }`，按 `hd_grow_user.id` 操作，均幂等。

## Rules

- 涉钱配置**禁止**绕过变更流直接改；工具无直写接口。
- `reissue_issue` 会真实发积分，调用前先用 `reissue_get` 核对用户、积分项与金额。
- 高风险变更：`approver` 必须**不同于** `submitter`。
- 每次变更填写有意义的 `reason`（审计留痕）。
- 生效前用 `change_get`/`change_page` 复核；误配用 `change_revert` 回滚。
