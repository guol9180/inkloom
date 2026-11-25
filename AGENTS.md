# 开发规范

## 通用规范（必建五条）

1. **复用优先，不过度设计**：同一逻辑或结构出现第二份副本时，立即抽取为公共函数 / 公共样式 / 公共组件；前端表现层优先组件化；不牺牲可读性、可测性与可维护性，不为假想的未来需求预先抽象。
2. **文档同步**：DEVELOP_PLAN.md 逐任务更新（进度只追加、状态如实流转）；AGENTS.md 仅当开发规范变化时更新；README.md 仅当项目定位、结构、用法或环境变化时更新——新增功能默认只记录在 DEVELOP_PLAN.md，不逐条追加进 README，README 不是变更日志。文档与代码不同步视为任务未完成。
3. **计划执行分离**：动手前先在 DEVELOP_PLAN.md 建任务卡（目标、验收标准、边界）并经确认；执行中不得自行扩大任务范围，需求或范围变化先更新任务卡，再改代码。
4. **诚实终态**：声明完成必须附实际产出文件与验证证据（执行了什么、结果如何）；未运行的测试或验证不得声称通过；受阻时如实标注 blocked 并写明原因与可否绕行。
5. **精准修改**：每一行改动都必须能追溯到当前任务；不顺手改进相邻代码、注释或格式，不重构与当前任务无关的代码，也不动没坏的东西，匹配现有风格；只清理本次改动造成的孤儿代码（本次改动导致失效的导入 / 变量 / 函数）；发现既有死代码提及而不删，除非任务明确要求；注释只写代码装不下的信息（业务约束、非显然决策、坑位规避），不写改动叙事、阶段引用、代码复述。

## 单一事实源

- 项目定位、功能快照、运行方式和环境要求：`README.md`
- 产品原则、架构、数据模型和技术取舍：`docs/agents/product-and-architecture.md`
- 数据模型、API 契约和搜索：`docs/agents/data-and-api.md`
- 编辑器分层和 Markdown 能力边界：`docs/agents/editor-architecture.md`
- Web 信息架构、编辑器、视觉、动效、响应式和交互验收：
  `docs/agents/ux-and-editor-spec.md`
- 安全基线和性能目标：`docs/agents/security-and-performance.md`
- 任务范围、状态和验收：`DEVELOP_PLAN.md`
- 下个会话的接手步骤：`HANDOFF.md`
- 部署域名、子域和环境变量：`docs/agents/deployment.md`

不得在上述文件之间复制整段内容；需要时使用相对链接。

## 仓库边界

- `packages/core` 必须保持平台无关；packages 不得依赖 apps；跨包引用必须使用
  `@inkloom/*` 包名，禁止相对路径穿透包边界。
- 完整依赖方向见
  [产品与技术方案 · Repository and Dependency Direction](./docs/agents/product-and-architecture.md#5-repository-and-dependency-direction)，
  决策历史见 [ADR 0004](./docs/adr/0004-package-boundaries.md) 和
  [ADR 0007](./docs/adr/0007-desktop-scaffold-ordering-exception.md)。

## 当前交付边界

- 当前只交付 Web；桌面、移动、HarmonyOS 和实时协作必须先在
  [DEVELOP_PLAN.md](./DEVELOP_PLAN.md) 获准新任务卡后才能开始。
- 新增 host 必须复用既有领域契约、adapter、revision、asset 与命令接入口，不得分叉 Markdown 或业务语义。
- 产品边界和架构理由见
  [产品与技术方案](./docs/agents/product-and-architecture.md)；编辑器实现约束见
  [UX 与编辑器规范](./docs/agents/ux-and-editor-spec.md)。

## 移动平台约束

未来 host 工作开始前必须遵守
[移动平台约束](./docs/agents/mobile-platform.md)。

## 代码风格

TypeScript `strict`、命名、领域类型归属、设计 token、交互状态、动效和依赖审查细则见
[代码风格](./docs/agents/code-style.md)。

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
- 禁止恢复固定文件夹、知识库内分组或嵌套知识库作为 M1.1 的 Web 信息架构。
- 禁止在知识库中直接创建文档；知识库文档必须来自随记归档或导入。
- 禁止知识库文档默认进入编辑；必须预览优先并等待用户显式点击编辑。
- 禁止把全工作区正文下载到浏览器后执行客户端全文搜索。
- 禁止跳过题述的 320–2560px、键盘、触控和 reduced-motion 验收。
- 禁止在未通过 AST 往返测试时宣称“Markdown 无损”。
- 禁止把演示用 localStorage 存储直接作为生产数据层。
- 禁止在 `packages/core` 中出现平台条件分支、DOM、ArkTS、Tauri 或数据库 SDK。
- 禁止绕过 Bridge 白名单直接暴露 native 方法给网页。
- 禁止提交 `node_modules/`、构建缓存、密钥或真实用户文档。

## 专题文档

- [产品与技术方案](./docs/agents/product-and-architecture.md)
- [数据与 API](./docs/agents/data-and-api.md)
- [编辑器架构](./docs/agents/editor-architecture.md)
- [UX 与编辑器规范](./docs/agents/ux-and-editor-spec.md)
- [安全与性能](./docs/agents/security-and-performance.md)
- [代码风格](./docs/agents/code-style.md)
- [移动平台约束](./docs/agents/mobile-platform.md)
- [部署手册](./docs/agents/deployment.md)
- [架构决策记录](./docs/adr/)
- [M1.1 历史任务归档](./docs/archive/plan-2026-11-m1.md)
- [M1.1 历史验收报告](./docs/archive/m1-1-acceptance-2026-11-21.md)

项目背景见 [README.md](./README.md)，当前任务见
[DEVELOP_PLAN.md](./DEVELOP_PLAN.md)。
