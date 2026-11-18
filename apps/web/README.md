# @inkloom/web

InkLoom Web 应用。当前通过 `@inkloom/storage` 的 Cloud adapter 接入账号工作区和真实持久化 API。

它覆盖账号会话、Markdown 源码/预览、服务端自动保存、版本恢复、Mermaid 图表和 Excalidraw 自由画布。

## 直接运行

需要 Node.js 22+。先构建并启动 API，再启动 Web：

```powershell
pnpm build
pnpm start:api
node serve.mjs
```

打开 `http://127.0.0.1:4173`。

## 开发模式

```powershell
pnpm dev:web
```

构建：

```powershell
pnpm --filter @inkloom/web build
```

## 原型能力

- 注册、登录、退出和刷新后的会话恢复
- 新建、搜索、切换、移动、删除和恢复历史版本
- Markdown 源码、分栏、阅读三种模式
- 550ms 防抖自动保存，Web 通过 `@inkloom/storage` 的 `CloudWorkspaceAdapter` 访问 API
- Mermaid fenced code block 由 `@inkloom/diagrams` 按需加载并安全渲染
- Excalidraw 由 `@inkloom/diagrams` 按需加载，场景编辑与恢复
- Markdown 文件导入、单文档导出
- revision 冲突时自动保留云端版本和本地冲突副本
- Chromium 目录导入（读取后写入云端）

## 原型边界

当前边界：

- 正文事实源是服务端 SQLite 中的 Markdown；浏览器 localStorage 只保留未成功写入的临时草稿
- 还没有跨设备离线队列、双向同步、实时协作和团队权限
- 文件夹导入只读取 Markdown 并创建云端文档，不会写回本地目录
- Excalidraw 仍使用当前原型场景模型，生产资产拆分到 `.excalidraw` 与 SVG 文件属于后续任务
- 生产依赖审计仍有图表传递依赖风险，发布前必须按部署文档执行检查

项目说明见 [根 README](../../README.md)，架构见 [产品与技术方案](../../docs/PRODUCT_AND_ARCHITECTURE.md)，当前任务见 [DEVELOP_PLAN](../../DEVELOP_PLAN.md)。
