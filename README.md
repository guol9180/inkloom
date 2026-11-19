<p align="center">
  <img src="./design/logo-lockup.svg" alt="InkLoom" width="440">
</p>

# InkLoom

Markdown-native, file-first knowledge workspace for text, diagrams, and the web.

InkLoom 是一套以 Markdown 为事实源、以普通文件为内容边界、同时提供 Web 与桌面客户端的知识工作台。正文、Mermaid 图表和 Excalidraw 画布都可以编辑、版本化和迁移。

![InkLoom Web workspace](./apps/web/preview-main.png)

## 项目状态

当前仓库包含一个已部署的 Web 云端工作区：

- Web：`https://inkloom.imhgl.com`
- API：`https://api.inkloom.imhgl.com`

- 邮箱注册、登录、退出和 HttpOnly 会话
- 每用户独立工作区，文档和 revision 持久化到服务端 SQLite
- Markdown 源码、分栏与阅读模式
- 文档目录、搜索、自动保存、移动、版本恢复和导入导出
- Mermaid 图表渲染
- Excalidraw 场景编辑与保存
- revision 冲突时保留云端版本和本地冲突副本

桌面客户端、真实磁盘工作区和跨设备离线同步已经完成技术设计，尚未实现。当前任务状态见 [DEVELOP_PLAN.md](./DEVELOP_PLAN.md)，产品与技术方案见 [docs/PRODUCT_AND_ARCHITECTURE.md](./docs/PRODUCT_AND_ARCHITECTURE.md)。

## 快速开始

启动 API 和已构建的 Web：

```powershell
pnpm build
$env:INKLOOM_DATABASE_PATH=".inkloom/inkloom.sqlite"
pnpm start:api
node apps/web/serve.mjs
```

打开 `http://127.0.0.1:4173`。API 默认位于 `http://127.0.0.1:3001`。

开发模式需要两个终端：

```bash
corepack enable
pnpm install
pnpm dev:api
pnpm dev:web
```

生产构建：

```bash
pnpm build
```

环境要求：Node.js 22.12+、pnpm 12.5.1。API 数据文件及服务端环境变量示例见 [.env.example](./.env.example)，生产要求见 [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)。桌面端后续要求 Rust stable 与 Tauri 2 所需系统依赖。

## 仓库结构

```text
inkloom/
├─ apps/
│  ├─ web/           @inkloom/web
│  ├─ desktop/       @inkloom/desktop
│  ├─ mobile-tauri/  @inkloom/mobile-tauri
│  └─ harmony/       ArkUI + ArkWeb
├─ packages/
│  ├─ core/          @inkloom/core
│  ├─ editor/        @inkloom/editor
│  ├─ diagrams/      @inkloom/diagrams
│  ├─ storage/       @inkloom/storage
│  ├─ sync/          @inkloom/sync
│  └─ ui/            @inkloom/ui
├─ services/
│  └─ api/           @inkloom/api
├─ docs/
├─ design/
├─ AGENTS.md
├─ DEVELOP_PLAN.md
└─ HANDOFF.md
```

## 域名与部署

公开仓库负责测试、构建与发布镜像；生产部署凭据和发布编排位于私有 `imhgl-ops` 控制面。部署域名、环境变量与拆分方式见 [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)。

## 技术方向

Web、桌面、图表与同步技术选型，以及移动端基础约束，见 [产品与技术方案](./docs/PRODUCT_AND_ARCHITECTURE.md)。

## 参与开发

开发规范见 [AGENTS.md](./AGENTS.md)，贡献流程见 [CONTRIBUTING.md](./CONTRIBUTING.md)。浏览器 localStorage 只用于未完成保存的临时草稿，正文事实源是服务端持久化文档；桌面文件版尚未实现。

## License

[MIT](./LICENSE)
