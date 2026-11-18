import DOMPurify from "dompurify";
import { marked } from "marked";

export type CanvasScene = {
  title: string;
  elements: readonly Record<string, unknown>[];
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replaceAll("\n", "&#10;");
}

function stripMarkdown(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_~|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value: string): string {
  return stripMarkdown(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");
}

function renderInlineTokens(tokens: unknown[]): string {
  const raw = tokens
    .map((token) => {
      if (typeof token === "string") return token;
      const record = token as { raw?: string; text?: string };
      return record.raw ?? record.text ?? "";
    })
    .join("");
  return marked.parseInline(raw) as string;
}

function makeCanvasPreview(canvas?: CanvasScene): string {
  const elements = canvas?.elements ?? [];
  if (elements.length === 0) {
    return `
      <svg viewBox="0 0 800 340" role="img" aria-label="空白画布">
        <rect x="1" y="1" width="798" height="338" rx="14" fill="#f8faf9" stroke="#cfd9d6"/>
        <path d="M 80 250 C 180 90, 280 290, 390 140 S 600 90, 720 210" fill="none" stroke="#98aaa5" stroke-width="2" stroke-dasharray="7 8"/>
        <circle cx="390" cy="140" r="5" fill="#a56827"/>
        <text x="400" y="184" text-anchor="middle" fill="#61706d" font-size="18">在 Excalidraw 中开始绘制</text>
      </svg>`;
  }

  const usable = elements.filter((item) => Number.isFinite(Number(item.x)));
  const xs = usable.flatMap((item) => {
    const x = Number(item.x ?? 0);
    const width = Math.max(0, Number(item.width ?? 0));
    return [x, x + width];
  });
  const ys = usable.flatMap((item) => {
    const y = Number(item.y ?? 0);
    const height = Math.max(0, Number(item.height ?? 0));
    return [y, y + height];
  });
  const minX = Math.min(...xs) - 50;
  const minY = Math.min(...ys) - 50;
  const maxX = Math.max(...xs) + 50;
  const maxY = Math.max(...ys) + 50;
  const width = Math.max(520, maxX - minX);
  const height = Math.max(240, maxY - minY);

  const shapes = usable
    .map((item) => {
      const type = String(item.type ?? "rectangle");
      const x = Number(item.x ?? 0);
      const y = Number(item.y ?? 0);
      const w = Math.max(1, Number(item.width ?? 1));
      const h = Math.max(1, Number(item.height ?? 1));
      const stroke = String(item.strokeColor ?? "#244d4a");
      const fill = String(item.backgroundColor ?? "transparent");
      const strokeWidth = Number(item.strokeWidth ?? 2);

      if (type === "text") {
        return `<text x="${x}" y="${y + 22}" fill="${stroke}" font-size="17" font-family="Microsoft YaHei, sans-serif">${escapeHtml(
          String(item.text ?? "")
        )}</text>`;
      }
      if (type === "arrow" || type === "line") {
        const endX = x + w;
        const endY = y + h;
        return `<g><line x1="${x}" y1="${y}" x2="${endX}" y2="${endY}" stroke="${stroke}" stroke-width="${strokeWidth}" marker-end="url(#arrow)"/></g>`;
      }
      if (type === "ellipse") {
        return `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
      }
      if (type === "diamond") {
        return `<polygon points="${x + w / 2},${y} ${x + w},${y + h / 2} ${
          x + w / 2
        },${y + h} ${x},${y + h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
      }
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
    })
    .join("");

  return `
    <svg viewBox="${minX} ${minY} ${width} ${height}" role="img" aria-label="${escapeAttribute(
      canvas?.title ?? "Excalidraw 画布"
    )}">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#53656b"/>
        </marker>
      </defs>
      ${shapes}
    </svg>`;
}

export function renderMarkdown(content: string, canvas?: CanvasScene): string {
  const renderer = new marked.Renderer();

  renderer.code = ({ text, lang }) => {
    const language = (lang ?? "").trim().toLowerCase();
    if (language === "mermaid") {
      return `
        <figure class="diagram-frame">
          <div class="diagram-head">
            <span class="diagram-kind">MERMAID</span>
            <span class="diagram-hint">源码随 Markdown 保存</span>
          </div>
          <div class="mermaid-block"><code class="mermaid-source">${escapeHtml(text)}</code></div>
        </figure>`;
    }
    if (language === "excalidraw") {
      return `
        <figure class="canvas-embed">
          <div class="canvas-embed-head">
            <span><span class="diagram-kind">EXCALIDRAW</span> ${
              canvas?.title ? escapeHtml(canvas.title) : "自由画布"
            }</span>
            <button class="canvas-open" type="button">打开画布</button>
          </div>
          <div class="canvas-preview">${makeCanvasPreview(canvas)}</div>
          <figcaption>场景保存在 <code>.excalidraw</code> 文件，正文只保留引用与 SVG 预览。</figcaption>
        </figure>`;
    }
    return `<pre class="code-block"><code class="language-${escapeAttribute(language)}">${escapeHtml(
      text
    )}</code></pre>`;
  };

  renderer.heading = ({ tokens, depth }) => {
    const inline = renderInlineTokens(tokens);
    const id = slugify(inline.replace(/<[^>]+>/g, ""));
    return `<h${depth} id="${id}">${inline}</h${depth}>`;
  };

  renderer.link = ({ href, title, tokens }) => {
    const text = renderInlineTokens(tokens);
    const external = /^https?:\/\//.test(href);
    return `<a href="${escapeAttribute(href)}"${
      title ? ` title="${escapeAttribute(title)}"` : ""
    }${external ? ' target="_blank" rel="noreferrer"' : ""}>${text}</a>`;
  };

  const parsed = marked.parse(content, {
    renderer,
    gfm: true,
    breaks: false
  }) as string;

  return DOMPurify.sanitize(parsed, {
    ADD_ATTR: ["target", "rel", "data-code", "data-canvas-id"],
    ADD_TAGS: [
      "figure",
      "figcaption",
      "button",
      "svg",
      "defs",
      "marker",
      "path",
      "rect",
      "circle",
      "ellipse",
      "polygon",
      "line",
      "text",
      "g"
    ]
  });
}

let mermaidReady: Promise<typeof import("mermaid").default> | undefined;

async function loadMermaid(): Promise<typeof import("mermaid").default> {
  mermaidReady ??= import("mermaid").then(({ default: mermaid }) => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "base",
      fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif',
      themeVariables: {
        primaryColor: "#eef4f2",
        primaryTextColor: "#172f38",
        primaryBorderColor: "#5f7d77",
        lineColor: "#6c7b7e",
        secondaryColor: "#f7efe2",
        tertiaryColor: "#f7faf9",
        fontSize: "15px"
      }
    });
    return mermaid;
  });
  return mermaidReady;
}

export async function renderMermaidBlocks(
  root: ParentNode | null | undefined,
  isCancelled: () => boolean = () => false
): Promise<void> {
  const nodes = root?.querySelectorAll<HTMLElement>(".mermaid-block");
  if (!nodes || nodes.length === 0) return;
  const mermaid = await loadMermaid();

  await Promise.all(
    [...nodes].map(async (node, index) => {
      const code = node.querySelector(".mermaid-source")?.textContent ?? "";
      if (!code) return;
      try {
        const result = await mermaid.render(`inkloom-diagram-${Date.now()}-${index}`, code);
        if (!isCancelled()) node.innerHTML = result.svg;
      } catch {
        if (!isCancelled()) {
          node.innerHTML = `<div class="diagram-error">图表语法需要检查<br><code>${escapeHtml(
            code.split("\n")[0]
          )}</code></div>`;
        }
      }
    })
  );
}
