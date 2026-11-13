# 开发规范

## 通用规范（必建四条）

1. **复用优先，不过度设计**：同一逻辑或结构出现第二份副本时，立即抽取为公共函数 / 公共样式 / 公共组件；前端页面表现优先组件化；保证代码质量，不为假想的未来需求预先抽象。
2. **文档同步**：DEVELOP_PLAN.md 随任务同步（进度只追加、状态如实流转）；AGENTS.md 仅在开发规范变化时更新；README.md 仅在项目定位、结构、用法或环境变化时更新——新增功能默认只记录在 DEVELOP_PLAN.md，不逐条追加进 README，README 不是变更日志。文档与代码不同步视为任务未完成。
3. **计划执行分离**：动手前先在 DEVELOP_PLAN.md 建任务卡（目标、验收标准、边界）并确认；执行中不得顺手扩范围，需求或范围变化先回任务卡更新，再改代码。
4. **诚实终态**：声明完成必须附实际产出文件与验证证据（执行了什么、结果如何）；未运行的测试或验证不得声称通过；受阻时如实标注 blocked 并写明原因与可否绕行。

## 单一事实源

- 项目定位、功能快照、运行方式和环境要求：`README.md`
- 产品原则、架构、数据模型和技术取舍：`docs/PRODUCT_AND_ARCHITECTURE.md`
- 任务范围、状态和验收：`DEVELOP_PLAN.md`
- 下个会话的接手步骤：`HANDOFF.md`
- 部署域名、子域和环境变量：`docs/DEPLOYMENT.md`

不得在上述文件之间复制整段内容；需要时使用相对链接。

## 目录与依赖方向

```text
apps/web ─┐
          ├─> packages/ui ─> packages/core
apps/desktop ┤
apps/mobile-tauri ┤
apps/harmony ┘

apps/* ─> packages/editor
apps/* ─> packages/diagrams
apps/* ─> packages/storage
apps/* ─> packages/sync
services/api ─> packages/core
```

- `packages/core` 保持平台无关，不直接导入 React、Tauri、Node、DOM API。
- `packages/storage` 只定义 adapter 与领域接口；Tauri、OPFS、File System Access 和 Cloud 实现分别注入。
- `packages/editor` 不直接访问磁盘、数据库或网络。
- `packages/diagrams` 按需加载 Mermaid 与 Excalidraw，禁止进入 Web 首屏主 chunk。
- `services/api` 不导入浏览器包。
- 跨包引用使用 `@inkloom/*` 包名，禁止相对路径穿透包边界。
- ArkUI 原生页面不得直接操作 Markdown 文档；通过 ArkWeb 编辑器和版本化 Bridge 访问。
- Tauri Android/iOS 与桌面端必须复用 storage/sync adapter，不复制业务逻辑。

## 移动平台约束

- `WorkspacePath` 是逻辑路径；Android URI、iOS security-scoped URL 和 Harmony sandbox 绝对路径不得进入共享状态。
- `PlatformCapabilities` 是能力判断的唯一来源，禁止通过 user-agent 猜测平台能力。
- Bridge 请求必须带 `PLATFORM_BRIDGE_VERSION`、request id、method 白名单和 JSON-safe payload。
- 原生句柄、文件描述符、数据库对象不得跨 Bridge 传给 JavaScript。
- 所有写入都携带 `baseRevision`；冲突必须返回 `RevisionConflictError` 等价错误。
- Harmony ArkWeb 特权调用必须校验来源 URL；耗时操作使用异步代理。
- 移动端进入网络同步前先完成本地持久化，必须能恢复被系统终止的编辑。
- 新增 adapter 必须通过统一的 adapter contract tests 后才能声明平台支持。

## 代码风格

- TypeScript 默认 `strict: true`，不使用无说明的 `any`。
- React 组件使用 PascalCase；hooks 使用 `useXxx`；领域文件使用 kebab-case。
- Markdown AST、文档 ID、路径和 revision 类型集中在 `packages/core`。
- 所有文件路径先在领域层标准化；UI 不拼接磁盘绝对路径。
- 样式 token 统一放在 `packages/ui`，页面不得重复定义品牌色和字体。
- 新增第三方依赖前先说明体积、许可证和安全影响。

## 流程要求

- 开始任务前先更新 `DEVELOP_PLAN.md` 对应任务卡。
- 提交前运行 `pnpm typecheck`、`pnpm build`；有测试后同时运行 `pnpm test`。
- E2E 或人工验证必须记录命令、环境和结果。
- 本地原型验证使用 `node apps/web/serve.mjs`，默认地址 `http://127.0.0.1:4173`。
- 提交使用 Conventional Commits，例如 `feat(storage): add local folder adapter`。
- 同一 PR 只处理一个任务卡；跨包重构单独提交。

## 禁止事项

- 禁止让数据库成为正文唯一副本。
- 禁止静默删除未知 Markdown、frontmatter 或自定义图表块。
- 禁止在生成 HTML 时跳过 DOMPurify；Mermaid 必须使用 strict 安全级别。
- 禁止允许工作区路径穿越或越界符号链接。
- 禁止把 Excalidraw 场景大 JSON 写入正文主体。
- 禁止在未通过 AST 往返测试时宣称“Markdown 无损”。
- 禁止把演示用 localStorage 存储直接作为生产数据层。
- 禁止在 `packages/core` 中出现平台条件分支、DOM、ArkTS、Tauri 或数据库 SDK。
- 禁止绕过 Bridge 白名单直接暴露 native 方法给网页。
- 禁止提交 `node_modules/`、构建缓存、密钥或真实用户文档。

项目背景见 [README.md](./README.md)，当前任务见 [DEVELOP_PLAN.md](./DEVELOP_PLAN.md)。
