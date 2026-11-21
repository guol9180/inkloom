# InkLoom UX and Editor Specification

版本：1.0  
日期：2026-11-19  
状态：M1.1 implementation baseline

本文是 Web 端产品交互、编辑器行为、视觉系统和响应式体验的单一事实源。高层产品模型、数据架构和平台边界见
[PRODUCT_AND_ARCHITECTURE.md](./PRODUCT_AND_ARCHITECTURE.md)，任务状态与验收见
[DEVELOP_PLAN.md](../DEVELOP_PLAN.md)，工程约束见 [AGENTS.md](../AGENTS.md)。

## 1. Scope

M1.1 只实现 Web 端，但所有领域契约、存储接口和编辑器命令必须为后续桌面端、移动端和同步能力保留接入点。

本文覆盖：

- 工作区、随记和知识库的信息架构。
- 应用壳、路由、顶部栏、侧栏和文档信息栏。
- Milkdown / ProseMirror 编辑器外壳。
- Markdown 块、图表、图片、附件和画布。
- 保存、草稿、历史、冲突和恢复。
- 登录、注册、加载、空状态和错误反馈。
- 白色主题、字体、动效和响应式布局。

本文不覆盖：

- 桌面或移动客户端实现。
- M2 跨设备离线队列与双向同步。
- M3 实时协作、评论和团队权限。
- 第三方 Figma、ProcessOn、视频和音乐嵌入。

## 2. Experience Direction

视觉关键词：

> 白色、轻盈、圆润、安静、精确、可触摸。

体验原则：

1. 随记用于快速写，知识库用于稳定读。
2. 随记默认编辑，知识库文档默认预览。
3. 界面层级依靠留白、边框、字重和轻背景，不依靠大面积彩色卡片。
4. 所有交互反馈平滑、克制，不制造布局跳动。
5. Markdown 是正文事实源，未知语法不能静默丢失。
6. 图表、图片和附件是独立资产，不进入 Markdown 正文 JSON。
7. 复杂内容在自身容器内滚动，页面整体不横向溢出。
8. UI 文字借鉴 Codex 客户端的精确和克制，正文保持长文阅读舒适度。

## 3. Information Architecture

### 3.1 Workspace

工作区是隔离随记、知识库、标签、资产和历史的顶层容器。

- 一个账号可有多个工作区。
- 顶部栏不显示当前工作区名称，只显示 Logo 和独立的向下箭头按钮。
- 点击箭头打开工作区选择菜单。
- 每个工作区记住上次使用的模式、展开状态和界面偏好。
- 左下角“工作区设置”打开设置弹窗，不触发新建知识库；可重命名当前工作区，并调整文档搜索快捷键、新文档信息栏默认状态和正文阅读字号。
- 搜索快捷键、信息栏默认状态和阅读字号保存在当前浏览器，按工作区隔离；刷新后仍保持。
- 切换工作区前先保存当前文档；保存失败则留在原工作区。
- 工作区删除必须显示高风险确认，优先进入短期回收状态。

### 3.2 Scratch Notes

随记是未归档 Markdown 文档的扁平列表。

- 不展示固定文件夹。
- 不提供单独“新建随记”按钮。
- 所有新建入口统一进入搜索框右侧的 `+` 菜单。
- 随记打开后直接进入编辑状态。
- 支持标签筛选、最近文档、导出、删除和归档。
- 列表按最近更新时间或创建时间排序，可按今天、昨天和更早分组。

### 3.3 Knowledge Bases

知识库是用户直接创建的顶层分类容器，不是分组。

- 知识库内部完全平铺，不提供文件夹、分组或嵌套知识库。
- 一篇知识库文档只属于一个知识库。
- 知识库内容来自随记归档或 Markdown 导入。
- 不在知识库中直接新建文档。
- 知识库可以重命名、排序、归档随记、导出和删除。
- 删除知识库时，其中文档默认全部移回随记，不删除正文。

### 3.4 Document Lifecycle

```text
Scratch note
  -> archive to one knowledge base
Knowledge-base document (preview by default)
  -> explicit Edit
Knowledge-base document editing
  -> Done
Knowledge-base document (preview)

Knowledge-base document
  -> return to scratch
Scratch note (editing)
```

归档与移回保留：

- Document ID.
- Markdown 正文。
- 标签。
- 创建和更新时间。
- Revision。
- 历史版本。
- 图表、图片和附件引用。

## 4. Routes

```text
/login
/register
/
/workspaces/:workspaceId
/workspaces/:workspaceId/notes/:documentId
/workspaces/:workspaceId/knowledge/:knowledgeBaseId
/workspaces/:workspaceId/knowledge/:knowledgeBaseId/documents/:documentId
```

- 后台 URL 使用 React Router。
- 受保护路由先验证会话。
- `next` 只接受站内相对路径。
- 已登录用户访问登录或注册页时跳回上次工作区。

## 5. Authentication

### 5.1 Layout

- 登录和注册内容居中放在约 `400–440px` 宽的白色面板中。
- 页面背景使用雾白 `#F7F9F8`。
- 不使用铺满全屏的双栏营销页、大插画或大面积渐变。
- 品牌只显示 Lucide 图标和英文 `InkLoom`。
- 桌面居中，移动端保留约 `16px` 安全边距。
- 面板使用 `18px` 圆角、细边框和非常轻的阴影。

### 5.2 Login

字段：

- 邮箱。
- 密码。
- 显示/隐藏密码。

行为：

- 使用标准表单、浏览器密码管理器和 `autocomplete`。
- Enter 提交。
- 提交中按钮显示“正在登录…”。
- 登录错误不泄露邮箱是否注册。
- 第一版不显示无效的“忘记密码”入口。

### 5.3 Registration

字段：

- 可选显示名称，最多 40 字符。
- 邮箱。
- 至少 8 字符的密码。
- 确认密码，仅客户端校验。

成功后：

- 建立 HttpOnly 会话。
- 创建默认工作区。
- 进入随记空状态。
- 不自动创建文档、欢迎稿或示例知识库。

### 5.4 Session States

- 有效会话进入上次工作区。
- 无会话跳转登录，并保存安全的 `next`。
- 会话过期时保留 IndexedDB 草稿，提示“登录已失效，草稿已保留”。
- 退出登录先保存；保存失败时允许“保留草稿并退出”。
- Session token 不进入 localStorage 或 JavaScript 可读状态。

## 6. Application Shell

### 6.1 Top Bar

```text
Menu  InkLoom  chevron          Save status   Help   Account
```

- 高度约 `52–58px`。
- 白或近白背景，底部 `1px` 浅灰绿色边框。
- Logo 右侧只显示向下箭头，不显示工作区名称。
- 保存状态靠右，保持安静。
- 中等屏幕减少文字，手机端保存状态缩为状态点。
- 不用顶部栏重复文档标题。

### 6.2 Responsive Structure

| 范围 | 模式 | 左侧栏 | 文档信息栏 |
| --- | --- | --- | --- |
| `<640px` | 手机单栏 | 抽屉 | 抽屉 |
| `640–1023px` | 平板单栏 | 抽屉 | 抽屉 |
| `1024–1439px` | 桌面双栏 | 常驻 | 抽屉 |
| `>=1440px` | 宽屏三栏 | 常驻 | 默认展开 |

- 根容器使用 `100dvh` 和安全区域。
- 不同区域独立滚动。
- 打开文件栏时关闭信息栏，反之亦然。
- 文档内容区铺满侧栏与信息栏之间的全部可用宽度，不设置居中固定最大宽度。
- 文档信息栏展开和收起使用宽度、位移与透明度组合过渡；桌面端不制造未解释的空白列。
- 信息栏关闭后从布局和无障碍树中退出，内部元素不可聚焦。
- 抽屉关闭后焦点回到触发按钮。
- 组件内部优先使用容器查询。

### 6.3 Empty Workspace State

未选中文档时，内容区按当前模式显示快捷创建：

- 随记无文档：主按钮“新建一篇随记”，次级“导入 Markdown”。
- 未选择知识库：主按钮“新建知识库”。
- 知识库为空：主按钮“从随记归档”，次级“返回随记”。

空状态不使用欢迎营销页，不自动创建幽灵文档。

## 7. Left Navigation

左侧栏只有两个模式：

```text
[ Scratch ] [ Knowledge ]

Search documents                    +
```

### 7.1 Unified Create Menu

搜索框右侧的 `+` 集成：

- 新建随记。
- 新建知识库。
- 导入 Markdown。
- 导入文件夹。

当前模式对应的主要操作排在前面。随记和知识库都不再提供额外重复的新建按钮。

### 7.2 Scratch View

- 文档平铺，按今天、昨天和更早分组。
- 显示标题、两行摘要、最多三个标签和更新时间。
- 标签可筛选。
- 每行提供独立操作按钮：桌面 hover/focus 显示，触控设备常显。
- 随记行菜单包含重命名、归档到知识库和删除文档。

### 7.3 Knowledge View

- 显示知识库列表、名称和文档数量。
- 点击知识库显示其扁平文档列表。
- 文档无嵌套。
- 知识库文档行菜单包含重命名和删除。
- 知识库内部允许按更新时间、创建时间或标题排序。

### 7.4 Archive Flow

1. 先保存当前随记。
2. 打开知识库选择弹窗。
3. 选择知识库或当场新建知识库。
4. 点击“归档”；该弹窗即最终确认，不增加第二次确认。
5. 切换知识库视图，并以只读预览打开。
6. 显示约 6 秒“撤销”操作。

保存失败时停止归档，文档仍留在随记，草稿保留在本机。

### 7.5 Knowledge Base Deletion

- 显示文档数量。
- 所有文档移回随记。
- 删除空知识库。
- 不删除 Markdown、资产或历史。

### 7.6 Search

- 使用服务端全文搜索。
- 范围：标题、正文、标签、路径和文件名。
- `Ctrl+J` / `Cmd+J` 聚焦。
- 输入约 200ms 后请求。
- 结果按随记和知识库分组。
- 显示命中摘要并高亮命中词。
- 随记结果打开编辑；知识库结果打开预览。
- 清空搜索恢复之前的视图、展开状态和滚动位置。

### 7.7 File Text and Keyboard

- 文档标题一行省略，摘要两行。
- `F2` 行内重命名。
- 方向键在条目间导航，Enter 打开。
- Delete 打开确认，不直接删除。
- 触控目标至少 `36px`，手机至少 `44px`。

## 8. Editor Architecture

保留 Milkdown / ProseMirror 作为内核，不在其上继续拼接 Crepe 默认 UI。

```text
Milkdown / ProseMirror
  document schema, selection, undo, input, serialization

Editor Command Registry
  toolbar, slash menu, keyboard shortcuts, block actions

Editor Shell
  fixed toolbar, slash menu, block handle, contextual tools

Custom NodeViews
  Mermaid, Excalidraw, table, image, file, code and extended blocks

Asset Layer
  content-addressed image, attachment, scene and SVG storage
```

### 8.1 Fixed Toolbar

工具栏固定在编辑区顶部，不随正文滚动。

默认分组：

- 撤销、重做、清除格式。
- 正文、H1–H6、字号。
- 加粗、斜体、下划线、删除线、行内代码。
- 文字颜色、背景高亮。
- 对齐、无序列表、有序列表、任务列表、缩进、行高。
- 插入菜单、链接、引用、分割线。
- 查找和更多。

- 工具栏始终保持单行。
- 空间不足时横向滚动，不折成多排。
- 光标位于表格、代码或其他块时，工具栏切换为块上下文工具。
- 所有按钮具有明确键盘焦点、Tooltip 和快捷键提示。

### 8.2 Slash Menu

- 在空段落或段落开头输入 `/` 打开。
- URL、路径、代码块和图表源码中的 `/` 不触发。
- 支持实时筛选、最近使用和键盘导航。
- Esc 关闭并删除孤立的 `/` 或查询文字。
- 工具栏 `+` 打开同一菜单。

分组：

- 基础：图片、表格、附件、代码块、公式、引用、分割线。
- 图表：Mermaid、Excalidraw、思维导图、流程图占位能力。
- 布局：高亮块、折叠块、分栏（暂缓）、目录、文档链接。
- 工具：提及文档、日期、文档属性、反向链接。

搜索支持中文名称、英文关键词、拼音首字母和斜杠指令。

### 8.3 Block Handle

每行最左侧只显示一个 `⠿`：

- 悬停或块获得焦点时出现。
- 按住拖动调整块顺序。
- 单击打开块菜单。
- 工具栏 `+` 或斜杠菜单用于插入，不在行首显示 `+`。
- `Alt+F10` / `Option+F10` 打开块菜单。

块菜单：

- “转化为”二级菜单：正文、H1–H6 和提示块类型。
- 下方“图表类型”二级菜单：Mermaid 图表和 Excalidraw 画布。
- 空白初始文档不显示块操作手柄；正文占位符与左右内容边距对称，且始终位于粘性工具栏下方。
- 复制块或 Markdown。
- 上移、下移和创建副本。
- 折叠或删除。
- 新文档或切换文档后编辑区从顶部显示，首个内容块不得被粘性工具栏遮挡。
- 短内容只填满当前剩余视口，不制造额外可滚动高度；长内容才进入自然滚动。

### 8.4 Selection Toolbar

桌面端选中文字后显示轻量悬浮工具条：

- 加粗、斜体、下划线、删除线。
- 行内代码、链接。
- 文字颜色、背景高亮。

- 约 120ms 后出现。
- 不遮挡选区和块手柄。
- 移动端使用系统选择菜单和固定工具栏，不显示悬浮条。

### 8.5 Shortcuts

| 操作 | Windows/Linux | macOS |
| --- | --- | --- |
| Search | `Ctrl+J` | `Cmd+J` |
| Save | `Ctrl+S` | `Cmd+S` |
| Undo / Redo | `Ctrl+Z` / `Ctrl+Y` | `Cmd+Z` / `Cmd+Shift+Z` |
| Bold | `Ctrl+B` | `Cmd+B` |
| Italic | `Ctrl+I` | `Cmd+I` |
| Underline | `Ctrl+U` | `Cmd+U` |
| Strikethrough | `Ctrl+Shift+X` | `Cmd+Shift+X` |
| Link | `Ctrl+K` | `Cmd+K` |
| Inline code | `Ctrl+E` | `Cmd+E` |
| Paragraph / H1-H6 | `Ctrl+Alt+0-6` | `Cmd+Option+0-6` |
| Bullet / Ordered / Task | `Ctrl+Shift+8/7/9` | `Cmd+Shift+8/7/9` |
| Move block | `Alt+Up/Down` | `Option+Up/Down` |
| Block menu | `Alt+F10` | `Option+F10` |
| Toggle preview/edit | `Ctrl+Shift+E` | `Cmd+Shift+E` |

## 9. Markdown Fidelity

### 9.1 Hybrid Source Model

```text
Source Markdown
  -> mdast with source positions
  -> ProseMirror document
  -> edited blocks serialized canonically
  -> untouched and unknown blocks preserve original source slices
```

核心规则：

- 打开后不修改直接保存，正文语义等价。
- 只重建实际编辑的块。
- 未知 Markdown、未知 HTML、frontmatter、HTML 注释、链接定义和脚注定义保留原文。
- 无法安全转换的语法成为只读 raw node，不删除。
- 保存 CRLF 输入时统一为 LF，之后不重复改写。
- 安全净化只影响渲染，不修改数据库中的原始 Markdown。

### 9.2 Standard Mappings

| Block | Markdown |
| --- | --- |
| Paragraph | plain Markdown |
| Heading | `#` through `######` |
| Bold / Italic / Strike | `**`, `*`, `~~` |
| Inline code | backticks |
| Lists | GFM lists |
| Task | `- [ ]` / `- [x]` |
| Quote | `>` |
| Divider | `---` |
| Link | `[text](url)` |
| Code | fenced code block |
| Table | GFM table |
| Image | `![alt](assets/hash.ext)` |
| Mermaid | fenced `mermaid` block |
| Formula | standard inline/block LaTeX |
| Underline | `<u>text</u>` |
| Text style | `<span data-inkloom-color="...">` |
| Highlight | `<span data-inkloom-highlight="...">` |
| Callout | GitHub alert `[!NOTE]` and variants |
| Toggle | native `<details><summary>` |

### 9.3 Extended Blocks

Mermaid remains a plain fenced block.

Excalidraw uses a portable commented block:

```md
<!-- inkloom:canvas
id: canvas_01JABC
title: 系统边界
scene: assets/hash.excalidraw
preview: assets/hash.svg
-->
![系统边界](assets/hash.svg)
<!-- /inkloom:canvas -->
```

Attachments use:

```md
<!-- inkloom:file
id: file_01JABC
mime: application/pdf
size: 2481920
-->
[产品架构.pdf](assets/hash.pdf)
<!-- /inkloom:file -->
```

- 大型 JSON 不进入正文。
- 预览图和场景文件分开保存。
- 缺少资产时保留引用并显示错误，不静默删除。

### 9.4 Golden Corpus

自动化测试至少覆盖：

- H1–H6 and Chinese punctuation.
- Bold, italic, strike, underline, inline code.
- Links with titles and autolinks.
- Images, lists, nested lists and tasks.
- Quotes and tables.
- Known and unknown code fences.
- Mermaid, formulas, footnotes and link definitions.
- HTML comments, `<details>` and unknown HTML.
- InkLoom canvas and file blocks.
- Frontmatter and unknown fields.
- Escapes, hard/soft breaks, consecutive blank lines.
- CRLF and missing final newline.

只有 golden corpus、API round-trip、历史恢复和刷新恢复全部通过，才能声明 Markdown 无损。

## 10. Block Behavior

### 10.1 Tables

- Insert a blank 3x3 GFM table with a header row.
- Use GFM alignment delimiters.
- Tab and Shift+Tab move cells.
- Tab in the last cell adds a row.
- Enter inserts a line break in the cell.
- Ctrl/Cmd+Enter exits after the table.
- Context toolbar supports row/column add/remove, alignment and header toggles.
- Paste TSV/HTML tables from spreadsheets and auto-expand.
- Long tables scroll inside their container.
- First version does not support merged cells, cell colors or nested blocks.

### 10.2 Code

- Light near-white code surface.
- CodeMirror 6 only inside code blocks and diagram source.
- Language selector, line numbers, copy, wrap, fullscreen.
- Unknown language info strings remain intact.
- Tab indents, Shift+Tab outdents.
- Code is highlighted, never executed.

### 10.3 Quote, Divider, Callout and Toggle

Quote:

- Direct inline editing.
- Double Enter exits.
- Backspace on first empty line removes quote semantics.
- No nested quote authoring in V1; source is preserved.

Divider:

- Standalone selectable block.
- Short centered hairline.
- Barely visible row handle on hover.

Callout:

- NOTE, TIP, IMPORTANT, WARNING, CAUTION.
- Uses GitHub alert syntax.
- Supports paragraphs, lists, quotes and inline formatting.
- V1 excludes nested tables, code, Mermaid and toggles.

Toggle:

- Uses native `<details>` and `<summary>`.
- Summary is single-line text.
- Body supports standard blocks.
- Expanded state uses `open` attribute.
- A toggle cannot contain another toggle.

### 10.4 Mermaid

- Insert an independent Mermaid block from the toolbar, slash menu or current block action menu.
- Desktop split view: CodeMirror source and live SVG preview.
- Render after about 300ms idle.
- Syntax error keeps source and shows line error.
- Supports templates, fit width, fullscreen and copy.
- Uses `securityLevel: strict`, unique render IDs and lazy chunk loading.
- Saves only the standard `mermaid` fenced source in Markdown.
- Mobile stacks source and preview vertically and supports block fullscreen.

### 10.5 Excalidraw

- Document displays an SVG preview card.
- Insert from the toolbar, slash menu or current block action menu.
- Full editor opens in a block-level fullscreen surface.
- Scene, SVG and preview metadata are separate assets.
- Excalidraw bundle is loaded only when editing.
- Temporary scene snapshots are written locally every 2 seconds.
- Formal save generates new asset hashes and document revision.
- Conflicts preserve the local scene as a separate asset.

## 11. Assets

### 11.1 Images

- Insert by slash menu, toolbar, clipboard paste or drag/drop.
- Show upload progress, cancel and retry.
- Use SHA-256 content addressing and deduplication.
- Standard Markdown image links.
- Support alignment, width, alt, caption, lightbox, replace and download.
- Inline SVG must be sanitized.

### 11.2 Attachments

- Stream binary uploads; do not Base64 encode into JSON.
- Workspace isolation and MIME/header/size checks.
- Safe files may preview; unsafe files download only.
- Store display name, MIME, size and referenced asset hash.
- Export ZIP includes Markdown, images, attachments, canvas scenes and SVG previews.

### 11.3 Asset API

```text
POST /api/workspaces/:workspaceId/assets
GET  /api/workspaces/:workspaceId/assets/:hash
GET  /api/workspaces/:workspaceId/assets/:hash/info
```

- Upload raw binary with metadata headers.
- Return `202` for accepted large uploads if asynchronous processing is required.
- Content-addressed assets are immutable.
- Unreferenced assets are cleaned only after reference checks.

## 12. Save, History and Conflict

### 12.1 Facts and Drafts

- Server SQLite Markdown is the canonical cloud source.
- IndexedDB stores unsaved document drafts and temporary canvas scenes.
- localStorage only stores active IDs and UI preferences.
- Drafts are scoped by user and workspace.

### 12.2 Autosave

```text
content change
  -> IndexedDB draft
  -> 800ms quiet period
  -> wait for referenced asset uploads
  -> PUT document with baseRevision
  -> update revision and clear draft
```

- Only one save request runs per document.
- Newer edits coalesce into the latest snapshot.
- Content-hash equality skips network writes.
- Switching document or workspace flushes pending saves.
- Ctrl/Cmd+S saves and creates an explicit checkpoint.

### 12.3 Status

Visible states:

- `待保存`
- `正在上传附件`
- `保存中…`
- `已保存 · HH:mm`
- `保存失败 · 重试`
- `已保存到本机 · 待联网`
- `发现版本冲突`
- `登录已失效`

Routine autosave success does not show a toast.

### 12.4 Revisions

- Successful writes increment the document revision.
- History checkpoint after about 2s idle.
- At most one checkpoint every 30s during continuous editing.
- Manual save, title changes, diagram replacement and restore create checkpoints.
- Retain 30 days or 200 checkpoints by default.
- Deduplicate by content hash.
- Document row and history insertion happen in one transaction.

### 12.5 Conflicts

On `REVISION_CONFLICT`:

1. Keep the IndexedDB draft.
2. Create a cloud conflict copy such as `标题（本地冲突副本 YYYY-MM-DD HH-mm）.md`.
3. Reload the latest server version.
4. Offer view local copy, overwrite after explicit confirmation, or download.
5. If copy creation fails, keep draft and allow retry.

Multi-tab editing uses `BroadcastChannel`; only one tab owns editing at a time.

## 13. Knowledge-Base Reading Mode

Knowledge-base documents open in read-only preview by default.

Preview:

- H1 is the document title.
- Knowledge base and path metadata appear subtly.
- Toolbar, slash menu and block handles are hidden.
- Text can be selected and copied.
- Links, outline, images, Mermaid, Excalidraw and attachments remain interactive.
- External links open in a new tab.
- Images and charts support fullscreen/lightbox.
- Preview and edit use the same node renderer and typography.

Entering edit:

- Click `Edit` or press `Ctrl/Cmd+Shift+E`.
- Do not remount the document or reload content.
- Keep reading width, scroll position and block styles stable.
- Reveal toolbar, handles and selection toolbar.
- Change button to `Done`.

Exiting edit:

- Save first.
- Return to preview only after success.
- Preserve scroll position.
- Report save failures without pretending completion.

## 14. Version History

- Opens in a right drawer; mobile uses a full screen sheet.
- Group entries by date.
- Show automatic, manual, title, diagram, restore, import and conflict checkpoints.
- Compare selected version with current document.
- Default to block-level diff; full Markdown diff is optional.
- Preview is read-only and uses the same renderer.
- Restoring turns old content into a new revision.
- Restoring also restores title, tags and block content.
- Missing assets show placeholders and never delete references.

## 15. Document Inspector

Sections:

1. Overview: title, path, word count, updated time, revision state.
2. Outline: H1–H6 and current heading.
3. Backlinks: real parsed links, context snippets and broken links.
4. Assets: Mermaid, Excalidraw, images and attachments.
5. Tags.
6. Recent versions.
7. Advanced properties.

- Outline is derived from the ProseMirror AST and uses stable node positions.
- Backlinks come from a server-side link index, not string matching.
- Asset missing states do not remove Markdown.
- Section failures do not block the editor.

## 16. Visual System

### 16.1 Color Tokens

```css
--color-canvas: #f7f9f8;
--color-surface: #ffffff;
--color-surface-subtle: #fcfdfc;
--color-surface-muted: #f1f5f3;
--color-border: #e4ebe6;
--color-border-strong: #d2ded7;
--color-text: #17231d;
--color-text-secondary: #5f6d65;
--color-text-muted: #8b9891;
--color-brand: #2f7d5d;
--color-brand-hover: #286d51;
--color-brand-soft: #eaf6ef;
--color-brand-selected: #dff2e7;
--color-danger: #c65353;
--color-warning: #b7791f;
--color-info: #5a7fa6;
```

Pine green is an accent only. No large green background panels.

### 16.2 Typography

```css
--font-ui:
  "Geist Sans", -apple-system, BlinkMacSystemFont,
  "PingFang SC", "Hiragino Sans GB",
  "HarmonyOS Sans SC", "Microsoft YaHei",
  "Noto Sans CJK SC", sans-serif;

--font-code:
  "Geist Mono", "SFMono-Regular", Consolas,
  "Liberation Mono", monospace;
```

- Geist Sans and Geist Mono are self-hosted WOFF2 assets.
- Chinese uses system fonts for performance and complete coverage.
- Body `16–17px`, line-height `1.78`.
- H1 `28–30px`, H2 `22–24px`, H3 `18–20px`.
- UI `13–14px`, buttons `13px / 500`.
- Inputs remain at least `16px` on mobile.
- Use tabular numbers for time, counts and revisions.
- Do not animate font weight.
- Avoid negative tracking on Chinese text.

### 16.3 Radius and Elevation

- Control radius `10px`.
- Menu/popover radius `12px`.
- Panel radius `14px`.
- Login/modal radius `18px`.
- Cards and media `12–16px`.
- Use `xs`, `sm`, `popover` and `modal` shadows only.
- The white theme establishes hierarchy with borders and whitespace, not saturated surfaces.

### 16.4 Motion

- Color and background: `120ms`.
- Button hover/press: `140–160ms`.
- Menu: `160–180ms`.
- Dialog/drawer: `200–240ms`.
- Main easing: `cubic-bezier(0.22, 1, 0.36, 1)`.
- Animate primarily `transform` and `opacity`.
- Buttons may press to `scale(0.98)`.
- Menus use only `2–4px` displacement.
- No bouncing, large zooms or per-item entrance sequences.
- Respect `prefers-reduced-motion`.

## 17. Loading, Empty and Error States

- Every content area uses skeleton screens after a 150ms delay.
- Skeletons mirror final layout and preserve dimensions.
- Skeleton base `#EDF3F0`; highlight `#F8FBF9`; sweep about 1.6s.
- Reduced motion disables the sweep.
- Buttons keep readable text instead of becoming skeletons.
- Network offline shows a compact status bar below the top bar.
- Local drafts remain available while offline.
- Errors stay inside the affected region whenever possible.
- 404, 403, unavailable, missing workspace and document errors retain the application shell.
- Loading longer than 8s adds an inline retry action without replacing the skeleton layout.

## 18. Dialogs, Menus and Feedback

- Task dialogs are `380–440px`; medium dialogs `480–560px`; large dialogs up to `960px`.
- Mobile dialogs become bottom sheets.
- Primary action is on the right; cancel on the left.
- Use specific button labels such as “Create knowledge base” and “Delete document”.
- Destructive actions require action-time confirmation.
- Archiving uses the knowledge-base picker as its only confirmation.
- Typing the workspace name is required for workspace deletion.
- Menus support keyboard navigation, flip positioning and internal scrolling.
- Toasts are used for archive, move, export, restore and upload results.
- Routine autosave never produces a toast.
- Field errors stay inline; section failures expose a local retry.

## 19. Accessibility

- Visible keyboard focus on every interactive element.
- Forms use labels, autocomplete and `role="alert"` errors.
- Icon-only buttons have accessible names.
- Drawers and dialogs manage focus and return it on close.
- At 200% browser zoom, no page-level horizontal scroll.
- Text selection and copy remain enabled in preview.
- Tables and trees have semantic roles and keyboard navigation.
- Reduced motion is fully supported.
- Color is never the only signal for state or error.

## 20. Responsive Acceptance

Required viewports:

```text
320x720
375x812
768x1024
1024x768
1440x960
2560x1440
```

Each viewport must verify:

- No page-level horizontal overflow.
- Sidebars are reachable and mutually exclusive when overlayed.
- Toolbars remain usable in one row.
- Tables, code and diagrams scroll internally.
- Dialogs do not exceed the viewport.
- Reading and editing layouts keep text readable.
- Mobile safe areas and keyboard insets are respected.
- Skeleton, empty, error and offline states do not shift the shell.
- Motion is smooth and reduced-motion behavior works.
- Primary actions remain reachable.

## 21. Visual Quality Gate

UI work is not complete unless:

- Every button has default, hover, active, focus, disabled and loading behavior.
- Text truncation, wrapping and 200% zoom are checked.
- No layout shift occurs when entering edit mode.
- No drawer closes with stale focus or background scroll lock.
- No animation visibly jumps or reflows layout.
- Fonts, icons, radii and shadows use shared tokens.
- Six-viewport screenshots are recorded and reviewed.
- Automated tests and manual screenshot reports are linked from DEVELOP_PLAN.
