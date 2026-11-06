# Task — Issue #11 dsh target MCP 自动注册

## 任务拆解

1. [x] 红：新增 `test/dsh-patch.test.mjs`（渲染、幂等、手写保留、非法文档、状态、预检）。
2. [x] 红：更新 `test/setup-cli.test.mjs`（dsh install/uninstall/doctor、DSH_HOME/DSH_PROFILE、fail-fast、all）。
3. [x] 绿：新增 `src/dsh-patch.mjs` 并接入 `src/setup-cli.mjs`。
4. [x] 文档：README target 表 / DSH 小节、CHANGELOG。
5. [ ] 运行 `npm test`，确认全绿且既有用例不回归。
6. [ ] 自审查（5 轴 + pre-pr 增量检查）。
7. [ ] 建 PR 并在 Issue 评论告知，A2A 通知 QA 审查。