// Tool result helpers and backend-error -> toolkit-error mapping.

export const CODES = {
  AUTH_MISSING: 'AUTH_MISSING',
  AUTH_FAILED: 'AUTH_FAILED',
  CONFIG_MISSING: 'CONFIG_MISSING',
  UNAUTHORIZED: 'UNAUTHORIZED',
  NEED_LOGIN: 'NEED_LOGIN',
  FORBIDDEN: 'FORBIDDEN',
  PARAM_ERROR: 'PARAM_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  NOT_FOUND: 'NOT_FOUND',
  UPSTREAM_ERROR: 'UPSTREAM_ERROR',
};

/** Successful tool result. */
export function ok(data) {
  return { ok: true, data: data === undefined ? null : data };
}

/** Failed tool result. */
export function fail(code, message) {
  return { ok: false, error: { code, message: message || code } };
}

// Backend business codes (see design §6.1)
const BACKEND = {
  UNAUTHORIZED: 10001,
  FORBIDDEN: 10002,
  ADMIN_ROLE_DENIED: 10003,
  NOT_FOUND: 10004,
  RATE_LIMITED: 30001,
  SYSTEM_ERROR: 90000,
};

/**
 * Gateway 403 troubleshooting hint for the grow business face (hdgrow_*,
 * /agent/grow/** with AK/SK): the gateway whitelist entry must exist for the
 * caller AK with the matching auth_type (iam), otherwise the call is rejected
 * with 403 before reaching the backend.
 */
export const FORBIDDEN_HINT =
  'FORBIDDEN: 无权限访问（常见原因：AK 无效、白名单未注册或 auth_type 不匹配；' +
  '请确认网关白名单已为调用方 AK 注册 iam 类型（auth_type=iam）条目，或改用 appcode 鉴权；' +
  '可用 hdgrow_admin_whitelist_page 查看现有条目）';

/**
 * Attach FORBIDDEN_HINT to a FORBIDDEN failure result (code/structure unchanged).
 * Non-FORBIDDEN or successful results are returned untouched.
 * @param {{ok: boolean, error?: {code: string, message: string}}} result
 */
export function withForbiddenHint(result) {
  if (result && !result.ok && result.error?.code === CODES.FORBIDDEN) {
    const message = `${result.error.message || CODES.FORBIDDEN}；${FORBIDDEN_HINT}`;
    return { ...result, error: { ...result.error, message } };
  }
  return result;
}

/**
 * Map an HTTP status + backend ApiResponse.code to a toolkit error code.
 * @param {number} status
 * @param {number|null} apiCode
 * @returns {string}
 */
export function mapBackendError(status, apiCode) {
  if (status === 401 || apiCode === BACKEND.UNAUTHORIZED) return CODES.UNAUTHORIZED;
  if (status === 403 || apiCode === BACKEND.FORBIDDEN || apiCode === BACKEND.ADMIN_ROLE_DENIED) {
    return CODES.FORBIDDEN;
  }
  if (status === 429 || apiCode === BACKEND.RATE_LIMITED) return CODES.RATE_LIMITED;
  if (status === 404 || apiCode === BACKEND.NOT_FOUND) return CODES.NOT_FOUND;
  if (status >= 400 && status < 500) return CODES.PARAM_ERROR;
  return CODES.UPSTREAM_ERROR;
}
