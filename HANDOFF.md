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
- T16 已完成：Inkloom Web 与 API 已部署到生产，GitHub Actions 负责外部构建、GHCR 推送、自动部署与线上验证。
- 当前生产 release 为 `f71fe4e4308713ec2852541371b91426ac50631d`。
- workbench 容器已移除，但 `ghcr.io/guol9180/workbench:v1.5.0` 镜像与 `workbench_workbench-docs` 数据卷保留，等待后续重新部署。
- 1Panel 已完整卸载，其旧数据与迁移备份已删除。
- 生产主机已清除旧 1Panel 安装包、`.zai`、旧 OpenClaw dashboard/ClawHub/mcporter、空 acme.sh 和不再使用的主机 Node/npm 环境；服务器只负责拉取和运行镜像。
- 一次由残留交互式 `1pctl` 脚本导致的高 CPU 已定位并处理；当前 CPU 约 99% 空闲，容器 CPU 为 0%，API 健康。
- 用户要求 M1 上线后暂停后续开发，T4 桌面、M2 离线同步等不得自行继续。

## 已验证

```text
pnpm typecheck
结果：全部 workspace 通过

pnpm test
结果：26 项通过（干净 release checkout；不含本地未提交的 T4 测试）

pnpm build
结果：Web 与 API 生产构建成功；仅有图表大 chunk 警告

pnpm test:e2e
结果：Playwright 1 项完整流程通过（注册、编辑、刷新、导出、删除、冲突、退出）

pnpm audit --prod
结果：1 high + 1 low；high 为 Excalidraw 的 Sass 构建链 picomatch，生产 Web bundle 未包含该链

GitHub Actions run 44280666039
结果：typecheck、单元/集成测试、Playwright、镜像构建、自动部署与生产验证全部通过
```

验证日期：2026-11-18。

## 生产部署

- DNS：`inkloom.imhgl.com` 与 `api.inkloom.imhgl.com` 均已指向生产服务器。
- 生产目录：`/srv/inkloom`，由专用 `inkloom-deploy` 用户拥有。
- 运行容器：`inkloom-edge` 与 `inkloom-api`，共享 `inkloom-edge` 网络。
- 数据卷：`inkloom-data`、`inkloom-caddy-data`、`inkloom-caddy-config`。
- 发布方式：手动运行 GitHub Actions `Deploy Web MVP`；服务器只执行镜像 `pull + up`，不运行应用构建。
- 安全：Actions 固定到提交 SHA，SSH host key 固定，部署与 GHCR 凭据只存在 GitHub Secrets；开源仓库不保存任何部署秘密。

## 已知边界

- 正文事实源是服务端 SQLite 中的 Markdown；localStorage 仅保存未成功写入的临时草稿。
- 尚无跨设备离线队列、实时协作、团队权限和对象存储。
- Excalidraw 仍使用当前原型场景数据模型。
- 审计剩余 high 位于构建链而非生产 bundle；上游发布修复后应移除依赖覆盖并重跑审计。
