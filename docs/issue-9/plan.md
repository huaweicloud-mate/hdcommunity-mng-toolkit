# Plan — Issue #9 默认对接域名切换为现网 open-dataset

## 1. 设计决策

| 决策 | 选择 | 理由 |
|---|---|---|
| 默认值来源 | 单行 `process.env.HDCOMMUNITY_BASE \|\| '<现网地址>'` | 与既有形式一致，零行为变更，仅换兜底常量 |
| 测试 seam | 子进程 `spawnSync(node --input-type=module -e import(config))` | `config.mjs` 模块加载时求值，同进程无法切换 env；子进程才能验证真实用户行为 |
| 文档守卫强度 | 锁 `src/config.mjs` 默认字符串 + 断言文档无 opentest 残留 | README 未写死默认值（「见 config」），等值断言会与现状冲突 |
| opentest 表述 | 仅保留在迁移说明注释中 | 测试环境用户需要明确迁移方式，验收允许注释除外 |

## 2. 模块设计

### `src/config.mjs`（修改）
- 第 6 行兜底值替换为 `https://open-dataset.huaweicloud.com/api/v1/blogservice`。
- 在上方注释补充：测试环境请显式设置 `HDCOMMUNITY_BASE=https://opentest-dataset.huaweicloud.com/api/v1/blogservice`。

### `test/config.test.mjs`（新增）
以 `pathToFileURL(join(__dirname,'..','src','config.mjs')).href` 为模块 URL，在子进程中清空/注入
`HDCOMMUNITY_BASE` 后输出 `m.BACKEND_BASE`，断言：

| 用例 | 环境 | 期望 |
|---|---|---|
| 未设置 | 删除 `HDCOMMUNITY_BASE` | 现网地址 |
| 空串 | `HDCOMMUNITY_BASE=''` | 现网地址 |
| 显式覆盖 opentest | 测试环境地址 | 原样 |
| 任意自定义地址 | `http://127.0.0.1:8080/api/v1/blogservice` | 原样 |
| context-path | 默认 | 以 `/api/v1/blogservice` 结尾 |

### `test/docs-config.test.mjs`（新增）
- 正则提取 `src/config.mjs` 默认值，断言等于现网地址。
- 读取 `README.md`、`skills/hd-blog-operator/SKILL.md`，断言不含 `opentest-dataset`。

## 3. 依赖关系
`config.mjs` 被 `src/tools/*`、`src/mcp-server.mjs`、`scripts/smoke.mjs` 引用，本次不改引用方。
测试仅用 Node 内置 `node:test` / `node:child_process` / `node:fs` / `node:url`。