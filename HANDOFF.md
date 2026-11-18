# InkLoom 会话交接

## 接手顺序

1. 先读 [README.md](./README.md)，了解项目定位、结构和最短运行方式。
2. 再读 [AGENTS.md](./AGENTS.md)，确认依赖方向和禁止事项。
3. 打开 [DEVELOP_PLAN.md](./DEVELOP_PLAN.md)，从第一个 `planned` 任务继续。
4. 产品、数据和同步设计只在 [docs/PRODUCT_AND_ARCHITECTURE.md](./docs/PRODUCT_AND_ARCHITECTURE.md) 维护。
5. 部署域名和环境变量只在 [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) 维护。

## 当前结论

- 产品名：InkLoom / 墨织。
- 浏览器域名：`https://inkloom.imhgl.com`。
- API 域名：`https://api.inkloom.imhgl.com`。
- 协同域名：`wss://sync.inkloom.imhgl.com`。
- 开源仓库：`https://github.com/guol9180/inkloom`，默认分支 `main`。
- 包作用域：`@inkloom/*`。
- 当前 Web 原型位于 `apps/web`，已构建并验证。
- 下一个开发任务：按 T4 建立 Tauri 桌面临时/原子写工作区，并把 Tauri filesystem adapter 接入已导出的统一 contract tests；T9 在其余平台 adapter 接入前保持 in-progress。

## 已验证

```text
npm run build
结果：TypeScript 检查通过，Vite 生产构建成功

pnpm typecheck && pnpm test && pnpm build
结果：Web 与共享 packages 类型检查通过；22 项契约、Bridge、存储与 Markdown helper 测试通过；生产构建成功

node apps/web/serve.mjs
结果：生产构建可在 127.0.0.1:4173 启动

浏览器人工验证
结果：Markdown 文档、自动保存、Mermaid SVG、Excalidraw 场景加载和保存均可用；T3 后重新验证画布图元保存及整页刷新恢复
```

验证日期：2026-11-13。

## 原型边界

- 当前 Web 原型通过 `BrowserLocalAdapter` 保存数据，尚未接入生产数据库或云同步。
- Excalidraw 场景是演示数据，正式版本需保存完整 `.excalidraw` JSON。
- 尚无真实文件系统 adapter、SQLite、云 API 和协同服务。
- 依赖审计仍有已知传递依赖问题，正式发布前必须处理，详见产品方案的“主要风险”。

## GitHub 仓库后续设置

仓库已创建并完成首次推送。以下设置需要用户确认或执行：

1. 确认许可证。当前暂按 MIT 整理；若希望防止闭源 SaaS 派生，应改为 AGPL-3.0。
2. 在仓库设置中启用 Issues、Discussions 和 Private vulnerability reporting。
3. 配置 `main` 分支保护，要求 CI 通过。
4. 配置域名 DNS：
   - `inkloom.imhgl.com` -> Web
   - `api.inkloom.imhgl.com` -> API
   - `sync.inkloom.imhgl.com` -> WebSocket 服务
5. 添加 GitHub Actions secrets；当前 CI 不需要业务密钥。
6. 完成首次提交后再创建 v0.1.0 原型标签。

## 下个会话的第一条任务建议

> 按 DEVELOP_PLAN T4，建立 Tauri 桌面工作区，完成目录树、UTF-8 写入、临时文件原子替换、文件监听、越界与符号链接拒绝，并通过 `@inkloom/storage/contract-tests`。

不要直接把 Tauri 桌面壳加到单页 `App.tsx` 上；先完成包边界，否则后续 Web 与桌面会再次耦合。

T4 完成后执行 T5：接入 SQLite 索引、可重建全文搜索、反链与历史快照。移动端基础契约仍待各平台 adapter 接入后关闭 T9，见 [ADR 0005](./docs/adr/0005-mobile-ready-foundation.md)。
