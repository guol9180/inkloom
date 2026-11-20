export type MarkdownGoldenCase = {
  name: string;
  source: string;
  requiredFragments: readonly string[];
};

export const MARKDOWN_GOLDEN_CORPUS: readonly MarkdownGoldenCase[] = [
  {
    name: "Chinese headings and inline styles",
    source: [
      "# 一级标题，中文标点！",
      "",
      "## **粗体**、*斜体*、~~删除~~、<u>下划线</u> 与 `行内代码`。",
      "",
      "###### 六级标题：保留末尾标点。",
      ""
    ].join("\n"),
    requiredFragments: ["# 一级标题", "~~删除~~", "<u>下划线</u>", "######"]
  },
  {
    name: "links images escapes and line endings",
    source: [
      "[有标题的链接](https://example.com \"示例\") 与 <https://inkloom.example>。",
      "",
      "![架构图](assets/architecture.png \"架构\")",
      "",
      "反斜杠转义 \\*不是斜体\\*。",
      "硬换行  ",
      "软换行",
      "",
      "",
      "连续空行之后。",
      ""
    ].join("\n"),
    requiredFragments: ["https://example.com", "assets/architecture.png", "\\*不是斜体\\*", "\n\n\n"]
  },
  {
    name: "nested lists tasks quotes and tables",
    source: [
      "- 顶层项目",
      "  - 第二层",
      "    1. 有序子项",
      "  - [ ] 待办",
      "  - [x] 已完成",
      "",
      "> 引用第一行",
      ">",
      "> 引用第二行",
      "",
      "| 名称 | 状态 |",
      "| :--- | ---: |",
      "| 编辑器 | 可用 |",
      ""
    ].join("\n"),
    requiredFragments: ["第二层", "- [ ]", "> 引用第二行", "| :--- | ---: |"]
  },
  {
    name: "known unknown fences and mermaid",
    source: [
      "```ts",
      "const answer = 42;",
      "```",
      "",
      "```unknown-language",
      "raw syntax that must survive",
      "```",
      "",
      "```mermaid",
      "flowchart LR",
      "  A[开始] --> B[结束]",
      "```",
      ""
    ].join("\n"),
    requiredFragments: ["const answer = 42;", "unknown-language", "flowchart LR"]
  },
  {
    name: "math footnotes and link definitions",
    source: [
      "行内公式 $E = mc^2$。",
      "",
      "$$",
      "\\int_0^1 x^2 dx",
      "$$",
      "",
      "脚注引用[^note]，重复引用[^note]。",
      "",
      "[^note]: 保留脚注定义。",
      "",
      "[reference]: https://example.com/reference \"引用标题\"",
      "",
      "使用 [引用][reference]。",
      ""
    ].join("\n"),
    requiredFragments: ["$E = mc^2$", "\\int_0^1", "[^note]:", "[reference]:"]
  },
  {
    name: "HTML comments details and unknown HTML",
    source: [
      "<!-- 这是必须保留的注释 -->",
      "",
      "<details>",
      "<summary>展开更多</summary>",
      "",
      "隐藏内容",
      "",
      "</details>",
      "",
      "<aside data-unknown=\"yes\">未知 HTML 结构</aside>",
      ""
    ].join("\n"),
    requiredFragments: ["<!-- 这是必须保留的注释 -->", "<details>", "<aside data-unknown=\"yes\">"]
  },
  {
    name: "InkLoom canvas and file blocks",
    source: [
      "<!-- inkloom:canvas",
      "id: canvas_01JABC",
      "title: 系统边界",
      "scene: assets/hash.excalidraw",
      "preview: assets/hash.svg",
      "-->",
      "![系统边界](assets/hash.svg)",
      "<!-- /inkloom:canvas -->",
      "",
      "<!-- inkloom:file",
      "id: file_01JABC",
      "mime: application/pdf",
      "size: 2481920",
      "-->",
      "[产品架构.pdf](assets/hash.pdf)",
      "<!-- /inkloom:file -->",
      ""
    ].join("\n"),
    requiredFragments: ["inkloom:canvas", "scene: assets/hash.excalidraw", "inkloom:file"]
  },
  {
    name: "frontmatter and unknown fields",
    source: [
      "---",
      "title: 保留字段",
      "tags:",
      "  - 产品",
      "  - 规范",
      "unknown_field:",
      "  nested: true",
      "---",
      "",
      "# 正文",
      ""
    ].join("\n"),
    requiredFragments: ["unknown_field:", "nested: true", "# 正文"]
  },
  {
    name: "malformed and extension-like syntax",
    source: [
      ":::inkloom-note",
      "没有自定义解析器的内容",
      ":::",
      "",
      "~~未闭合的删除线",
      "",
      "<div>",
      "未闭合 HTML",
      ""
    ].join("\n"),
    requiredFragments: [":::inkloom-note", "~~未闭合", "<div>"]
  },
  {
    name: "CRLF and missing final newline",
    source: "# Windows\r\n\r\n第一段\r\n\r\n- 列表项\r\n\r\n最后一行没有换行",
    requiredFragments: ["\r\n", "最后一行没有换行"]
  }
];
