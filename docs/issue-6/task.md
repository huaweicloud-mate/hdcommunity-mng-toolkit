# Task Breakdown — Issue #6

| # | 任务 | 产出 | 状态 |
|---|---|---|---|
| T1 | 需求文档与方案设计 | `docs/issue-6/spec.md` / `plan.md` / `task.md` | done |
| T2 | 失败测试先行（红） | `test/setup-cli.test.mjs`：target 真源、help/status 覆盖、未知 target、默认 target、all 安装、doctor/update、README 一致性 | done |
| T3 | 最小实现（绿） | `src/setup-cli.mjs`：`TARGETS` 真源、target 校验、包名修正、doctor/update；`bin/setup.cjs` 调用导出 `main` | done |
| T4 | 文档同步 | `README.md` 安装章节重写（支持列表 + Quick Start + 10 个小节 + Other Agents + dsh 说明） | done |
| T5 | 验证 | `node --test`（含新增用例）全绿；`npm run smoke` 通过 | done |
| T6 | 自审查 + PR | 5 轴审查 + 开源前置增量检查 → PR `feat/issue-6` → `main` | done |

提交策略（TDD 红/绿分提交）：

1. `docs(#6): 需求文档与方案设计`
2. `test(#6): setup-cli target 真源与 README 一致性失败测试`
3. `feat(#6): setup-cli TARGETS 单一真源 + target 校验 + doctor/update`
4. `docs(#6): README 安装章节重写为 10 个 agent 逐节说明`

## 测试 seam 说明

- **真源 seam**：`export const TARGETS` —— 文档、`install('all')`、`status()`、`printHelp()` 全部由它派生。
- **CLI 端到端 seam**：`bin/setup.cjs` + `HOME`/`DSH_HOME` 指向临时目录，断言用户可见输出与落盘结果
  （不测内部函数，避免与实现耦合）。