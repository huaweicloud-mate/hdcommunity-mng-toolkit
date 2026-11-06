# Spec — Issue #11 dsh target MCP 自动注册

## 1. 目标

让 `hdcommunity-mng-toolkit install --target dsh` 在安装 Skills 的同时，自动把本工具 MCP server 注册到 DSH 的 per-profile patch 文件 `$DSH_HOME/profiles/<profile>/cordis.patch.yml`；`uninstall --target dsh` 同步移除。

## 2. 背景

当前 dsh target 仅安装 skills，MCP 需用户手工粘贴配置；姊妹仓 `hdcommunity-toolkit@0.7.0` 已通过 `src/dsh-patch.mjs` 实现自动注册，需要对齐。

## 3. 范围

### In Scope
- 新增 `src/dsh-patch.mjs`：受管注释块 + `- insert:` 条目、按 id 幂等、按注释块移除、状态探测、安装前 fail-fast 校验。
- `src/setup-cli.mjs`：`dsh` 纳入 `MCP_AUTO_TARGETS`；install / uninstall / doctor 接入。
- `README.md`：target 表与 DSH 小节改为自动注册说明。
- `CHANGELOG.md`：记录特性。
- 新增 `test/dsh-patch.test.mjs`、更新 `test/setup-cli.test.mjs`。

### Out of Scope
- 不修改 opencode 现有行为，不补齐 opencode uninstall 清理。
- 不引入 YAML 解析依赖。
- 不改 DSH 配置格式或其它 profile 语义。

## 4. 期望行为

1. 全新 HOME 下 install --target dsh 后 `~/.dsh/profiles/web/cordis.patch.yml` 出现 `id: mcp-hdcommunity` 的 insert 条目。
2. 重复 install 按 id 幂等，不重复追加；受管块按当前 `HDCOMMUNITY_BASE` 原地刷新。
3. uninstall 仅移除受管条目，保留用户手写内容；手写同 id 不被重复写入、也不被删除。
4. `DSH_HOME` / `DSH_PROFILE` 覆盖生效。
5. `DSH_HOME` 非目录/不可写、patch 非 YAML 序列、目标文件不可写时 fail-fast：非 0 退出、输出 `CONFIG_MISSING` / `CONFIG_INVALID` 与修复指引，当次不写 skills、不写 patch。
6. `doctor` 显示 dsh MCP `OK` / `MISSING` / `INVALID`。
7. opencode 等目标不回归，`npm test` 全绿。

## 5. 验收标准

- [ ] install --target dsh 自动写入 MCP 条目
- [ ] 重复 install 幂等
- [ ] uninstall 仅移除受管条目
- [ ] 手写同 id 不重复写、不被删除
- [ ] 非法配置 fail-fast 且无部分写入
- [ ] DSH_HOME / DSH_PROFILE 覆盖生效
- [ ] doctor 三态正确
- [ ] 既有 target 不回归，`npm test` 全绿