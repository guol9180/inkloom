# @inkloom/web

InkLoom Web 应用。当前包含浏览器交互原型，后续接入云端工作区和同步 adapter。

一个用于验证“Markdown 原生知识工作台”的产品与技术原型。它覆盖浏览器本地文档、Markdown 源码/预览、Mermaid 图表和 Excalidraw 自由画布。

## 直接运行

需要 Node.js 22+。生产构建已经放在 `dist/`，不安装依赖也可以启动：

```powershell
node serve.mjs
```

打开 `http://127.0.0.1:4173`。

## 开发模式

```powershell
npm install
npm run dev
```

构建：

```powershell
npm run build
```

## 原型能力

- 新建、搜索、切换、删除文档
- Markdown 源码、分栏、阅读三种模式
- 500ms 防抖自动保存，Web 仅通过 `@inkloom/storage` 的 `BrowserLocalAdapter` 访问浏览器存储
- Mermaid fenced code block 由 `@inkloom/diagrams` 按需加载并安全渲染
- Excalidraw 由 `@inkloom/diagrams` 按需加载，场景编辑与恢复
- Markdown 文件导入、单文档导出
- Chromium 目录导入（只读原型）

## 原型边界

这个版本验证交互和图表模型，不是生产文件系统：

- 正文保存在浏览器本地 adapter，不是磁盘 `.md`
- 文件夹导入是只读，不能写回
- 没有账号、云同步和实时协作
- Excalidraw 使用简化场景，正式实现应保存完整 `.excalidraw` JSON 和 SVG 预览
- `npm audit --omit=dev` 当前报告 9 个 high、1 个 moderate、2 个 low，主要来自 Excalidraw 的 Mermaid 转换依赖链；正式产品必须做依赖升级、替换或隔离

项目说明见 [根 README](../../README.md)，架构见 [产品与技术方案](../../docs/PRODUCT_AND_ARCHITECTURE.md)，当前任务见 [DEVELOP_PLAN](../../DEVELOP_PLAN.md)。
