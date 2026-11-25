# InkLoom Code Style

本文件维护可检查的代码风格与依赖约束。仓库边界见
[产品与技术方案](./product-and-architecture.md) 和
[ADR 0004](../adr/0004-package-boundaries.md)。

## TypeScript and Naming

- `strict: true`；禁止无说明的 `any`，外部输入在边界处校验后再进入领域层。
- React 组件使用 PascalCase；hooks 使用 `useXxx`；领域文件使用 kebab-case。
- Markdown AST、文档 ID、逻辑路径和 revision 类型集中在 `packages/core`。
- 文件路径先在领域层标准化；UI 不拼接磁盘绝对路径。

## UI and CSS

- 样式 token 统一放在 `packages/ui`，页面不得重复定义品牌色和字体。
- 白色主题、字体、圆角、阴影和动效参数必须来自语义 token。
- 按钮、菜单、弹窗和骨架屏必须实现适用的 hover、focus-visible、pressed、disabled
  和 loading 状态。
- 动画优先使用 `transform` 与 `opacity`，并支持 `prefers-reduced-motion`。
- 视觉和交互验收以 [UX 与编辑器规范](./ux-and-editor-spec.md) 为准。

## Dependencies

- 新增第三方依赖前先说明体积、许可证和供应链安全影响。
- 大型编辑器、图表和画布依赖必须按需加载，不得进入 Web 首屏主 chunk。
- 依赖更新后运行生产依赖审计，并把未解决风险写入当前任务卡。
