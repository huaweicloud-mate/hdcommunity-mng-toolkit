# Task — Issue #9 默认对接域名切换为现网 open-dataset

## 任务拆解

1. [ ] 红：新增 `test/config.test.mjs`（默认值/空串/显式覆盖/任意地址/context-path）。
2. [ ] 红：新增 `test/docs-config.test.mjs`（默认值锁定 + 文档无 opentest 残留）。
3. [ ] 绿：修改 `src/config.mjs` 默认值为现网地址 + 迁移注释。
4. [ ] 运行 `npm test`，确认全绿且现有用例不受影响。
5. [ ] 自审查（5 轴 + pre-pr 增量检查）。
6. [ ] 建 PR 并在 Issue 评论告知，A2A 通知 QA 审查。