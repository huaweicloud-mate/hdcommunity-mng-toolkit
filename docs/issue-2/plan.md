# Plan — Issue #2

## 方案（Spec 决策 B：分支内短路，影响面最小）

在 `src/setup-cli.mjs` 的 `main()` 中，为 `case 'install'` 与 `case 'uninstall'` 各加一段守卫：

```js
case 'install':
  if (args.help) {
    printHelp();
    return;
  }
  install(args.target || 'opencode');
  break;
```

`uninstall` 分支同构。`args.help` 由既有 `parseArgs` 统一设置（`--help` 与 `-h`），`printHelp()` 已存在，复用即可，不新增抽象、不改开关结构。

## 为什么不是全局拦截

`before switch: if (args.help && cmd !== 'help') { printHelp(); return; }` 会影响 `status` 等未来子命令的现有语义（例如 `status --help` 目前打印状态），改动面超出 Issue 范围。分支内检查仅改变 bug 行为。

## 测试 seam

CLI 进程边界（用户可见行为）：以子进程方式执行 `node src/setup-cli.mjs <args>`，注入隔离的 `HOME` 与 `DSH_HOME` 临时目录，断言 stdout/stderr、退出码与目录是否被创建/删除。不测内部函数，符合"测公开行为"。

## 风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| 误改正常 install/uninstall | 中 | 守卫只加在分支首行；用例覆盖 install/uninstall 正常路径回归 |
| 测试污染真实 HOME | 中 | 全部用例使用 `mkdtemp` 临时 HOME/DSH_HOME，结束回收 |
| 帮助优先级歧义 | 低 | 明确 help 优先（`install --help --target codex` 只打印帮助），用例固化 |

## 变更文件

- `src/setup-cli.mjs`（修改，约 8 行）
- `test/setup-cli-help.test.mjs`（新增）
- `docs/issue-2/{spec,plan,task}.md`（文档）