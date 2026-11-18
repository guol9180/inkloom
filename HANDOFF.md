# InkLoom 会话交接

## 接手顺序

1. 先读 [README.md](./README.md)，了解项目定位、结构和最短运行方式。
2. 再读 [AGENTS.md](./AGENTS.md)，确认依赖方向和禁止事项。
3. 打开 [DEVELOP_PLAN.md](./DEVELOP_PLAN.md)，查看 T15/T16 与 M1 状态。
4. 产品、数据和同步设计只在 [docs/PRODUCT_AND_ARCHITECTURE.md](./docs/PRODUCT_AND_ARCHITECTURE.md) 维护。
5. 部署域名、环境变量、备份和回滚只在 [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) 维护。

## 当前结论

- 产品名：InkLoom / 墨织。
- 浏览器域名：`https://inkloom.imhgl.com`。
- API 域名：`https://api.inkloom.imhgl.com`。
- 开源仓库：`https://github.com/guol9180/inkloom`，默认分支 `main`。
- T15 已提交为 `4415b6d`：Web + API 的账号、云端 SQLite、revision、历史恢复和冲突副本闭环可本地运行。
- T16 的自动化测试、容器、Caddy、CI/CD 和上线校验已准备；生产部署等待用户明确指令。
- 用户要求 M1 上线后暂停后续开发，T4 桌面、M2 离线同步等不得自行继续。

## 已验证

```text
pnpm typecheck
结果：全部 workspace 通过

pnpm test
结果：31 项通过

pnpm build
结果：Web 与 API 生产构建成功；仅有图表大 chunk 警告

pnpm test:e2e
结果：Playwright 1 项完整流程通过（注册、编辑、刷新、导出、删除、冲突、退出）

pnpm audit --prod
结果：1 high + 1 low；high 为 Excalidraw 的 Sass 构建链 picomatch，生产 Web bundle 未包含该链
```

验证日期：2026-11-18。

## 部署前置条件

- 创建 `inkloom.imhgl.com` 与 `api.inkloom.imhgl.com` 的 DNS 记录。
- 目标 Linux 主机安装 Docker Engine 与 Compose 插件，并开放 80/443。
- 提供 SSH 部署用户、私钥和绝对部署目录，或配置 `Deploy Web MVP` workflow 的同名 secrets。
- 用户明确下达部署指令后，再执行 `docker compose -f deploy/compose.yaml up -d --build`。

当前机器没有生产域名解析、可用 SSH 部署凭据或 Docker 运行时；未执行任何线上变更。

## 已知边界

- 正文事实源是服务端 SQLite 中的 Markdown；localStorage 仅保存未成功写入的临时草稿。
- 尚无跨设备离线队列、实时协作、团队权限和对象存储。
- Excalidraw 仍使用当前原型场景数据模型。
- 审计剩余 high 位于构建链而非生产 bundle；上游发布修复后应移除依赖覆盖并重跑审计。
