# M1.1 验收报告

日期：2026-11-20

## 结论

M1.1 Web 产品级编辑器与知识流已完成代码、自动化和跨视口验收，可以进入生产迁移准备。生产部署属于 T44，必须等待用户明确授权，本报告不代表已上线。

## 自动化证据

| 范围 | 结果 |
| --- | --- |
| `pnpm typecheck` | 通过 |
| `pnpm test` | 72 项通过 |
| `pnpm build` | 通过 |
| `pnpm exec playwright test` | 35 项通过 |
| FTS5 基准 | 1,000 篇文档，30 次查询 P95 小于 120ms |
| 响应式截图 | 320、375、768、1024、1440、2560 六档无横向溢出 |
| 无障碍 | 触控、键盘 `Ctrl+J`、200% 缩放、reduced-motion 通过 |

## 核心链路

- Markdown 编辑、自动保存、IndexedDB 草稿恢复、冲突副本与单编辑所有权。
- 标题、列表、任务、引用、表格、公式、提示块、折叠块、代码和 Markdown 无损往返。
- Mermaid 源码与实时预览、错误定位、全屏、懒加载和安全清洗。
- Excalidraw SVG 首屏、独立 scene/SVG 资产、2 秒快照、旧画布迁移和恢复。
- 图片/附件上传、进度、取消、重试、内容去重、替换、对齐和大图查看。
- 扁平随记、标签筛选、最近文档、删除、导出与归档。
- 扁平知识库、revision 排序、文档移回、删除库保留文档。
- 知识库预览优先、显式编辑、保存失败留编辑态和所有权只读降级。
- SQLite FTS5 中文搜索、跨随记/知识库分类、摘要高亮和无限分页。
- AST 大纲、真实反向链接、断链、资产、版本和高级属性信息栏。
- 历史版本同 NodeView 预览、块差异、安全恢复并追加新 revision。

## 截图

截图写入被忽略的 `test-results/ui-review/`，不进入版本库。

- `auth-*`、`empty-notes-*`、`editor-*`、`navigation-*`、`empty-knowledge-*`：六档视口。
- `t34-mermaid-1440x960.png`、`t34-mermaid-320x720.png`：Mermaid 编辑与移动端。
- `t35-canvas-1440x960.png`、`t35-canvas-320x720.png`：画布卡片与移动端。
- `t39-search-1440x960.png`：跨随记/知识库搜索结果。
- `t40-context-1440x960.png`：大纲、反链、断链和信息栏。
- `t41-history-1440x960.png`：历史版本预览。

## 未解决风险

1. 生产构建仍有大于 1.4MB 的 chunk 警告。Mermaid、Excalidraw 和编辑器能力已按需拆包，但富文本编辑器及 Excalidraw 依赖体积仍较大。
2. 当前自动化浏览器为 Windows Chrome。Firefox、Safari 和真实移动设备尚未进入发布门禁。
3. `node:sqlite` 仍标记为 Node.js experimental API。发布前需要确认生产 Node 版本与 SQLite/FTS5 编译能力。
4. 1,000 篇 P95 基准使用内存 SQLite 和固定数据集，生产磁盘卷性能需在发布后观测。
5. 搜索的中文策略采用单字与相邻二元组，不包含词典分词或语义搜索。
6. 白色单主题是用户明确要求，本版本不提供暗色模式。
7. 桌面 Tauri、M2 同步、实时协作与移动原生端仍暂停，不在 M1.1 发布范围。

## 回滚准备

T44 发布前必须备份并校验生产 SQLite 与资产卷，记录当前 release SHA。任何 schema migration 失败都应停止 API 容器更新并保留旧 release 容器与数据备份。
