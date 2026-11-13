import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent
} from "react";
import DOMPurify from "dompurify";
import { marked } from "marked";
import mermaid from "mermaid";
import {
  ArrowUpRight,
  Bold,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  CirclePlus,
  Code2,
  Columns2,
  Download,
  Eye,
  FileText,
  FolderClosed,
  FolderOpen,
  GitBranch,
  HardDrive,
  Heading2,
  History,
  ImagePlus,
  Italic,
  Link2,
  List,
  Menu,
  MoreHorizontal,
  Network,
  PanelLeftClose,
  PanelRightClose,
  Search,
  Settings,
  SquarePen,
  Tag,
  Upload,
  X
} from "lucide-react";
import { folderOrder, seedNotes, type CanvasScene, type Note } from "./data";

const LazyExcalidraw = lazy(async () => {
  const module = await import("@excalidraw/excalidraw");
  return { default: module.Excalidraw };
});

type ViewMode = "source" | "split" | "read";
type SaveState = "saved" | "saving";

const NOTES_KEY = "inkloom.prototype.notes.v1";
const ACTIVE_KEY = "inkloom.prototype.active.v1";

function loadNotes(): Note[] {
  try {
    if (new URLSearchParams(window.location.search).has("fresh")) {
      localStorage.removeItem(NOTES_KEY);
      localStorage.removeItem(ACTIVE_KEY);
      window.history.replaceState({}, "", window.location.pathname);
    }
    const raw = localStorage.getItem(NOTES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Note[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // Seed data remains usable if the browser has an old or malformed cache.
  }
  return seedNotes;
}

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
        return `<polygon points="${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${
          y + h
        } ${x},${y + h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
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

function renderMarkdown(content: string, canvas?: CanvasScene): string {
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
    ADD_TAGS: ["figure", "figcaption", "button", "svg", "defs", "marker", "path", "rect", "circle", "ellipse", "polygon", "line", "text", "g"]
  });
}

function formatTime(value: string): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function countWords(content: string): number {
  const plain = stripMarkdown(content);
  const cjk = plain.match(/[\u3400-\u9fff]/g)?.length ?? 0;
  const latin = plain.replace(/[\u3400-\u9fff]/g, " ").match(/[A-Za-z0-9]+/g)?.length ?? 0;
  return cjk + latin;
}

function createNote(folder = "个人"): Note {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  return {
    id,
    title: "未命名文档",
    folder,
    filePath: `${folder}/未命名文档.md`,
    tags: [],
    createdAt: now,
    updatedAt: now,
    content: "# 未命名文档\n\n从这里开始记录。\n"
  };
}

function normalizeExcalidrawElements(
  elements: readonly Record<string, unknown>[]
): readonly Record<string, unknown>[] {
  const now = Date.now();
  return elements.map((element, index) => {
    const type = String(element.type ?? "rectangle");
    const width = Math.max(1, Number(element.width ?? 120));
    const height = Math.max(1, Number(element.height ?? 80));
    const common = {
      id: String(element.id ?? `element-${index}`),
      type,
      x: Number(element.x ?? 0),
      y: Number(element.y ?? 0),
      strokeColor: String(element.strokeColor ?? "#172f38"),
      backgroundColor: String(element.backgroundColor ?? "transparent"),
      fillStyle: "solid",
      strokeWidth: Number(element.strokeWidth ?? 2),
      strokeStyle: "solid",
      roundness: type === "rectangle" ? { type: 3 } : null,
      roughness: Number(element.roughness ?? 1),
      opacity: 100,
      width,
      height,
      angle: 0,
      seed: 1000 + index,
      version: 1,
      versionNonce: 2000 + index,
      index: null,
      isDeleted: false,
      groupIds: [],
      frameId: null,
      boundElements: null,
      updated: now,
      link: null,
      locked: false
    };

    if (type === "arrow" || type === "line") {
      return {
        ...common,
        type,
        points: [
          [0, 0],
          [width, height]
        ],
        lastCommittedPoint: null,
        startBinding: null,
        endBinding: null,
        startArrowhead: null,
        endArrowhead: type === "arrow" ? "arrow" : null,
        elbowed: false
      };
    }

    if (type === "text") {
      const text = String(element.text ?? "文字");
      return {
        ...common,
        type: "text",
        text,
        originalText: text,
        fontSize: 20,
        fontFamily: 1,
        textAlign: "left",
        verticalAlign: "top",
        containerId: null,
        autoResize: true,
        lineHeight: 1.25
      };
    }

    return common;
  });
}

function CanvasEditor({
  scene,
  onCancel,
  onSave
}: {
  scene?: CanvasScene;
  onCancel: () => void;
  onSave: (elements: readonly Record<string, unknown>[]) => void;
}) {
  const sceneRef = useRef<readonly Record<string, unknown>[]>(
    normalizeExcalidrawElements(scene?.elements ?? [])
  );
  const initialData = useMemo(
    () => ({
      elements: sceneRef.current as never,
      appState: {
        viewBackgroundColor: "#f8faf9",
        currentItemStrokeColor: "#172f38",
        currentItemBackgroundColor: "#e9f0ee"
      }
    }),
    []
  );

  return (
    <div className="canvas-modal" role="dialog" aria-modal="true" aria-label="Excalidraw 画布">
      <div className="canvas-modal-head">
        <div>
          <span className="section-label">EXCALIDRAW 场景</span>
          <strong>{scene?.title ?? "自由画布"}</strong>
        </div>
        <div className="canvas-modal-actions">
          <span className="canvas-save-note">场景文件与 Markdown 分开保存</span>
          <button className="top-action secondary-action" type="button" onClick={onCancel}>
            取消
          </button>
          <button className="top-action" type="button" onClick={() => onSave(sceneRef.current)}>
            <Check size={15} /> 保存画布
          </button>
        </div>
      </div>
      <div className="excalidraw-shell">
        <Suspense fallback={<div className="canvas-loading">正在加载画布引擎…</div>}>
          <LazyExcalidraw
            initialData={initialData}
            onChange={(elements: readonly Record<string, unknown>[]) => {
              sceneRef.current = [...elements];
            }}
          />
        </Suspense>
      </div>
    </div>
  );
}

function App() {
  const [notes, setNotes] = useState<Note[]>(loadNotes);
  const [activeId, setActiveId] = useState<string>(() => {
    const stored = localStorage.getItem(ACTIVE_KEY);
    return stored && loadNotes().some((note) => note.id === stored)
      ? stored
      : loadNotes()[0]?.id ?? "";
  });
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [query, setQuery] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(folderOrder)
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [toast, setToast] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const initialSave = useRef(true);

  const activeNote = notes.find((note) => note.id === activeId) ?? notes[0];
  const filteredNotes = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return notes;
    return notes.filter(
      (note) =>
        note.title.toLowerCase().includes(normalized) ||
        note.content.toLowerCase().includes(normalized) ||
        note.tags.some((tag) => tag.toLowerCase().includes(normalized))
    );
  }, [notes, query]);

  const previewHtml = useMemo(
    () => renderMarkdown(activeNote?.content ?? "", activeNote?.canvas),
    [activeNote?.content, activeNote?.canvas]
  );

  const outline = useMemo(() => {
    if (!activeNote) return [];
    return [...activeNote.content.matchAll(/^(#{1,3})\s+(.+)$/gm)].map((match) => ({
      depth: match[1].length,
      text: match[2].replace(/[*_`~]/g, ""),
      id: slugify(match[2])
    }));
  }, [activeNote]);

  const backlinks = useMemo(() => {
    if (!activeNote) return [];
    return notes.filter(
      (note) =>
        note.id !== activeNote.id &&
        (note.content.includes(activeNote.title) || note.content.includes(activeNote.filePath))
    );
  }, [activeNote, notes]);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    let cancelled = false;
    const nodes = previewRef.current?.querySelectorAll<HTMLElement>(".mermaid-block");
    if (!nodes) return;

    nodes.forEach(async (node, index) => {
      const code = node.querySelector(".mermaid-source")?.textContent ?? "";
      if (!code) return;
      try {
        const result = await mermaid.render(`inkloom-diagram-${Date.now()}-${index}`, code);
        if (!cancelled) node.innerHTML = result.svg;
      } catch {
        if (!cancelled) {
          node.innerHTML = `<div class="diagram-error">图表语法需要检查<br><code>${escapeHtml(
            code.split("\n")[0]
          )}</code></div>`;
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [previewHtml]);

  useEffect(() => {
    if (initialSave.current) {
      initialSave.current = false;
      return;
    }
    setSaveState("saving");
    const timer = window.setTimeout(() => {
      localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
      setSaveState("saved");
    }, 500);
    return () => window.clearTimeout(timer);
  }, [notes]);

  useEffect(() => {
    if (activeId) localStorage.setItem(ACTIVE_KEY, activeId);
  }, [activeId]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
        setSaveState("saved");
        showToast("当前工作区已保存");
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [notes]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }

  function updateActiveNote(patch: Partial<Note>) {
    if (!activeNote) return;
    setNotes((current) =>
      current.map((note) =>
        note.id === activeNote.id
          ? { ...note, ...patch, updatedAt: new Date().toISOString() }
          : note
      )
    );
  }

  function updateTitle(title: string) {
    if (!activeNote) return;
    const nextContent = activeNote.content.replace(/^# .+$/m, `# ${title}`);
    updateActiveNote({ title, content: nextContent });
  }

  function selectNote(id: string) {
    setActiveId(id);
    setSidebarOpen(false);
  }

  function addNote(folder = activeNote?.folder ?? "个人") {
    const note = createNote(folder);
    setNotes((current) => [...current, note]);
    setActiveId(note.id);
    setExpandedFolders((current) => new Set([...current, folder]));
    window.setTimeout(() => {
      const titleInput = document.querySelector<HTMLInputElement>(".document-title");
      titleInput?.focus();
      titleInput?.select();
    }, 30);
  }

  function deleteActiveNote() {
    if (!activeNote) return;
    if (!window.confirm(`删除“${activeNote.title}”？原型会同时删除浏览器本地副本。`)) return;
    const remaining = notes.filter((note) => note.id !== activeNote.id);
    const next = remaining.length > 0 ? remaining : [createNote()];
    setNotes(next);
    setActiveId(next[0].id);
    showToast("文档已删除");
  }

  function insertAtCursor(before: string, after = "", placeholder = "文字") {
    const textarea = textareaRef.current;
    if (!textarea || !activeNote) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = activeNote.content.slice(start, end) || placeholder;
    const next =
      activeNote.content.slice(0, start) +
      before +
      selected +
      after +
      activeNote.content.slice(end);
    updateActiveNote({ content: next });
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }

  function insertMermaid() {
    if (!activeNote) return;
    const snippet = `\n## 新图表\n\n\`\`\`mermaid\nflowchart LR\n  A[输入] --> B{判断}\n  B -->|是| C[完成]\n  B -->|否| D[调整]\n\`\`\`\n`;
    updateActiveNote({ content: activeNote.content + snippet });
    setViewMode("split");
    showToast("已插入 Mermaid 图表");
  }

  function openCanvas() {
    if (!activeNote) return;
    setCanvasOpen(true);
  }

  function insertCanvas() {
    if (!activeNote) return;
    const canvas: CanvasScene = activeNote.canvas ?? {
      title: "新画布",
      elements: []
    };
    const marker = `\`\`\`excalidraw\nid: ${activeNote.id}\ntitle: ${canvas.title}\nsrc: ./assets/${activeNote.id}.excalidraw\n\`\`\`\n`;
    updateActiveNote({
      canvas,
      content: activeNote.content.includes("```excalidraw")
        ? activeNote.content
        : `${activeNote.content}\n## 图表\n\n${marker}`
    });
    setCanvasOpen(true);
  }

  function saveCanvas(elements: readonly Record<string, unknown>[]) {
    if (!activeNote) return;
    updateActiveNote({
      canvas: {
        title: activeNote.canvas?.title ?? "自由画布",
        elements
      }
    });
    setCanvasOpen(false);
    showToast("画布场景已保存");
  }

  function exportMarkdown() {
    if (!activeNote) return;
    const body = activeNote.content.trimStart().startsWith("#")
      ? activeNote.content
      : `# ${activeNote.title}\n\n${activeNote.content}`;
    const blob = new Blob([body], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${activeNote.title.replace(/[\\/:*?"<>|]/g, "-")}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast("Markdown 已导出");
  }

  async function importMarkdown(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const text = await file.text();
    const title = file.name.replace(/\.md$/i, "");
    const now = new Date().toISOString();
    const note: Note = {
      id: crypto.randomUUID(),
      title,
      folder: "个人",
      filePath: `个人/${file.name}`,
      tags: ["导入"],
      createdAt: now,
      updatedAt: now,
      content: /^#\s/m.test(text) ? text : `# ${title}\n\n${text}`
    };
    setNotes((current) => [...current, note]);
    setActiveId(note.id);
    showToast("Markdown 已导入");
  }

  async function importFolder() {
    const picker = (window as unknown as { showDirectoryPicker?: (options?: unknown) => Promise<any> })
      .showDirectoryPicker;
    if (!picker) {
      showToast("当前浏览器不支持目录读取，请使用导入 Markdown");
      return;
    }

    try {
      const directory = await picker({ mode: "read" });
      const imported: Note[] = [];
      const scan = async (handle: any, prefix = "") => {
        for await (const [name, entry] of handle.entries()) {
          if (name.startsWith(".") || imported.length >= 200) continue;
          if (entry.kind === "file" && /\.md$/i.test(name)) {
            const file = await entry.getFile();
            const text = await file.text();
            const now = new Date(file.lastModified).toISOString();
            imported.push({
              id: crypto.randomUUID(),
              title: name.replace(/\.md$/i, ""),
              folder: prefix.split("/")[0] || "个人",
              filePath: `${prefix}${name}`,
              tags: ["文件夹导入"],
              createdAt: now,
              updatedAt: now,
              content: /^#\s/m.test(text) ? text : `# ${name.replace(/\.md$/i, "")}\n\n${text}`
            });
          }
          if (entry.kind === "directory" && prefix.split("/").length < 2) {
            await scan(entry, `${prefix}${name}/`);
          }
        }
      };
      await scan(directory);
      if (imported.length === 0) {
        showToast("文件夹里没有找到 Markdown");
        return;
      }
      setNotes((current) => [...imported, ...current]);
      setActiveId(imported[0].id);
      setExpandedFolders((current) => new Set([...current, ...imported.map((note) => note.folder)]));
      showToast(`已导入 ${imported.length} 篇 Markdown`);
    } catch (error) {
      if ((error as Error).name !== "AbortError") showToast("目录读取失败");
    }
  }

  function handlePreviewClick(event: MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest(".canvas-open")) {
      openCanvas();
    }
    const link = (event.target as HTMLElement).closest("a");
    if (link && link.getAttribute("href")?.startsWith("#")) {
      event.preventDefault();
      const target = document.getElementById(link.getAttribute("href")!.slice(1));
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  if (!activeNote) return null;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <button
            className="icon-button mobile-menu"
            type="button"
            onClick={() => setSidebarOpen((value) => !value)}
            aria-label="打开文件栏"
          >
            <Menu size={18} />
          </button>
          <div className="brand-mark" aria-hidden="true">
            <span>墨</span>
          </div>
          <div className="brand-copy">
            <strong>墨织</strong>
            <span>InkLoom · Markdown workspace</span>
          </div>
        </div>

        <div className="workspace-switcher">
          <span className="workspace-kicker">工作区</span>
          <button type="button">
            产品设计库
            <ChevronDown size={14} />
          </button>
        </div>

        <div className="topbar-actions">
          <span className="sync-state">
            <span className="sync-dot" />
            本机模式
          </span>
          <button className="top-action secondary-action" type="button" onClick={importFolder}>
            <FolderOpen size={16} />
            <span>导入文件夹</span>
          </button>
          <button
            className="top-action secondary-action"
            type="button"
            onClick={() => importRef.current?.click()}
          >
            <Upload size={16} />
            <span>导入</span>
          </button>
          <button className="top-action" type="button" onClick={exportMarkdown}>
            <Download size={16} />
            导出
          </button>
          <button className="icon-button" type="button" aria-label="设置">
            <Settings size={17} />
          </button>
          <div className="avatar" title="本地用户">
            林
          </div>
        </div>
        <input
          ref={importRef}
          className="visually-hidden"
          type="file"
          accept=".md,.markdown,text/markdown,text/plain"
          onChange={importMarkdown}
        />
      </header>

      <div className="main-grid">
        <aside className={`sidebar ${sidebarOpen ? "is-open" : ""}`}>
          <div className="sidebar-head">
            <div>
              <span className="section-label">文件</span>
              <strong>{notes.length} 篇文档</strong>
            </div>
            <button className="icon-button" type="button" onClick={() => addNote()}>
              <SquarePen size={17} />
            </button>
          </div>

          <label className="search-box">
            <Search size={15} />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索标题、正文或标签"
            />
            <kbd>⌘ K</kbd>
          </label>

          <div className="file-tree">
            {folderOrder.map((folder) => {
              const folderNotes = filteredNotes.filter((note) => note.folder === folder);
              const expanded = expandedFolders.has(folder);
              if (query && folderNotes.length === 0) return null;
              return (
                <section className="tree-folder" key={folder}>
                  <button
                    className="folder-row"
                    type="button"
                    onClick={() =>
                      setExpandedFolders((current) => {
                        const next = new Set(current);
                        if (next.has(folder)) next.delete(folder);
                        else next.add(folder);
                        return next;
                      })
                    }
                  >
                    {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    {expanded ? <FolderOpen size={16} /> : <FolderClosed size={16} />}
                    <span>{folder}</span>
                    <em>{folderNotes.length}</em>
                  </button>
                  {expanded && (
                    <div className="folder-children">
                      {folderNotes.map((note) => (
                        <button
                          className={`file-row ${note.id === activeNote.id ? "is-active" : ""}`}
                          type="button"
                          key={note.id}
                          onClick={() => selectNote(note.id)}
                        >
                          <FileText size={15} />
                          <span>
                            <strong>{note.title}</strong>
                            <small>{formatTime(note.updatedAt)}</small>
                          </span>
                        </button>
                      ))}
                      <button className="add-file-row" type="button" onClick={() => addNote(folder)}>
                        <CirclePlus size={14} />
                        新建文档
                      </button>
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          <div className="sidebar-foot">
            <div className="storage-card">
              <HardDrive size={18} />
              <div>
                <strong>浏览器本地存储</strong>
                <span>原型数据自动保存</span>
              </div>
              <Check size={15} />
            </div>
            <div className="sidebar-links">
              <button type="button">
                <History size={15} /> 版本历史
              </button>
              <button type="button">
                <Settings size={15} /> 工作区设置
              </button>
            </div>
          </div>
        </aside>

        <main className="editor-column">
          <div className="document-topline">
            <div className="breadcrumbs">
              <span>产品设计库</span>
              <ChevronRight size={12} />
              <span>{activeNote.folder}</span>
              <ChevronRight size={12} />
              <strong>{activeNote.title}</strong>
            </div>
            <div className="document-actions">
              <div className="save-indicator" aria-live="polite">
                {saveState === "saving" ? (
                  <>
                    <span className="saving-dot" />
                    保存中
                  </>
                ) : (
                  <>
                    <Check size={13} />
                    已保存
                  </>
                )}
              </div>
              <div className="view-switcher" aria-label="视图模式">
                <button
                  className={viewMode === "source" ? "is-active" : ""}
                  type="button"
                  onClick={() => setViewMode("source")}
                  title="源码模式"
                >
                  <Code2 size={15} />
                </button>
                <button
                  className={viewMode === "split" ? "is-active" : ""}
                  type="button"
                  onClick={() => setViewMode("split")}
                  title="分栏模式"
                >
                  <Columns2 size={15} />
                </button>
                <button
                  className={viewMode === "read" ? "is-active" : ""}
                  type="button"
                  onClick={() => setViewMode("read")}
                  title="阅读模式"
                >
                  <Eye size={15} />
                </button>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => setInspectorOpen((value) => !value)}
                aria-label="切换信息栏"
              >
                <PanelRightClose size={17} />
              </button>
              <button className="icon-button" type="button" aria-label="更多操作" onClick={deleteActiveNote}>
                <MoreHorizontal size={18} />
              </button>
            </div>
          </div>

          <div className="document-scroll">
            <article className="document-paper">
              <header className="document-header">
                <div className="document-meta">
                  <span>{activeNote.folder}</span>
                  <span>更新于 {formatTime(activeNote.updatedAt)}</span>
                  <span>{countWords(activeNote.content).toLocaleString("zh-CN")} 字</span>
                </div>
                <input
                  className="document-title"
                  value={activeNote.title}
                  onChange={(event) => updateTitle(event.target.value)}
                  aria-label="文档标题"
                />
                <div className="tag-line">
                  {activeNote.tags.map((tag) => (
                    <span className="tag-pill" key={tag}>
                      <Tag size={12} />
                      {tag}
                    </span>
                  ))}
                  <button type="button" onClick={() => {
                    const tag = window.prompt("添加标签");
                    if (tag?.trim()) {
                      updateActiveNote({ tags: [...new Set([...activeNote.tags, tag.trim()])] });
                    }
                  }}>
                    <CirclePlus size={12} /> 标签
                  </button>
                </div>
              </header>

              <div className="editor-toolbar" role="toolbar" aria-label="Markdown 编辑工具">
                <button type="button" onClick={() => insertAtCursor("**", "**", "重点文字")} title="加粗">
                  <Bold size={15} />
                </button>
                <button type="button" onClick={() => insertAtCursor("_", "_", "强调文字")} title="斜体">
                  <Italic size={15} />
                </button>
                <button type="button" onClick={() => insertAtCursor("## ", "", "二级标题")} title="标题">
                  <Heading2 size={15} />
                </button>
                <button type="button" onClick={() => insertAtCursor("- ", "", "列表项")} title="列表">
                  <List size={15} />
                </button>
                <button type="button" onClick={() => insertAtCursor("[", "](https://)", "链接文字")} title="链接">
                  <Link2 size={15} />
                </button>
                <span className="toolbar-separator" />
                <button className="toolbar-with-label" type="button" onClick={insertMermaid}>
                  <Network size={15} /> Mermaid
                </button>
                <button className="toolbar-with-label" type="button" onClick={insertCanvas}>
                  <ImagePlus size={15} /> 画布
                </button>
                <span className="toolbar-spacer" />
                <span className="autosave-note">
                  <span className="shortcut-dot" /> Markdown 自动保存
                </span>
              </div>

              <div className={`editor-surface mode-${viewMode}`}>
                {viewMode !== "read" && (
                  <section className="source-pane">
                    <div className="pane-caption">
                      <span>MARKDOWN</span>
                      <span>UTF-8</span>
                    </div>
                    <textarea
                      ref={textareaRef}
                      className="markdown-source"
                      value={activeNote.content}
                      onChange={(event) => updateActiveNote({ content: event.target.value })}
                      spellCheck={false}
                      aria-label="Markdown 源码"
                    />
                  </section>
                )}
                {viewMode !== "source" && (
                  <section className="preview-pane">
                    <div className="pane-caption">
                      <span>PREVIEW</span>
                      <span className="preview-live">
                        <span /> LIVE
                      </span>
                    </div>
                    <div
                      ref={previewRef}
                      className="markdown-preview"
                      onClick={handlePreviewClick}
                      dangerouslySetInnerHTML={{ __html: previewHtml }}
                    />
                  </section>
                )}
              </div>

              <footer className="document-footer">
                <span>
                  <HardDrive size={13} /> {activeNote.filePath}
                </span>
                <span>Markdown · UTF-8</span>
                <span>{countWords(activeNote.content).toLocaleString("zh-CN")} 字</span>
              </footer>
            </article>
          </div>
        </main>

        <aside className={`inspector ${inspectorOpen ? "" : "is-collapsed"}`}>
          <div className="inspector-head">
            <strong>文档信息</strong>
            <button className="icon-button" type="button" onClick={() => setInspectorOpen(false)}>
              <X size={16} />
            </button>
          </div>

          <section className="inspector-section">
            <div className="inspector-title">
              <BookOpen size={15} />
              大纲
            </div>
            <nav className="outline-list">
              {outline.map((item, index) => (
                <button
                  key={`${item.id}-${index}`}
                  type="button"
                  className={`depth-${item.depth}`}
                  onClick={() =>
                    previewRef.current
                      ?.querySelector(`#${CSS.escape(item.id)}`)
                      ?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }
                >
                  {item.text}
                </button>
              ))}
            </nav>
          </section>

          <section className="inspector-section">
            <div className="inspector-title">
              <GitBranch size={15} />
              反向链接
              <span className="count-badge">{backlinks.length}</span>
            </div>
            {backlinks.length > 0 ? (
              <div className="backlink-list">
                {backlinks.map((note) => (
                  <button type="button" key={note.id} onClick={() => selectNote(note.id)}>
                    <span>{note.title}</span>
                    <ArrowUpRight size={13} />
                  </button>
                ))}
              </div>
            ) : (
              <p className="empty-note">暂时没有其他文档引用此页。</p>
            )}
          </section>

          <section className="inspector-section">
            <div className="inspector-title">
              <ImagePlus size={15} />
              图表资产
            </div>
            <div className="asset-list">
              <button type="button" onClick={openCanvas}>
                <span className="asset-icon canvas-asset">
                  <ImagePlus size={15} />
                </span>
                <span>
                  <strong>{activeNote.canvas?.title ?? "自由画布"}</strong>
                  <small>{activeNote.canvas?.elements.length ?? 0} 个图元 · 可编辑</small>
                </span>
              </button>
              <div className="asset-row">
                <span className="asset-icon mermaid-asset">
                  <Network size={15} />
                </span>
                <span>
                  <strong>Mermaid 文本图</strong>
                  <small>内嵌在 Markdown</small>
                </span>
              </div>
            </div>
          </section>

          <section className="inspector-section">
            <div className="inspector-title">
              <History size={15} />
              最近版本
            </div>
            <div className="version-list">
              <button type="button">
                <span className="version-dot is-current" />
                <span>
                  <strong>当前版本</strong>
                  <small>{formatTime(activeNote.updatedAt)} · 自动保存</small>
                </span>
              </button>
              <button type="button">
                <span className="version-dot" />
                <span>
                  <strong>编辑前快照</strong>
                  <small>今天 13:58 · 本机</small>
                </span>
              </button>
            </div>
          </section>
        </aside>
      </div>

      {canvasOpen && (
        <CanvasEditor
          scene={activeNote.canvas}
          onCancel={() => setCanvasOpen(false)}
          onSave={saveCanvas}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

export default App;
