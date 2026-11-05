# Tasks — Issue #2

| # | 切片 | 产物 | 验收 |
|---|------|------|------|
| 1 | 文档：需求/方案/拆解 | `docs/issue-2/{spec,plan,task}.md` | 与 Issue #2 Spec 一致 |
| 2 | RED：`install --help` / `uninstall --help` 回归测试 | `test/setup-cli-help.test.mjs` | 修复前用例失败（复现 bug） |
| 3 | GREEN：`main()` 分支内 `args.help` 短路 | `src/setup-cli.mjs` | 用例转绿，帮助打印且零文件改动 |
| 4 | 回归：正常 install/uninstall 与无命令 `--help` | 同一测试文件 | 全绿，`npm test` 通过 |
| 5 | 交付：push 分支 + PR + Issue 评论 + A2A QA | PR / 评论 | 链路完成 |

## 完成定义（DoD）

- [x] 文档三件套入库
- [x] 测试先红后绿，且能稳定复现原缺陷
- [x] `npm test` 全绿
- [x] 自审查（5 轴 + 开源前置增量检查）通过
- [x] PR 创建、Issue 评论告知、A2A 通知 QA