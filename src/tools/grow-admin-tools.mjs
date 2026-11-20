// Growth-center MANAGEMENT CONSOLE tools (hdgrow_admin_*) — parallel to hdcommunity_admin_*.
// Auth: internal account login -> Bearer token cached per session (dedicated namespace).
//
// Covers: login/logout, change-request flow (draft/commit/approve/apply/revert/cancel/archive/get/page),
// read-only task/prize/whitelist/category queries, record audit, user search/block/unblock, stats,
// points reissue, and first-natural-person change applications.
//
// Money-safety: config writes go through the change-request flow (HIGH risk needs a second
// approver != submitter). These tools never bypass that; create returns a one-time confirm_token.

import { callGrowAdmin, callGrowShow } from './http-client.mjs';
import { GROW_ADMIN, GROW_SHOW } from './grow-endpoints.mjs';
import { envInfo } from '../config.mjs';
import { loginBoth, logoutBoth } from './admin-session.mjs';
import { ok, fail, CODES } from '../errors.mjs';
import { CONFIRM_PROPS, issueConfirm, consumeConfirm } from './confirm-gate.mjs';

const P = {
  int: (d) => ({ type: 'integer', description: d }),
  str: (d) => ({ type: 'string', description: d }),
  bool: (d) => ({ type: 'boolean', description: d }),
};

const TOKEN_PROP = { token: P.str('管理台 token（可选；缺省用当前会话登录态）') };

// All create/update/delete tools are two-step: dry-run preview -> user 确认 -> execute.
async function runWithConfirm(ctx, tool, args, previewFn, execFn) {
  if (args.dry_run !== false) {
    const preview = await previewFn();
    if (preview && preview.ok === false) return preview;
    return ok(issueConfirm(ctx?.sessionId, tool, args, preview));
  }
  const err = consumeConfirm(ctx?.sessionId, tool, args, args.preview_confirm_token);
  if (err) return fail(CODES.PARAM_ERROR, err);
  return execFn();
}

const changePreview = async (ctx, a, action) => {
  const r = await callGrowAdmin(ctx?.sessionId, 'GET', `${GROW_ADMIN.change}/${encodeURIComponent(a.id)}`, { token: a.token });
  if (!r.ok) return r;
  const d = r.data || {};
  return {
    action,
    target_type: d.target_type,
    target_id: d.target_id,
    status: d.status,
    risk_level: d.risk_level,
    before: d.before,
    after: d.after,
    money_impact: d.money_impact,
    reason: a.reason,
    decision: a.decision,
    comment: a.comment,
  };
};

const reissuePreview = async (ctx, a, action) => {
  const r = await callGrowAdmin(ctx?.sessionId, 'GET', GROW_ADMIN.reissueGet(a.id), { token: a.token });
  if (!r.ok) return r;
  const d = r.data || {};
  return {
    action,
    id: d.id,
    user_id: d.user_id,
    task_id: d.task_id,
    points: d.points,
    status: d.status,
    submitter: d.submitter,
    decision: a.decision,
    comment: a.comment,
  };
};

const naturalPersonPreview = async (ctx, a, action) => {
  const r = await callGrowAdmin(ctx?.sessionId, 'GET', GROW_ADMIN.naturalPersonGet(a.id), { token: a.token });
  if (!r.ok) return r;
  const d = r.data || {};
  return {
    action,
    id: d.id,
    applicant: d.applicant,
    status: d.status,
    apply_type: d.apply_type,
    from_domain_id: d.from_domain_id,
    to_domain_id: d.to_domain_id,
    comment: a.comment,
  };
};

const TASK_UPDATE_FIELDS = [
  'task_title',
  'task_desc',
  'category_id',
  'biz_type',
  'points',
  'points_limit',
  'cycle_type',
  'cycle_limit',
  'start_time',
  'end_time',
  'jump_url',
  'task_guide',
  'enabled',
  'is_show',
  'sort_order',
];
const TASK_MONEY_FIELDS = ['points', 'points_limit', 'cycle_limit'];

/**
 * Build the change-request payload for updating an existing task. Only fields the
 * caller actually provided are sent (dirty-only), so non-money edits become LOW risk.
 * @returns {{ok: true, body: object, fields: string[]} | {ok: false, message: string}}
 */
export function buildTaskUpdatePayload(a) {
  const after = {};
  for (const field of TASK_UPDATE_FIELDS) {
    if (a[field] !== undefined) after[field] = a[field];
  }
  const fields = Object.keys(after);
  if (!fields.length) return { ok: false, message: '至少提供一个要修改的字段（task_desc / task_guide / enabled / points …）' };
  const fieldGroup = TASK_MONEY_FIELDS.some((f) => after[f] !== undefined) ? 'points' : 'basic';
  return {
    ok: true,
    fields,
    body: {
      target_type: 'task',
      target_id: a.id,
      field_group: fieldGroup,
      after,
      reason: a.reason,
    },
  };
}

export const GROW_ADMIN_TOOLS = {
  definitions: [
    {
      name: 'hdgrow_admin_login',
      description: 'Log in with internal account. Unified: logs into BOTH the growth and community management consoles with the same account. 管理台登录（同时登录成长+博客）。',
      inputSchema: {
        type: 'object',
        required: ['username', 'password'],
        properties: { username: P.str('内部账号'), password: P.str('登录口令') },
      },
    },
    {
      name: 'hdgrow_admin_logout',
      description: 'Log out of BOTH management consoles and clear both cached tokens. 管理台注销（同时登出成长+博客）。',
      inputSchema: { type: 'object', properties: { ...TOKEN_PROP } },
    },

    // ---- change-request flow ----
    {
      name: 'hdgrow_admin_change_create',
      description:
        'Create a money-config change draft (no write). Returns diff/money impact/risk + one-time confirm_token. 生成涉钱配置变更单草案。',
      inputSchema: {
        type: 'object',
        required: ['target_type', 'field_group', 'after'],
        properties: {
          target_type: P.str('task / prize / whitelist / user'),
          target_id: P.str('目标ID（新建为空；user 调整必填）'),
          field_group: P.str('points / face_value / quantity / shelf / auth / points_adjust'),
          after: { type: 'object', description: '目标值（snake_case 键），如 {"points":100,"points_limit":10000}' },
          reason: P.str('变更原因（可选）'),
          ...TOKEN_PROP,
          ...CONFIRM_PROPS,
        },
      },
    },
    {
      name: 'hdgrow_admin_change_commit',
      description: 'Submitter confirms the draft with confirm_token; LOW/MID -> READY, HIGH -> PENDING_APPROVAL. 提交人确认。',
      inputSchema: {
        type: 'object',
        required: ['id', 'confirm_token', 'reason'],
        properties: {
          id: P.str('变更单 id'),
          confirm_token: P.str('创建时返回的一次性令牌'),
          reason: P.str('变更原因'),
          ...TOKEN_PROP,
          ...CONFIRM_PROPS,
        },
      },
    },
    {
      name: 'hdgrow_admin_change_approve',
      description: 'Approver approves/rejects a HIGH change (approver != submitter). 审批高风险变更。',
      inputSchema: {
        type: 'object',
        required: ['id', 'decision'],
        properties: {
          id: P.str('变更单 id'),
          decision: P.str('approve / reject'),
          comment: P.str('审批意见（可选）'),
          ...TOKEN_PROP,
          ...CONFIRM_PROPS,
        },
      },
    },
    {
      name: 'hdgrow_admin_change_apply',
      description: 'Apply a READY change (writes to the target table). 生效变更单。',
      inputSchema: { type: 'object', required: ['id'], properties: { id: P.str('变更单 id'), ...TOKEN_PROP, ...CONFIRM_PROPS } },
    },
    {
      name: 'hdgrow_admin_change_revert',
      description: 'Revert an APPLIED change (restore before-snapshot / disable created). 回滚变更单。',
      inputSchema: { type: 'object', required: ['id'], properties: { id: P.str('变更单 id'), ...TOKEN_PROP, ...CONFIRM_PROPS } },
    },
    {
      name: 'hdgrow_admin_change_get',
      description: 'Get a change request detail. 变更单详情。',
      inputSchema: { type: 'object', required: ['id'], properties: { id: P.str('变更单 id'), ...TOKEN_PROP } },
    },
    {
      name: 'hdgrow_admin_change_page',
      description: 'Page change requests (status/submitter). 变更单分页。',
      inputSchema: {
        type: 'object',
        properties: {
          status: P.str('DRAFT/READY/PENDING_APPROVAL/APPLIED/REJECTED/REVERTED/CANCELLED'),
          submitter: P.str('提交人（可选）'),
          include_archived: P.bool('是否包含已归档（可选，缺省 false）'),
          page_no: P.int('页码，默认 1'),
          page_size: P.int('每页条数，默认 10'),
          ...TOKEN_PROP,
        },
      },
    },

    {
      name: 'hdgrow_admin_change_cancel',
      description: 'Cancel a DRAFT change request (submitter only). 取消变更单（仅草案）。',
      inputSchema: { type: 'object', required: ['id'], properties: { id: P.str('变更单 id'), ...TOKEN_PROP, ...CONFIRM_PROPS } },
    },
    {
      name: 'hdgrow_admin_change_archive',
      description: 'Archive a terminal change request (rejected/reverted/cancelled/applied). 归档变更单（仅终态）。',
      inputSchema: { type: 'object', required: ['id'], properties: { id: P.str('变更单 id'), ...TOKEN_PROP, ...CONFIRM_PROPS } },
    },

    {
      name: 'hdgrow_admin_task_update',
      description: 'Update an existing task by sending only changed fields; auto risk/field_group and two-step confirm. 修改既有任务（仅传脏字段）。',
      inputSchema: {
        type: 'object',
        required: ['id'],
        properties: {
          id: P.str('任务 ID'),
          task_title: P.str('任务标题'),
          task_desc: P.str('任务描述'),
          category_id: P.str('任务分类 ID'),
          biz_type: P.str('业务方 opc / codearts'),
          points: P.int('单次积分'),
          points_limit: P.int('积分预算上限'),
          cycle_type: P.str('DAILY / WEEKLY / MONTHLY / LIMIT / NO_LIMIT'),
          cycle_limit: P.int('每周期次数'),
          start_time: P.str('生效时间（ISO8601）'),
          end_time: P.str('结束时间（ISO8601）'),
          jump_url: P.str('跳转地址'),
          task_guide: P.str('任务指南（HTML/文本）'),
          enabled: P.int('启用 1/0'),
          is_show: P.int('展示 1/0'),
          sort_order: P.int('排序'),
          reason: P.str('变更原因'),
          ...TOKEN_PROP,
          ...CONFIRM_PROPS,
        },
      },
    },

    // ---- points reissue (money-sensitive: approve/issue grants points) ----
    {
      name: 'hdgrow_admin_reissue_create',
      description: 'Create a points-reissue request (no points granted yet). 新建积分补发申请。',
      inputSchema: {
        type: 'object',
        required: ['user_id', 'task_id', 'points', 'reason'],
        properties: {
          user_id: P.str('目标用户 hd_grow_user.id'),
          task_id: P.str('积分项（任务）ID'),
          points: P.int('补发积分（正数）'),
          reason: P.str('申请原因'),
          request_id: P.str('幂等键（可选，缺省服务端生成）'),
          ...TOKEN_PROP,
          ...CONFIRM_PROPS,
        },
      },
    },
    {
      name: 'hdgrow_admin_reissue_page',
      description: 'Page points-reissue requests (audit). 积分补发分页。',
      inputSchema: {
        type: 'object',
        properties: {
          user_id: P.str('目标用户ID'),
          task_id: P.str('任务ID'),
          status: P.str('状态'),
          submitter: P.str('提交人'),
          id: P.str('补发单号'),
          page_no: P.int('页码，默认 1'),
          page_size: P.int('每页条数，默认 10'),
          ...TOKEN_PROP,
        },
      },
    },
    {
      name: 'hdgrow_admin_reissue_get',
      description: 'Get a points-reissue request detail. 积分补发详情。',
      inputSchema: { type: 'object', required: ['id'], properties: { id: P.str('补发单 id'), ...TOKEN_PROP } },
    },
    {
      name: 'hdgrow_admin_reissue_approve',
      description: 'Approve/reject a points-reissue request (approver/admin). 审核积分补发。',
      inputSchema: {
        type: 'object',
        required: ['id', 'decision'],
        properties: {
          id: P.str('补发单 id'),
          decision: P.str('approve / reject'),
          comment: P.str('审核意见（reject 时必填）'),
          ...TOKEN_PROP,
          ...CONFIRM_PROPS,
        },
      },
    },
    {
      name: 'hdgrow_admin_reissue_issue',
      description: 'Execute an approved reissue (grants points; money-moving; approver/admin). Preview first; execution requires confirm:true. 执行积分补发入账。',
      inputSchema: {
        type: 'object',
        required: ['id'],
        properties: {
          id: P.str('补发单 id'),
          confirm: P.bool('执行时必须为 true（防误触）；预览时不传'),
          ...TOKEN_PROP,
          ...CONFIRM_PROPS,
        },
      },
    },

    // ---- first-natural-person change applications (approver/admin) ----
    {
      name: 'hdgrow_admin_natural_person_page',
      description: 'Page first-natural-person change applications. 首个自然人变更申请分页。',
      inputSchema: {
        type: 'object',
        properties: {
          status: P.str('状态'),
          applicant: P.str('申请人'),
          apply_type: P.str('申请类型 SELF/CHANGE'),
          id: P.str('申请单 id'),
          page_no: P.int('页码，默认 1'),
          page_size: P.int('每页条数，默认 10'),
          ...TOKEN_PROP,
        },
      },
    },
    {
      name: 'hdgrow_admin_natural_person_get',
      description: 'Get one first-natural-person application (incl. same-identity accounts). 首个自然人申请详情。',
      inputSchema: { type: 'object', required: ['id'], properties: { id: P.str('申请单 id'), ...TOKEN_PROP } },
    },
    {
      name: 'hdgrow_admin_natural_person_approve',
      description: 'Approve a first-natural-person change application (approver/admin). 通过首个自然人变更申请。',
      inputSchema: {
        type: 'object',
        required: ['id'],
        properties: { id: P.str('申请单 id'), comment: P.str('审批意见'), ...TOKEN_PROP, ...CONFIRM_PROPS },
      },
    },
    {
      name: 'hdgrow_admin_natural_person_reject',
      description: 'Reject a first-natural-person change application (reason required; approver/admin). 驳回首个自然人变更申请。',
      inputSchema: {
        type: 'object',
        required: ['id', 'comment'],
        properties: { id: P.str('申请单 id'), comment: P.str('驳回原因（必填）'), ...TOKEN_PROP, ...CONFIRM_PROPS },
      },
    },

    // ---- user blacklist ----
    {
      name: 'hdgrow_admin_user_block',
      description: 'Block a growth user (reason required, <=512 chars). 拉黑用户。',
      inputSchema: {
        type: 'object',
        required: ['id', 'reason'],
        properties: { id: P.str('hd_grow_user.id'), reason: P.str('拉黑原因（≤512字）'), ...TOKEN_PROP, ...CONFIRM_PROPS },
      },
    },
    {
      name: 'hdgrow_admin_user_unblock',
      description: 'Unblock a growth user. 解除拉黑。',
      inputSchema: { type: 'object', required: ['id'], properties: { id: P.str('hd_grow_user.id'), ...TOKEN_PROP, ...CONFIRM_PROPS } },
    },

    // ---- read-only config queries ----
    {
      name: 'hdgrow_admin_env',
      description: 'Show which environment this toolkit points at (test / prod / mixed / custom) and the configured bases. 查看当前指向的环境。',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'hdgrow_admin_task_categories',
      description: 'List task categories (id/name/type) for task creation. 任务分类列表。',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'hdgrow_admin_task_page',
      description: 'Page tasks (management view, incl. disabled/deleted). 管理台任务分页。',
      inputSchema: {
        type: 'object',
        properties: {
          category_id: P.str('分类筛选'),
          enabled: P.int('启用筛选 1/0'),
          is_show: P.int('展示筛选 1/0'),
          deleted: P.int('删除筛选 1/0（缺省 0）'),
          keyword: P.str('标题/task_tag 关键词'),
          page_no: P.int('页码，默认 1'),
          page_size: P.int('每页条数，默认 10'),
          ...TOKEN_PROP,
        },
      },
    },
    {
      name: 'hdgrow_admin_task_get',
      description: 'Get a task detail (management view). 管理台任务详情。',
      inputSchema: { type: 'object', required: ['id'], properties: { id: P.str('任务 id'), ...TOKEN_PROP } },
    },
    {
      name: 'hdgrow_admin_prize_page',
      description: 'Page prizes (management view, incl. off-shelf/deleted). 管理台权益分页。',
      inputSchema: {
        type: 'object',
        properties: {
          on_shelf: P.int('上架筛选 1/0'),
          deleted: P.int('删除筛选 1/0（缺省 0）'),
          keyword: P.str('名称关键词'),
          page_no: P.int('页码，默认 1'),
          page_size: P.int('每页条数，默认 10'),
          ...TOKEN_PROP,
        },
      },
    },
    {
      name: 'hdgrow_admin_prize_get',
      description: 'Get a prize detail (management view). 管理台权益详情。',
      inputSchema: { type: 'object', required: ['id'], properties: { id: P.str('权益 id'), ...TOKEN_PROP } },
    },
    {
      name: 'hdgrow_admin_whitelist_page',
      description: 'Page API whitelist entries. 管理台白名单分页。',
      inputSchema: {
        type: 'object',
        properties: {
          service_name: P.str('服务名关键词'),
          auth_type: P.str('appcode / iam'),
          enabled: P.int('启用筛选 1/0'),
          page_no: P.int('页码，默认 1'),
          page_size: P.int('每页条数，默认 10'),
          ...TOKEN_PROP,
        },
      },
    },

    // ---- record audit ----
    {
      name: 'hdgrow_admin_record_points',
      description: 'Page points-detail records (audit). 积分明细审计。',
      inputSchema: {
        type: 'object',
        properties: {
          user_id: P.str('用户ID'),
          keyword: P.str('用户名 / domain_id 关键词'),
          type: P.str('task/exchange/operate'),
          page_no: P.int('页码，默认 1'),
          page_size: P.int('每页条数，默认 10'),
          ...TOKEN_PROP,
        },
      },
    },
    {
      name: 'hdgrow_admin_record_exchange',
      description: 'Page exchange records (audit). 兑换记录审计。',
      inputSchema: {
        type: 'object',
        properties: {
          user_id: P.str('用户ID'),
          keyword: P.str('用户名 / domain_id 关键词'),
          prize_id: P.str('权益ID'),
          status: P.str('success/failed/pending'),
          page_no: P.int('页码，默认 1'),
          page_size: P.int('每页条数，默认 10'),
          ...TOKEN_PROP,
        },
      },
    },
    {
      name: 'hdgrow_admin_record_issue',
      description: 'Page coupon-issue records (audit). 发券记录审计。',
      inputSchema: {
        type: 'object',
        properties: {
          domain_id: P.str('租户ID'),
          keyword: P.str('用户名 / domain_id 关键词'),
          status: P.str('SUCCESS/FAILED'),
          page_no: P.int('页码，默认 1'),
          page_size: P.int('每页条数，默认 10'),
          ...TOKEN_PROP,
        },
      },
    },
    {
      name: 'hdgrow_admin_record_job',
      description: 'Page scheduled-job records (audit). 定时任务记录审计。',
      inputSchema: {
        type: 'object',
        properties: {
          job_code: P.str('任务标识'),
          batch_no: P.str('批次号'),
          keyword: P.str('任务 / 批次 / 用户名 / domain_id 关键词'),
          status: P.str('RUNNING/SUCCESS/FAILED'),
          page_no: P.int('页码，默认 1'),
          page_size: P.int('每页条数，默认 10'),
          ...TOKEN_PROP,
        },
      },
    },
    {
      name: 'hdgrow_admin_user_page',
      description: 'Page users (search by domain/iam/name/keyword, filter blocked). 用户查询。',
      inputSchema: {
        type: 'object',
        properties: {
          domain_id: P.str('domainId'),
          iam_id: P.str('iamId'),
          domain_name: P.str('域名关键词（模糊）'),
          keyword: P.str('domain_id / iam_id / 用户名关键词'),
          blocked: P.int('拉黑状态筛选 0正常/1已拉黑（可选）'),
          page_no: P.int('页码，默认 1'),
          page_size: P.int('每页条数，默认 10'),
          ...TOKEN_PROP,
        },
      },
    },

    // ---- stats ----
    {
      name: 'hdgrow_admin_stats',
      description: 'Growth stats: overview / stock / exchange_trend / task_distribution. 统计看板。',
      inputSchema: {
        type: 'object',
        required: ['kind'],
        properties: {
          kind: P.str('overview / stock / exchange_trend / task_distribution'),
          days: P.int('exchange_trend 天数，默认 7'),
          ...TOKEN_PROP,
        },
      },
    },
  ],

  call: {
    'hdgrow_admin_login': async (a, ctx) =>
      // 统一登录：同一账号同时登录「成长 + 博客」两个管理台。
      loginBoth(ctx?.sessionId, a.username, a.password),
    'hdgrow_admin_logout': async (_a, ctx) =>
      // 统一登出：同时登出两个管理台。
      logoutBoth(ctx?.sessionId),

    'hdgrow_admin_change_create': (a, ctx) =>
      runWithConfirm(
        ctx,
        'hdgrow_admin_change_create',
        a,
        async () => {
          const r = await callGrowAdmin(ctx?.sessionId, 'POST', GROW_ADMIN.changePreview, {
            body: { target_type: a.target_type, target_id: a.target_id, field_group: a.field_group, after: a.after, reason: a.reason },
            token: a.token,
          });
if (!r.ok) {
            if (r.error?.code === CODES.NOT_FOUND) {
              return {
                action: '创建变更单草案（后端无预览接口，按参数预览）',
                target_type: a.target_type,
                target_id: a.target_id,
                field_group: a.field_group,
                after: a.after,
                reason: a.reason,
              };
            }
            return r;
          }
          return { action: '创建变更单草案（不会立即生效）', ...r.data, reason: a.reason };
        },
        () =>
          callGrowAdmin(ctx?.sessionId, 'POST', GROW_ADMIN.change, {
            body: { target_type: a.target_type, target_id: a.target_id, field_group: a.field_group, after: a.after, reason: a.reason },
            token: a.token,
          }),
      ),
    'hdgrow_admin_change_commit': (a, ctx) =>
      runWithConfirm(
        ctx,
        'hdgrow_admin_change_commit',
        a,
        () => changePreview(ctx, a, '提交变更单（LOW/MID→READY，HIGH→PENDING_APPROVAL）'),
        () =>
          callGrowAdmin(ctx?.sessionId, 'POST', `${GROW_ADMIN.change}/${encodeURIComponent(a.id)}/commit`, {
            body: { confirm_token: a.confirm_token, reason: a.reason },
            token: a.token,
          }),
      ),
    'hdgrow_admin_change_approve': (a, ctx) =>
      runWithConfirm(
        ctx,
        'hdgrow_admin_change_approve',
        a,
        () => changePreview(ctx, a, `审批变更单（${a.decision}）`),
        () =>
          callGrowAdmin(ctx?.sessionId, 'POST', `${GROW_ADMIN.change}/${encodeURIComponent(a.id)}/approve`, {
            body: { decision: a.decision, comment: a.comment },
            token: a.token,
          }),
      ),
    'hdgrow_admin_change_apply': (a, ctx) =>
      runWithConfirm(
        ctx,
        'hdgrow_admin_change_apply',
        a,
        () => changePreview(ctx, a, '生效变更单（写入目标表）'),
        () => callGrowAdmin(ctx?.sessionId, 'POST', `${GROW_ADMIN.change}/${encodeURIComponent(a.id)}/apply`, { token: a.token }),
      ),
    'hdgrow_admin_change_revert': (a, ctx) =>
      runWithConfirm(
        ctx,
        'hdgrow_admin_change_revert',
        a,
        () => changePreview(ctx, a, '回滚变更单（恢复 before / 逻辑删除新建项）'),
        () => callGrowAdmin(ctx?.sessionId, 'POST', `${GROW_ADMIN.change}/${encodeURIComponent(a.id)}/revert`, { token: a.token }),
      ),
    'hdgrow_admin_change_get': (a, ctx) =>
      callGrowAdmin(ctx?.sessionId, 'GET', `${GROW_ADMIN.change}/${encodeURIComponent(a.id)}`, { token: a.token }),
    'hdgrow_admin_change_page': (a, ctx) =>
      callGrowAdmin(ctx?.sessionId, 'GET', `${GROW_ADMIN.change}/page`, {
        query: { status: a.status, submitter: a.submitter, include_archived: a.include_archived, page_no: a.page_no, page_size: a.page_size },
        token: a.token,
      }),
    'hdgrow_admin_change_cancel': (a, ctx) =>
      runWithConfirm(
        ctx,
        'hdgrow_admin_change_cancel',
        a,
        () => changePreview(ctx, a, '取消变更单（仅草案，不可恢复）'),
        () => callGrowAdmin(ctx?.sessionId, 'POST', GROW_ADMIN.changeCancel(a.id), { token: a.token }),
      ),
    'hdgrow_admin_change_archive': (a, ctx) =>
      runWithConfirm(
        ctx,
        'hdgrow_admin_change_archive',
        a,
        () => changePreview(ctx, a, '归档变更单（仅终态，列表默认隐藏）'),
        () => callGrowAdmin(ctx?.sessionId, 'POST', GROW_ADMIN.changeArchive(a.id), { token: a.token }),
      ),

    'hdgrow_admin_task_update': (a, ctx) => {
      const built = buildTaskUpdatePayload(a);
      if (!built.ok) return fail(CODES.PARAM_ERROR, built.message);
      return runWithConfirm(
        ctx,
        'hdgrow_admin_task_update',
        a,
        async () => {
          const r = await callGrowAdmin(ctx?.sessionId, 'POST', GROW_ADMIN.changePreview, { body: built.body, token: a.token });
          if (!r.ok) {
            if (r.error?.code === CODES.NOT_FOUND) {
              return { action: '修改任务（后端无预览接口，按参数预览）', ...built.body };
            }
            return r;
          }
          return { action: `修改任务（脏字段：${built.fields.join(', ')}）`, ...r.data, reason: a.reason };
        },
        () => callGrowAdmin(ctx?.sessionId, 'POST', GROW_ADMIN.change, { body: built.body, token: a.token }),
      );
    },

    'hdgrow_admin_reissue_create': (a, ctx) =>
      runWithConfirm(
        ctx,
        'hdgrow_admin_reissue_create',
        a,
        async () => ({
          action: '新建任务补发申请（此时不发放积分，需再审核+入账）',
          user_id: a.user_id,
          task_id: a.task_id,
          points: a.points,
          reason: a.reason,
        }),
        () =>
          callGrowAdmin(ctx?.sessionId, 'POST', GROW_ADMIN.reissue, {
            body: { user_id: a.user_id, task_id: a.task_id, points: a.points, reason: a.reason, request_id: a.request_id },
            token: a.token,
          }),
      ),
    'hdgrow_admin_reissue_page': (a, ctx) =>
      callGrowAdmin(ctx?.sessionId, 'GET', GROW_ADMIN.reissuePage, {
        query: {
          user_id: a.user_id,
          task_id: a.task_id,
          status: a.status,
          submitter: a.submitter,
          id: a.id,
          page_no: a.page_no,
          page_size: a.page_size,
        },
        token: a.token,
      }),
    'hdgrow_admin_reissue_get': (a, ctx) =>
      callGrowAdmin(ctx?.sessionId, 'GET', GROW_ADMIN.reissueGet(a.id), { token: a.token }),
    'hdgrow_admin_reissue_approve': (a, ctx) =>
      runWithConfirm(
        ctx,
        'hdgrow_admin_reissue_approve',
        a,
        () => reissuePreview(ctx, a, `审核补发单（${a.decision}）`),
        () =>
          callGrowAdmin(ctx?.sessionId, 'POST', GROW_ADMIN.reissueApprove(a.id), {
            body: { decision: a.decision, comment: a.comment },
            token: a.token,
          }),
      ),
    'hdgrow_admin_reissue_issue': (a, ctx) =>
      runWithConfirm(
        ctx,
        'hdgrow_admin_reissue_issue',
        a,
        () => reissuePreview(ctx, a, '执行补发入账（真实发放积分）'),
        () => {
          if (a.confirm !== true) {
            return fail(CODES.PARAM_ERROR, 'reissue_issue 会真实发放积分：需显式传 confirm:true（先 reissue_get 核对用户与积分）');
          }
          return callGrowAdmin(ctx?.sessionId, 'POST', GROW_ADMIN.reissueIssue(a.id), { token: a.token });
        },
      ),

    'hdgrow_admin_natural_person_page': (a, ctx) =>
      callGrowAdmin(ctx?.sessionId, 'GET', GROW_ADMIN.naturalPersonPage, {
        query: {
          status: a.status,
          applicant: a.applicant,
          apply_type: a.apply_type,
          id: a.id,
          page_no: a.page_no,
          page_size: a.page_size,
        },
        token: a.token,
      }),
    'hdgrow_admin_natural_person_get': (a, ctx) =>
      callGrowAdmin(ctx?.sessionId, 'GET', GROW_ADMIN.naturalPersonGet(a.id), { token: a.token }),
    'hdgrow_admin_natural_person_approve': (a, ctx) =>
      runWithConfirm(
        ctx,
        'hdgrow_admin_natural_person_approve',
        a,
        () => naturalPersonPreview(ctx, a, '通过首个自然人变更申请（原账号将立即按 20021 拦截）'),
        () =>
          callGrowAdmin(ctx?.sessionId, 'POST', GROW_ADMIN.naturalPersonApprove(a.id), {
            body: { comment: a.comment },
            token: a.token,
          }),
      ),
    'hdgrow_admin_natural_person_reject': (a, ctx) =>
      runWithConfirm(
        ctx,
        'hdgrow_admin_natural_person_reject',
        a,
        () => naturalPersonPreview(ctx, a, '驳回首个自然人变更申请'),
        () =>
          callGrowAdmin(ctx?.sessionId, 'POST', GROW_ADMIN.naturalPersonReject(a.id), {
            body: { comment: a.comment },
            token: a.token,
          }),
      ),

    'hdgrow_admin_user_block': (a, ctx) =>
      runWithConfirm(
        ctx,
        'hdgrow_admin_user_block',
        a,
        async () => ({ action: '拉黑用户（后续发积分跳过该用户）', user_id: a.id, reason: a.reason }),
        () =>
          callGrowAdmin(ctx?.sessionId, 'POST', GROW_ADMIN.userBlock(a.id), {
            body: { reason: a.reason },
            token: a.token,
          }),
      ),
    'hdgrow_admin_user_unblock': (a, ctx) =>
      runWithConfirm(
        ctx,
        'hdgrow_admin_user_unblock',
        a,
        async () => ({ action: '解除拉黑', user_id: a.id }),
        () => callGrowAdmin(ctx?.sessionId, 'POST', GROW_ADMIN.userUnblock(a.id), { token: a.token }),
      ),

    'hdgrow_admin_task_categories': () => callGrowShow('GET', GROW_SHOW.taskCategories),
    'hdgrow_admin_env': () => ok(envInfo()),

    'hdgrow_admin_task_page': (a, ctx) =>
      callGrowAdmin(ctx?.sessionId, 'GET', GROW_ADMIN.taskPage, {
        query: {
          category_id: a.category_id,
          enabled: a.enabled,
          is_show: a.is_show,
          deleted: a.deleted,
          keyword: a.keyword,
          page_no: a.page_no,
          page_size: a.page_size,
        },
        token: a.token,
      }),
    'hdgrow_admin_task_get': (a, ctx) =>
      callGrowAdmin(ctx?.sessionId, 'GET', GROW_ADMIN.taskGet(a.id), { token: a.token }),
    'hdgrow_admin_prize_page': (a, ctx) =>
      callGrowAdmin(ctx?.sessionId, 'GET', GROW_ADMIN.prizePage, {
        query: { on_shelf: a.on_shelf, deleted: a.deleted, keyword: a.keyword, page_no: a.page_no, page_size: a.page_size },
        token: a.token,
      }),
    'hdgrow_admin_prize_get': (a, ctx) =>
      callGrowAdmin(ctx?.sessionId, 'GET', GROW_ADMIN.prizeGet(a.id), { token: a.token }),
    'hdgrow_admin_whitelist_page': (a, ctx) =>
      callGrowAdmin(ctx?.sessionId, 'GET', GROW_ADMIN.whitelistPage, {
        query: {
          service_name: a.service_name,
          auth_type: a.auth_type,
          enabled: a.enabled,
          page_no: a.page_no,
          page_size: a.page_size,
        },
        token: a.token,
      }),

    'hdgrow_admin_record_points': (a, ctx) =>
      callGrowAdmin(ctx?.sessionId, 'GET', GROW_ADMIN.recordPoints, {
        query: { user_id: a.user_id, keyword: a.keyword, type: a.type, page_no: a.page_no, page_size: a.page_size },
        token: a.token,
      }),
    'hdgrow_admin_record_exchange': (a, ctx) =>
      callGrowAdmin(ctx?.sessionId, 'GET', GROW_ADMIN.recordExchange, {
        query: { user_id: a.user_id, keyword: a.keyword, prize_id: a.prize_id, status: a.status, page_no: a.page_no, page_size: a.page_size },
        token: a.token,
      }),
    'hdgrow_admin_record_issue': (a, ctx) =>
      callGrowAdmin(ctx?.sessionId, 'GET', GROW_ADMIN.recordIssue, {
        query: { domain_id: a.domain_id, keyword: a.keyword, status: a.status, page_no: a.page_no, page_size: a.page_size },
        token: a.token,
      }),
    'hdgrow_admin_record_job': (a, ctx) =>
      callGrowAdmin(ctx?.sessionId, 'GET', GROW_ADMIN.recordJob, {
        query: { job_code: a.job_code, batch_no: a.batch_no, keyword: a.keyword, status: a.status, page_no: a.page_no, page_size: a.page_size },
        token: a.token,
      }),
    'hdgrow_admin_user_page': (a, ctx) =>
      callGrowAdmin(ctx?.sessionId, 'GET', GROW_ADMIN.userPage, {
        query: {
          domain_id: a.domain_id,
          iam_id: a.iam_id,
          domain_name: a.domain_name,
          keyword: a.keyword,
          blocked: a.blocked,
          page_no: a.page_no,
          page_size: a.page_size,
        },
        token: a.token,
      }),

    'hdgrow_admin_stats': (a, ctx) => {
      const kind = String(a.kind || '');
      const pathMap = GROW_ADMIN.stats;
      const path = pathMap[kind];
      if (!path) return fail(CODES.PARAM_ERROR, 'kind 须为 overview / stock / exchange_trend / task_distribution');
      return callGrowAdmin(ctx?.sessionId, 'GET', path, {
        query: kind === 'exchange_trend' ? { days: a.days } : undefined,
        token: a.token,
      });
    },
  },
};
