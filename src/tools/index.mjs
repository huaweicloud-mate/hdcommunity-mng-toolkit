// Tool registry: aggregates all tool groups and routes calls by name.
//
// 管理面/运营面工具包（hdcommunity-mng-toolkit）：
//   hdcommunity_admin_*  博客管理台（登录/审核/上下线/置顶/统计/记录）
//   hdgrow_admin_*       成长中心管理台（变更单分级审批/查询/审计/统计）
//   hdgrow_*             成长中心业务侧（查积分/任务/权益，发积分/发券/兑换；AK/SK）
//   hdcommunity_admin_blog_risk_check  本地内容风控（随博客管理台）

import { ADMIN_TOOLS } from './admin-tools.mjs';
import { GROW_ADMIN_TOOLS } from './grow-admin-tools.mjs';
import { GROW_BIZ_TOOLS } from './grow-biz-tools.mjs';
import { RISK_TOOLS } from './risk-control.mjs';
import { fail, CODES } from '../errors.mjs';

const GROUPS = [ADMIN_TOOLS, GROW_ADMIN_TOOLS, GROW_BIZ_TOOLS, RISK_TOOLS];

export const TOOL_DEFINITIONS = GROUPS.flatMap((g) => g.definitions);

const handlers = new Map();
for (const g of GROUPS) {
  for (const [name, fn] of Object.entries(g.call)) handlers.set(name, fn);
}

/**
 * Invoke a tool by name.
 * @param {string} name
 * @param {object} args
 * @param {{ sessionId?: string }} [ctx]
 * @returns {Promise<{ok: boolean, data?: any, error?: {code: string, message: string}}>}
 */
export async function callTool(name, args, ctx = {}) {
  const fn = handlers.get(name);
  if (!fn) return fail(CODES.PARAM_ERROR, `未知工具: ${name}`);
  try {
    return await fn(args || {}, ctx);
  } catch (e) {
    return fail(CODES.UPSTREAM_ERROR, `工具执行异常: ${e.message}`);
  }
}