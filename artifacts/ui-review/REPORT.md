# InkLoom Web UI Review

- 验收日期：2026-11-19
- 验收环境：Windows、Google Chrome、Playwright、Vite 生产构建
- 本地地址：Web `http://127.0.0.1:4173`，API `http://127.0.0.1:3001`
- 验收范围：登录页、云端工作区、三种编辑视图、移动端侧栏、信息栏、文档操作菜单、工作区/标签/设置弹窗、Excalidraw 画布
- 生产影响：无；未使用真实用户数据，未部署或修改线上环境

## 基础视口

| 视口 | 登录页 | 工作区 | 结论 |
| --- | --- | --- | --- |
| 320×720 | [auth-320x720.png](./auth-320x720.png) | [workspace-320x720.png](./workspace-320x720.png) | 登录卡片完整；编辑区无可操作控件被裁切；无横向页面溢出 |
| 375×812 | [auth-375x812.png](./auth-375x812.png) | [workspace-375x812.png](./workspace-375x812.png) | 单列写作布局稳定；工具栏收敛为图标；无横向页面溢出 |
| 768×1024 | [auth-768x1024.png](./auth-768x1024.png) | [workspace-768x1024.png](./workspace-768x1024.png) | 平板布局可写作、分栏阅读并打开抽屉；无横向页面溢出 |
| 1024×768 | [auth-1024x768.png](./auth-1024x768.png) | [workspace-1024x768.png](./workspace-1024x768.png) | 双栏认证和笔记本工作区正常；信息栏以覆盖层打开；无横向页面溢出 |
| 1440×960 | [auth-1440x960.png](./auth-1440x960.png) | [workspace-1440x960.png](./workspace-1440x960.png) | 三栏桌面布局完整；编辑、预览和信息栏同时可见；无横向页面溢出 |
| 2560×1440 | [auth-2560x1440.png](./auth-2560x1440.png) | [workspace-2560x1440.png](./workspace-2560x1440.png) | 超宽屏稿纸保持可读行长并撑满主区；无横向页面溢出 |

## 交互状态

| 状态 | 截图 | 检查项 | 结论 |
| --- | --- | --- | --- |
| 320px 文件栏 | [sidebar-320x720.png](./sidebar-320x720.png) | 遮罩、搜索、目录、存储信息、设置入口 | 抽屉完整展开，背景可见但不可误操作 |
| 375px 文件栏 | [sidebar-375x812.png](./sidebar-375x812.png) | 触控尺寸、长工作区名、底部入口 | 抽屉动画完成后完整显示，关键入口可达 |
| 768px 文件栏 | [sidebar-768x1024.png](./sidebar-768x1024.png) | 平板抽屉与主区遮罩 | 抽屉和遮罩层级正确，主区无布局跳动 |
| 320px 信息栏 | [inspector-320x720.png](./inspector-320x720.png) | 大纲、反链、图表资产、版本历史 | 抽屉占满可用宽度，关闭按钮可达 |
| 375px 信息栏 | [inspector-375x812.png](./inspector-375x812.png) | 移动端信息密度与遮罩 | 内容完整，编辑器在遮罩下保持上下文 |
| 768px 信息栏 | [inspector-768x1024.png](./inspector-768x1024.png) | 平板覆盖式信息栏 | 表格单行标题和版本状态清晰 |
| 1024px 信息栏 | [inspector-1024x768.png](./inspector-1024x768.png) | 笔记本覆盖式信息栏 | 不挤压编辑区，关闭后栅格正确回收 |
| 320px 更多菜单 | [document-menu-320x720.png](./document-menu-320x720.png) | 移动/重命名、标签、导入导出、删除 | 菜单不透明、层级正确，全部操作可达 |
| 375px 更多菜单 | [document-menu-375x812.png](./document-menu-375x812.png) | 菜单定位与内容遮挡 | 菜单位于文档操作栏下方，不遮挡触发按钮 |
| 768px 工作区弹窗 | [workspace-dialog-768x1024.png](./workspace-dialog-768x1024.png) | 当前工作区、重命名、新建 | 弹窗居中，按钮和说明完整 |
| 768px 标签弹窗 | [tag-dialog-768x1024.png](./tag-dialog-768x1024.png) | 标签列表、移除、添加 | 表单和标签操作完整，无溢出 |
| 1024px 设置弹窗 | [settings-dialog-1024x768.png](./settings-dialog-1024x768.png) | 账号、工作区、存储、退出 | 分层清晰，长邮箱不撑破卡片 |
| 1440px 阅读模式 | [read-mode-1440x960.png](./read-mode-1440x960.png) | 单栏预览、信息栏并存 | 阅读行长和层级正常 |
| 1440px 画布 | [canvas-1440x960.png](./canvas-1440x960.png) | Excalidraw 加载、全屏工具与保存入口 | 引擎加载完成后截图，画布工具完整可用 |

## 自动检查

```powershell
pnpm --filter @inkloom/web typecheck
pnpm --filter @inkloom/web build
pnpm exec playwright test tests/e2e/ui-review.spec.ts
```

结果：

- Web typecheck 通过。
- Web 生产构建通过，仅保留既有的大图表 chunk 警告。
- 6 个视口测试全部通过。
- 每个视口在登录页、工作区、抽屉和菜单关键状态执行 `scrollWidth <= clientWidth` 检查，均无页面横向溢出。
- 首轮截图发现的 320px 登录页裁切、超宽桌面稿纸未撑满、手机工具栏文字挤排、抽屉动画中途截图和菜单层级问题均已修正并重新截图。
- 最终 `pnpm test:e2e` 共 8 项通过：6 项多视口截图 + 2 项完整业务流。
- 最终 `pnpm test` 共 32 项通过。
