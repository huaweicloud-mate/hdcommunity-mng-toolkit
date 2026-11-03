// Smoke test: exercise the MCP protocol layer in-process (no network).
const { dispatch } = await import('../src/mcp-protocol.mjs');

const init = await dispatch('initialize', { clientInfo: { name: 'smoke' } });
const list = await dispatch('tools/list', {});

const names = list.tools.map((t) => t.name);
const expect = [
  'hdcommunity_admin_login',
  'hdcommunity_admin_blog_review',
  'hdcommunity_admin_blog_risk_check',
  'hdgrow_admin_login',
  'hdgrow_admin_change_create',
];

const missing = expect.filter((n) => !names.includes(n));

console.log('server:', init.serverInfo.name, init.serverInfo.version);
console.log('tools:', names.length);
console.log('sample:', names.slice(0, 5).join(', '), '...');

// Params validation should reject missing required args (admin login needs username/password).
let validationOk = false;
try {
  await dispatch('tools/call', { name: 'hdcommunity_admin_login', arguments: {} });
} catch (e) {
  validationOk = e.code === -32602;
}

if (missing.length || !validationOk) {
  console.error('SMOKE FAILED. missing:', missing, 'validationOk:', validationOk);
  process.exit(1);
}
console.log('SMOKE OK');
