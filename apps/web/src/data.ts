export type CanvasScene = {
  title: string;
  elements: readonly Record<string, unknown>[];
};

export type Note = {
  id: string;
  title: string;
  folder: string;
  filePath: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  content: string;
  canvas?: CanvasScene;
};

export const folderOrder = ["产品", "架构", "研究", "个人"];

const systemMapElements = [
  {
    id: "frame-browser",
    type: "rectangle",
    x: 80,
    y: 90,
    width: 190,
    height: 118,
    strokeColor: "#244d4a",
    backgroundColor: "#e9f0ee",
    strokeWidth: 2,
    roughness: 1
  },
  {
    id: "frame-desktop",
    type: "rectangle",
    x: 410,
    y: 90,
    width: 190,
    height: 118,
    strokeColor: "#244d4a",
    backgroundColor: "#e9f0ee",
    strokeWidth: 2,
    roughness: 1
  },
  {
    id: "core",
    type: "diamond",
    x: 235,
    y: 280,
    width: 300,
    height: 140,
    strokeColor: "#172f38",
    backgroundColor: "#f5f8f7",
    strokeWidth: 2,
    roughness: 1
  },
  {
    id: "sync",
    type: "rectangle",
    x: 620,
    y: 288,
    width: 180,
    height: 118,
    strokeColor: "#a56827",
    backgroundColor: "#f7efe2",
    strokeWidth: 2,
    roughness: 1
  },
  {
    id: "arrow-a",
    type: "arrow",
    x: 270,
    y: 208,
    width: 100,
    height: 72,
    strokeColor: "#53656b",
    backgroundColor: "transparent",
    strokeWidth: 2,
    roughness: 1
  },
  {
    id: "arrow-b",
    type: "arrow",
    x: 510,
    y: 208,
    width: 80,
    height: 78,
    strokeColor: "#53656b",
    backgroundColor: "transparent",
    strokeWidth: 2,
    roughness: 1
  },
  {
    id: "arrow-c",
    type: "arrow",
    x: 535,
    y: 344,
    width: 85,
    height: 0,
    strokeColor: "#a56827",
    backgroundColor: "transparent",
    strokeWidth: 2,
    roughness: 1
  },
  {
    id: "label-browser",
    type: "text",
    x: 122,
    y: 128,
    width: 108,
    height: 30,
    text: "浏览器版本",
    strokeColor: "#172f38",
    backgroundColor: "transparent"
  },
  {
    id: "label-desktop",
    type: "text",
    x: 451,
    y: 128,
    width: 108,
    height: 30,
    text: "桌面客户端",
    strokeColor: "#172f38",
    backgroundColor: "transparent"
  },
  {
    id: "label-core",
    type: "text",
    x: 292,
    y: 330,
    width: 190,
    height: 30,
    text: "Markdown 工作区",
    strokeColor: "#172f38",
    backgroundColor: "transparent"
  },
  {
    id: "label-sync",
    type: "text",
    x: 664,
    y: 330,
    width: 96,
    height: 30,
    text: "同步与版本",
    strokeColor: "#7b4a19",
    backgroundColor: "transparent"
  }
];

export const seedNotes: Note[] = [
  {
    id: "note-product-brief",
    title: "墨织：产品愿景与边界",
    folder: "产品",
    filePath: "产品/产品愿景.md",
    tags: ["产品", "本地优先", "Markdown"],
    createdAt: "2026-11-08T09:20:00+08:00",
    updatedAt: "2026-11-13T14:32:00+08:00",
    content: `# 墨织：产品愿景与边界

> 让知识重新成为用户可以带走的文件，而不是被锁在某个编辑器里的数据。

## 一句话定义

墨织 InkLoom 是一套 **Markdown 原生、图表可编辑、浏览器与桌面端共用** 的个人和小团队知识工作台。

它不要求用户先学习一套专有内容格式。正文是 \`.md\`，图表是 \`.mermaid\` 代码或 \`.excalidraw\` 场景文件；数据库只负责索引、搜索和版本，不拥有内容。

## 核心判断

| 问题 | 墨织的选择 |
| --- | --- |
| 内容归属 | 用户工作区里的普通文件 |
| 编辑体验 | 所见即所得，但随时可切回源码 |
| 图表保存 | 文本图保留源码，自由画布保留场景 JSON |
| 多端一致 | 浏览器与 Tauri 客户端复用同一套前端 |
| 搜索 | 文件是事实源，SQLite 索引可重建 |
| 协同 | 文档级 Yjs，Markdown 定时固化 |

## 系统边界

\`\`\`excalidraw
id: system-map
title: 系统边界画布
src: ./assets/system-map.excalidraw
\`\`\`

## 不做什么

- 不把正文存进不可迁移的富文本 JSON。
- 不让 Markdown 渲染器成为唯一的编辑入口。
- 不在第一版同时做企业权限、知识图谱和 AI 问答。
- 不承诺所有浏览器都能直接写入本地目录；Safari 与 Firefox 走云端或导入导出。

## 第一版验收

1. 新建文档后，磁盘上立即出现可读的 \`.md\` 文件。
2. 双击文件可在墨织中打开，未知 Markdown 语法不被静默删除。
3. 输入 Mermaid 后 500ms 内完成渲染。
4. Excalidraw 画布关闭再打开，节点、连线与文字完整恢复。
5. 断网编辑不阻塞，恢复连接后可同步。
`,
    canvas: {
      title: "系统边界画布",
      elements: systemMapElements
    }
  },
  {
    id: "note-file-model",
    title: "Markdown 文件模型",
    folder: "架构",
    filePath: "架构/Markdown文件模型.md",
    tags: ["架构", "文件系统", "数据模型"],
    createdAt: "2026-11-09T10:05:00+08:00",
    updatedAt: "2026-11-13T11:46:00+08:00",
    content: `# Markdown 文件模型

## 原则

Markdown 是唯一正文事实源。编辑器、预览、全文索引与 AI 能力都从它派生。

### 推荐目录

\`\`\`text
workspace/
├─ 产品/
│  └─ 产品愿景.md
├─ 架构/
│  └─ Markdown文件模型.md
├─ assets/
│  ├─ 3f7c9a-system-map.excalidraw
│  └─ 3f7c9a-system-map.svg
└─ .inkloom/
   ├─ index.sqlite
   ├─ history/
   └─ workspace.json
\`\`\`

## 文件头

\`\`\`yaml
---
id: 01JQ2GZ9K8WJ5J7J4M1T7Y6K3P
title: Markdown 文件模型
created: 2026-11-09T02:05:00Z
updated: 2026-11-13T03:46:00Z
tags: [架构, 文件系统, 数据模型]
---
\`\`\`

文件移动或改名时，稳定 \`id\` 不变化。反向链接优先按 \`id\` 解析，其次按相对路径。

## 图表嵌入

Mermaid 使用标准 fenced code block，天然可移植：

\`\`\`mermaid
flowchart LR
  A[磁盘 Markdown] --> B[解析与索引]
  A --> C[编辑器视图]
  B --> D[搜索 / 反链]
  C --> E[Mermaid / Excalidraw]
\`\`\`

自由画布使用可忽略的扩展代码块；未知渲染器会把它当成普通代码块，不破坏文件：

\`\`\`excalidraw
id: system-map
title: 系统边界画布
src: ./assets/system-map.excalidraw
\`\`\`

## 版本快照

内容按 SHA-256 做内容寻址。连续输入先进入本地 WAL，静止 2 秒后写入一次快照；历史记录保留“谁、何时、来源端”和可恢复的完整文件。

> 文件名属于用户体验，\`id\` 属于系统可靠性。两者必须分离。
`,
    canvas: {
      title: "内容管线",
      elements: [
        {
          id: "md",
          type: "rectangle",
          x: 80,
          y: 120,
          width: 180,
          height: 100,
          strokeColor: "#244d4a",
          backgroundColor: "#e9f0ee",
          strokeWidth: 2
        },
        {
          id: "parser",
          type: "rectangle",
          x: 350,
          y: 120,
          width: 180,
          height: 100,
          strokeColor: "#244d4a",
          backgroundColor: "#f7faf9",
          strokeWidth: 2
        },
        {
          id: "search",
          type: "rectangle",
          x: 620,
          y: 70,
          width: 180,
          height: 88,
          strokeColor: "#a56827",
          backgroundColor: "#f7efe2",
          strokeWidth: 2
        },
        {
          id: "render",
          type: "rectangle",
          x: 620,
          y: 190,
          width: 180,
          height: 88,
          strokeColor: "#a56827",
          backgroundColor: "#f7efe2",
          strokeWidth: 2
        },
        {
          id: "a1",
          type: "arrow",
          x: 260,
          y: 170,
          width: 90,
          height: 0,
          strokeColor: "#53656b",
          backgroundColor: "transparent",
          strokeWidth: 2
        },
        {
          id: "a2",
          type: "arrow",
          x: 530,
          y: 148,
          width: 90,
          height: -34,
          strokeColor: "#a56827",
          backgroundColor: "transparent",
          strokeWidth: 2
        },
        {
          id: "a3",
          type: "arrow",
          x: 530,
          y: 192,
          width: 90,
          height: 42,
          strokeColor: "#a56827",
          backgroundColor: "transparent",
          strokeWidth: 2
        },
        {
          id: "t1",
          type: "text",
          x: 125,
          y: 156,
          width: 96,
          height: 30,
          text: ".md 文件",
          strokeColor: "#172f38"
        },
        {
          id: "t2",
          type: "text",
          x: 386,
          y: 156,
          width: 108,
          height: 30,
          text: "AST / 索引",
          strokeColor: "#172f38"
        },
        {
          id: "t3",
          type: "text",
          x: 678,
          y: 98,
          width: 68,
          height: 30,
          text: "全文搜索",
          strokeColor: "#7b4a19"
        },
        {
          id: "t4",
          type: "text",
          x: 678,
          y: 218,
          width: 68,
          height: 30,
          text: "多端渲染",
          strokeColor: "#7b4a19"
        }
      ]
    }
  },
  {
    id: "note-sync",
    title: "同步、离线与冲突策略",
    folder: "架构",
    filePath: "架构/同步与冲突.md",
    tags: ["同步", "CRDT", "离线优先"],
    createdAt: "2026-11-10T08:30:00+08:00",
    updatedAt: "2026-11-12T18:12:00+08:00",
    content: `# 同步、离线与冲突策略

## 两类同步不能混为一谈

1. **文档协同**：同一篇文档被多人同时编辑，用 Yjs CRDT 合并字符级操作。
2. **文件同步**：文件增删改、附件与目录结构，用版本清单和内容哈希同步。

CRDT 不替代文件版本，文件版本也不能解决同一段文字的实时合并。

## 写入链路

\`\`\`mermaid
sequenceDiagram
  participant U as 编辑器
  participant L as 本地 WAL
  participant Y as Yjs 文档
  participant S as Hocuspocus
  participant M as Markdown 固化器
  U->>Y: 输入操作
  Y->>L: 追加 update
  Y-->>S: WebSocket 增量
  S-->>Y: 远端增量
  Y->>M: 800ms 防抖
  M->>L: 写入 .md 新版本
\`\`\`

## 冲突规则

| 场景 | 策略 |
| --- | --- |
| 在线多人编辑 | Yjs 自动合并 |
| 两端离线改同一文档 | 保留两条版本，内容级自动合并，失败时生成冲突副本 |
| 文件名同时修改 | 以稳定 id 识别，目录项做 last-writer-wins |
| 附件同时替换 | 内容寻址去重，不覆盖旧哈希 |
| 本地文件被外部程序修改 | 文件监听器产生新 revision，再与本地 WAL 对账 |

## 关键限制

- 一个 Markdown 文件在同一时刻只允许一个“固化器”写盘。
- 协同会话结束后必须强制序列化，不能只留 Yjs 二进制。
- 序列化前后做 AST 等价校验；无法等价时保留源码并提示用户。
`
  },
  {
    id: "note-editor-research",
    title: "编辑器选型：Milkdown vs Tiptap",
    folder: "研究",
    filePath: "研究/编辑器选型.md",
    tags: ["编辑器", "ProseMirror", "技术选型"],
    createdAt: "2026-11-07T13:40:00+08:00",
    updatedAt: "2026-11-12T09:26:00+08:00",
    content: `# 编辑器选型：Milkdown vs Tiptap

## 结论

首选 **Milkdown + ProseMirror + Remark**，源码模式使用 **CodeMirror 6**。

原因不是 Milkdown 的默认样式，而是它的数据方向更符合“Markdown 是事实源”：解析与序列化链路更短，未知节点更容易控制，图表代码块也更容易作为一等节点扩展。

## 对比

| 维度 | Milkdown | Tiptap |
| --- | --- | --- |
| Markdown 心智 | Markdown-first | Rich-text-first |
| 底层 | ProseMirror + Remark | ProseMirror |
| 自定义图表节点 | 自然 | 可行，但需额外定义序列化 |
| 协同 | Yjs | Yjs 生态成熟 |
| UI 完整度 | Crepe 提供完整套件 | 商业 UI 与扩展更丰富 |
| 许可风险 | MIT 为主 | 核心开源，部分能力商业授权 |

## 风险

- Markdown 语法本身不能无损表达所有富文本。
- 需要建立“AST 等价”回归语料，覆盖表格、数学公式、嵌套列表、脚注和图表块。
- Excalidraw 组件体积较大，必须按需加载。
`,
    canvas: {
      title: "编辑器架构",
      elements: [
        {
          id: "wysiwyg",
          type: "rectangle",
          x: 80,
          y: 100,
          width: 210,
          height: 110,
          strokeColor: "#244d4a",
          backgroundColor: "#e9f0ee",
          strokeWidth: 2
        },
        {
          id: "source",
          type: "rectangle",
          x: 80,
          y: 280,
          width: 210,
          height: 110,
          strokeColor: "#244d4a",
          backgroundColor: "#f7faf9",
          strokeWidth: 2
        },
        {
          id: "ast",
          type: "diamond",
          x: 390,
          y: 190,
          width: 240,
          height: 140,
          strokeColor: "#a56827",
          backgroundColor: "#f7efe2",
          strokeWidth: 2
        },
        {
          id: "md2",
          type: "rectangle",
          x: 730,
          y: 210,
          width: 180,
          height: 96,
          strokeColor: "#244d4a",
          backgroundColor: "#f7faf9",
          strokeWidth: 2
        },
        {
          id: "line1",
          type: "arrow",
          x: 290,
          y: 154,
          width: 100,
          height: 66,
          strokeColor: "#53656b",
          backgroundColor: "transparent",
          strokeWidth: 2
        },
        {
          id: "line2",
          type: "arrow",
          x: 290,
          y: 334,
          width: 100,
          height: -74,
          strokeColor: "#53656b",
          backgroundColor: "transparent",
          strokeWidth: 2
        },
        {
          id: "line3",
          type: "arrow",
          x: 630,
          y: 260,
          width: 100,
          height: 0,
          strokeColor: "#a56827",
          backgroundColor: "transparent",
          strokeWidth: 2
        },
        {
          id: "text1",
          type: "text",
          x: 120,
          y: 138,
          width: 130,
          height: 30,
          text: "所见即所得视图",
          strokeColor: "#172f38"
        },
        {
          id: "text2",
          type: "text",
          x: 126,
          y: 318,
          width: 116,
          height: 30,
          text: "源码视图",
          strokeColor: "#172f38"
        },
        {
          id: "text3",
          type: "text",
          x: 452,
          y: 246,
          width: 116,
          height: 30,
          text: "统一 Markdown AST",
          strokeColor: "#7b4a19"
        },
        {
          id: "text4",
          type: "text",
          x: 778,
          y: 246,
          width: 80,
          height: 30,
          text: ".md 文件",
          strokeColor: "#172f38"
        }
      ]
    }
  },
  {
    id: "note-guide",
    title: "原型操作说明",
    folder: "个人",
    filePath: "个人/原型操作说明.md",
    tags: ["说明", "原型"],
    createdAt: "2026-11-13T08:00:00+08:00",
    updatedAt: "2026-11-13T14:44:00+08:00",
    content: `# 原型操作说明

这个原型用于验证产品形态，不是最终工程版本。

## 可以体验

- 新建、搜索、切换和删除文档
- Markdown 自动保存到浏览器 localStorage
- 源码、分栏、阅读三种模式
- Mermaid 图表实时渲染
- 打开并编辑 Excalidraw 画布
- 导入 Markdown、导出当前 Markdown

## 建议重点观察

1. 左侧目录是否足够像“文件系统”，而不是普通网页导航。
2. 中间稿纸是否适合长时间阅读和写作。
3. 图表在正文中是否仍然保持“可编辑资产”的身份。
4. 自动保存状态是否清楚，但不打扰写作。

> 工程实现时，localStorage 会替换为本地文件 + SQLite 索引；界面与交互可以沿用。
`
  }
];
