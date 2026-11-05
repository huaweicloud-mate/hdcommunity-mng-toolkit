# Spec — Issue #9 默认对接域名切换为现网 open-dataset

## 1. 目标

将 `BACKEND_BASE` 的兜底默认值从测试环境 `https://opentest-dataset.huaweicloud.com/api/v1/blogservice`
改为现网 `https://open-dataset.huaweicloud.com/api/v1/blogservice`，context-path `/api/v1/blogservice`
保持不变，并保留 `HDCOMMUNITY_BASE` 覆盖能力。

## 2. 背景

未显式配置 `HDCOMMUNITY_BASE` 的用户当前默认打到测试环境，属于现网对接正确性问题。该改进与
`hdcommunity-toolkit` v0.7.0 / PR #27 对齐。

## 3. 范围

### In Scope
- `src/config.mjs`：默认值替换 + 测试环境迁移说明注释。
- 新增 `test/config.test.mjs`：子进程 seam 验证默认值 / 空串 / 显式覆盖 / 任意地址原样保留 / context-path 不变。
- 新增 `test/docs-config.test.mjs`：正则锁定 `src/config.mjs` 默认值字符串，并断言 README、
  `skills/hd-blog-operator/SKILL.md` 无 `opentest-dataset` 残留。

### Out of Scope
- 不改 context-path `/api/v1/blogservice`、管理面路径常量、区域/超时等配置。
- 不改 `hdcommunity-toolkit` 仓。
- 不做真实网络联调（测试全部为进程内/子进程断言）。

## 4. 期望行为

1. 未设置 `HDCOMMUNITY_BASE` → 现网地址。
2. `HDCOMMUNITY_BASE=""`（空串）→ 现网地址（`||` 兜底语义）。
3. 显式设置（含 opentest 测试环境地址、任意自定义地址）→ 原样生效，不被裁剪。
4. 默认值仍以 `/api/v1/blogservice` 结尾。

## 5. 验收标准

- [ ] 默认值为 `https://open-dataset.huaweicloud.com/api/v1/blogservice`
- [ ] 空串兜底为现网地址
- [ ] 显式覆盖（含 opentest）原样生效
- [ ] 默认值以 `/api/v1/blogservice` 结尾
- [ ] 仓内无 `opentest-dataset` 默认表述残留（覆盖说明注释除外）
- [ ] `npm test`（`node --test`）全绿