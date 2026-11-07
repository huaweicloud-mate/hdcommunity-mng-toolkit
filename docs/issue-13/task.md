# Tasks — Issue #13

- [ ] 1. 先写失败测试：install→uninstall 后 opencode MCP 条目应为 0（红）。
- [ ] 2. 新增测试：保留用户其它 MCP/顶层字段；未安装无害；重装幂等；`--target all` 清理。
- [ ] 3. 实现 `removeOpencodeMcp()` 并接入 `uninstall()`（绿）。
- [ ] 4. 更新 README opencode 小节说明卸载同步移除 MCP。
- [ ] 5. `npm test` 全绿 + 复现脚本验收 `grep -c hdcommunity` = 0。
- [ ] 6. 自审查 + 敏感信息增量扫描，提交并推送 `feat/issue-13`，创建 PR。
- [ ] 7. Issue 评论告知、A2A 通知 QA 审查、`grape tasks complete` 收尾。