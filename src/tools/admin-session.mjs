// Admin session: one login → the community (blog) management console; one logout → same.
//
// Auth uses /manage/auth/login with an internal account; the Bearer token is cached
// per session (setSessionToken) so subsequent admin tools reuse it.

import { loginAdmin, logoutAdmin } from './http-client.mjs';
import { setSessionToken, clearSessionToken } from '../session.mjs';
import { ok, fail, CODES } from '../errors.mjs';

/**
 * Log in to the community management console.
 * @returns {Promise<{ok:boolean, data?:object, error?:{code:string,message:string}}>}
 */
export async function loginAdminSession(sessionId, username, password) {
  const b = await loginAdmin(username, password);
  if (!b.ok) return fail(b.error?.code || CODES.UNAUTHORIZED, b.error?.message || '登录失败');
  const d = b.data || {};
  const user = d.user || {};
  setSessionToken(sessionId, { token: d.token, username: user.username, role: user.role });
  return ok({ username: user.username, role: user.role, mustChangePassword: d.must_change_password });
}

/** Log out of the management console and clear the cached token. */
export async function logoutAdminSession(sessionId) {
  await logoutAdmin(sessionId);
  clearSessionToken(sessionId);
  return ok({ loggedOut: true });
}