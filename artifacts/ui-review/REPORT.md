# InkLoom Web UI Review

- 验收日期：2026-11-19
- 视觉版本：纸白工作台，松针绿与日光黄强调，英文品牌 InkLoom
- 技术基线：React 19、TypeScript、Vite、React Router、Tailwind CSS 4、TanStack Query、Milkdown Crepe、Radix Primitives、Lucide
- 验收环境：Windows、Google Chrome、Playwright、Vite 生产构建
- 本地地址：Web `http://127.0.0.1:4173`，API `http://127.0.0.1:3001`
- 验收范围：登录页、单区所见即所得工作区、完整格式工具栏、移动端文件栏、信息栏、文档菜单、工作区/标签/设置弹窗、Excalidraw 画布
- 生产影响：无；未使用真实用户数据，未部署或修改线上环境

## 基础视口

| 视口 | 登录页 | 工作区 | 逐图结论 |
| --- | --- | --- | --- |
| 320×720 | [auth-320x720.png](./auth-320x720.png) | [workspace-320x720.png](./workspace-320x720.png) | 登录卡片完整；工作区使用单区编辑，工具栏横向可达，无页面横向溢出 |
| 375×812 | [auth-375x812.png](./auth-375x812.png) | [workspace-375x812.png](./workspace-375x812.png) | 单列认证和干净空白编辑区稳定，完整格式工具栏可在本行横向滚动 |
| 768×1024 | [auth-768x1024.png](./auth-768x1024.png) | [workspace-768x1024.png](./workspace-768x1024.png) | 平板登录卡片居中；编辑与排版结果处于同一区域，工具栏和正文无遮挡 |
| 1024×768 | [auth-1024x768.png](./auth-1024x768.png) | [workspace-1024x768.png](./workspace-1024x768.png) | 双栏认证正常；笔记本工作区保留文件栏、单区编辑和信息抽屉 |
| 1440×960 | [auth-1440x960.png](./auth-1440x960.png) | [workspace-1440x960.png](./workspace-1440x960.png) | 左侧品牌叙事和右侧表单层级清晰；三栏工作区中文件、编辑器、信息区边界明确 |
| 2560×1440 | [auth-2560x1440.png](./auth-2560x1440.png) | [workspace-2560x1440.png](./workspace-2560x1440.png) | 超宽屏使用 18px 根字号放大控件和文字，编辑画布保持可读行长 |

## 登录与响应式状态

| 截图 | 检查项 | 逐图结论 |
| --- | --- | --- |
| [auth-320x720.png](./auth-320x720.png) | 极小屏登录、卡片内边距、按钮触控尺寸 | 表单完整，无截断；Logo 只显示英文 InkLoom |
| [auth-375x812.png](./auth-375x812.png) | 手机登录、品牌层级、错误提示空间 | 标题与表单间距舒展，底部安全说明未溢出 |
| [auth-768x1024.png](./auth-768x1024.png) | 平板单栏认证 | 卡片居中，输入框和主按钮达到稳定触控尺寸 |
| [auth-1024x768.png](./auth-1024x768.png) | 双栏认证临界点 | 品牌叙事、能力说明和登录表单同时可见 |
| [auth-1440x960.png](./auth-1440x960.png) | 桌面品牌与表单 | 深绿叙事面、反白品牌和纸白表单对比清晰 |
| [auth-2560x1440.png](./auth-2560x1440.png) | 超宽认证 | 根字号提升后卡片和品牌仍保持合理比例，无超大空白感 |

## 工作区与视图

| 截图 | 检查项 | 逐图结论 |
| --- | --- | --- |
| [workspace-320x720.png](./workspace-320x720.png) | 手机单区编辑与格式工具栏 | 空白编辑区完整，撤销、段落类型和文字格式入口可达 |
| [workspace-375x812.png](./workspace-375x812.png) | 手机工具栏横向滚动 | 工具栏保持单行，不挤压正文，不造成页面横向溢出 |
| [workspace-768x1024.png](./workspace-768x1024.png) | 平板单区编辑 | 编辑和排版结果同区呈现，工具栏、正文、页脚均无遮挡 |
| [workspace-1024x768.png](./workspace-1024x768.png) | 笔记本固定文件栏与编辑器 | 文件栏、单区编辑和信息抽屉可用，工具栏自动收敛 |
| [workspace-1440x960.png](./workspace-1440x960.png) | 桌面三栏工作区 | 文件树、编辑画布、信息栏形成连续工作流 |
| [workspace-2560x1440.png](./workspace-2560x1440.png) | 超宽屏编辑区 | 编辑区充分利用空间，正文行长仍受控；页面无横向溢出 |
| [style-controls-1440x960.png](./style-controls-1440x960.png) | H2 段落样式操作 | 段落选择器可把当前块切换为 H2，操作后立即在正文显示结果 |
| [diagram-menu-1440x960.png](./diagram-menu-1440x960.png) | 内容区图表插入菜单 | 正文工具栏加号打开分类菜单，Mermaid 与 Excalidraw 入口清晰可达 |

## 抽屉、菜单与弹窗

| 状态 | 截图 | 检查项 | 逐图结论 |
| --- | --- | --- | --- |
| 320px 文件栏 | [sidebar-320x720.png](./sidebar-320x720.png) | 遮罩、目录、搜索、底部存储入口 | 抽屉完整展开，关闭按钮和所有入口可达 |
| 375px 文件栏 | [sidebar-375x812.png](./sidebar-375x812.png) | 手机触控与长工作区名 | 搜索框和文件行没有挤压，选中态明确 |
| 768px 文件栏 | [sidebar-768x1024.png](./sidebar-768x1024.png) | 平板覆盖式抽屉 | 主区在遮罩下保持上下文，抽屉层级正确 |
| 320px 信息栏 | [inspector-320x720.png](./inspector-320x720.png) | 大纲、反链、图表资产、版本 | 内容完整，窄屏无横向溢出 |
| 375px 信息栏 | [inspector-375x812.png](./inspector-375x812.png) | 手机信息密度与关闭按钮 | 信息分区清晰，关闭后主区恢复 |
| 768px 信息栏 | [inspector-768x1024.png](./inspector-768x1024.png) | 平板覆盖式信息栏 | 信息栏覆盖主区但保留可识别背景 |
| 1024px 信息栏 | [inspector-1024x768.png](./inspector-1024x768.png) | 笔记本信息栏 | 不永久挤压编辑区，打开和关闭均稳定 |
| 320px 更多菜单 | [document-menu-320x720.png](./document-menu-320x720.png) | 移动、标签、导入导出、删除 | 菜单在视口内完整显示，危险操作有明确色彩 |
| 375px 更多菜单 | [document-menu-375x812.png](./document-menu-375x812.png) | 菜单定位和层级 | 菜单位于触发按钮下方，不遮挡关闭入口 |
| 768px 工作区弹窗 | [workspace-dialog-768x1024.png](./workspace-dialog-768x1024.png) | 当前工作区、重命名、新建 | 弹窗居中，遮罩和卡片边界清楚 |
| 768px 标签弹窗 | [tag-dialog-768x1024.png](./tag-dialog-768x1024.png) | 标签移除、添加、完成 | 标签和表单完整，主操作无截断 |
| 1024px 设置弹窗 | [settings-dialog-1024x768.png](./settings-dialog-1024x768.png) | 账号、工作区、存储、退出 | 弹窗打开状态清晰，不再出现透明过渡帧 |
| 1440px 画布 | [canvas-1440x960.png](./canvas-1440x960.png) | Excalidraw 加载、全屏工具和保存入口 | 画布引擎完成加载，工具条、缩放和保存操作可见 |

## 自动检查

```powershell
pnpm --filter '!@inkloom/desktop' typecheck
pnpm test
pnpm build
pnpm exec playwright test
```

结果：

- 非桌面 workspace typecheck 通过。
- `pnpm test` 共 32 项通过。
- Web 与 API 生产构建通过；Excalidraw 和 Mermaid 保持按需加载。
- Playwright 10 项全部通过：6 个多视口截图用例、2 条完整云端业务流、1 条 Markdown 快捷键/段落样式流程和 1 条图表插入流程。
- 每个视口均在登录、工作区、抽屉、信息栏和菜单状态执行 `scrollWidth <= clientWidth`，无页面横向溢出。
- 完整业务流覆盖注册、Milkdown 单区编辑、保存、刷新恢复、工作区创建/切换/重命名、标签、导入、移动、导出、历史恢复、退出重登、revision 冲突副本、Markdown 快捷键/段落样式和正文图表菜单插入。
- 27 张截图已逐张人工复核；抽屉关闭后等待动画结束再截图，避免捕捉中间帧。
