import DOMPurify from "dompurify";

export type MermaidTemplateId =
  | "flowchart"
  | "sequence"
  | "state"
  | "class"
  | "er";

export type MermaidTemplate = {
  id: MermaidTemplateId;
  label: string;
  source: string;
};

export type MermaidRenderError = {
  message: string;
  line?: number;
  column?: number;
};

export const MERMAID_TEMPLATES: readonly MermaidTemplate[] = [
  {
    id: "flowchart",
    label: "流程图",
    source: "flowchart LR\n  A[开始] --> B{需要处理?}\n  B -->|是| C[执行]\n  B -->|否| D[结束]"
  },
  {
    id: "sequence",
    label: "时序图",
    source: "sequenceDiagram\n  participant U as 用户\n  participant S as 系统\n  U->>S: 提交请求\n  S-->>U: 返回结果"
  },
  {
    id: "state",
    label: "状态图",
    source: "stateDiagram-v2\n  [*] --> 草稿\n  草稿 --> 已发布: 发布\n  已发布 --> [*]"
  },
  {
    id: "class",
    label: "类图",
    source: "classDiagram\n  class 文档 {\n    +String title\n    +save()\n  }\n  文档 <|-- 随记"
  },
  {
    id: "er",
    label: "关系图",
    source: "erDiagram\n  WORKSPACE ||--o{ DOCUMENT : contains\n  DOCUMENT ||--o{ ASSET : references"
  }
];

let mermaidReady: Promise<typeof import("mermaid").default> | undefined;
let renderSequence = 0;

function loadMermaid(): Promise<typeof import("mermaid").default> {
  mermaidReady ??= import("mermaid").then(({ default: mermaid }) => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      suppressErrorRendering: true,
      theme: "base",
      htmlLabels: false,
      flowchart: {
        htmlLabels: false
      },
      fontFamily:
        "Geist, 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif",
      themeVariables: {
        background: "#ffffff",
        primaryColor: "#f5f7f4",
        primaryTextColor: "#26332d",
        primaryBorderColor: "#aebbb3",
        lineColor: "#78867e",
        secondaryColor: "#edf3ef",
        tertiaryColor: "#fafbf9",
        noteBkgColor: "#f7f5ee",
        noteTextColor: "#4a4b43",
        noteBorderColor: "#d8d4c8",
        fontSize: "15px"
      }
    });
    return mermaid;
  });
  return mermaidReady;
}

export async function renderMermaidSvg(source: string): Promise<string> {
  const mermaid = await loadMermaid();
  const id = `inkloom-mermaid-${Date.now()}-${renderSequence++}`;
  const { svg } = await mermaid.render(id, source);
  return DOMPurify.sanitize(svg, {
    ADD_TAGS: ["foreignObject"],
    USE_PROFILES: {
      svg: true,
      svgFilters: true,
      html: true
    }
  });
}

export function toMermaidRenderError(error: unknown): MermaidRenderError {
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "图表语法需要检查。";
  const message = rawMessage
    .replace(/^Error:\s*/i, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const lineMatch = message.match(/\b(?:line|行)\s*(\d+)/i);
  const columnMatch = message.match(/\b(?:column|列)\s*(\d+)/i);
  return {
    message: message || "图表语法需要检查。",
    ...(lineMatch ? { line: Number(lineMatch[1]) } : {}),
    ...(columnMatch ? { column: Number(columnMatch[1]) } : {})
  };
}

export function matchingMermaidTemplate(
  source: string
): MermaidTemplateId | "custom" {
  const normalized = source.trim();
  return (
    MERMAID_TEMPLATES.find((template) => template.source === normalized)?.id ??
    "custom"
  );
}
