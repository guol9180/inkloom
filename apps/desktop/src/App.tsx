import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { renderMarkdown, renderMermaidBlocks } from "@inkloom/diagrams";
import { countWords, type MarkdownViewMode } from "@inkloom/editor";
import {
  workspacePath,
  type DocumentSnapshot,
  type WorkspaceNode
} from "@inkloom/core";
import {
  createTauriFolderAdapter,
  type TauriWorkspaceInfo
} from "@inkloom/storage";
import { brand } from "@inkloom/ui";

const adapter = createTauriFolderAdapter({
  invoke: (command, args) => invoke(command, args),
  listen: (event, listener) =>
    listen(event, (message) => listener({ payload: message.payload }))
});

type SaveState = "saved" | "saving" | "conflict" | "error";

export default function App() {
  const [workspace, setWorkspace] = useState<TauriWorkspaceInfo | null>(null);
  const [tree, setTree] = useState<WorkspaceNode | null>(null);
  const [document, setDocument] = useState<DocumentSnapshot | null>(null);
  const [draft, setDraft] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [message, setMessage] = useState("");
  const [externalChange, setExternalChange] = useState(false);
  const [viewMode, setViewMode] = useState<MarkdownViewMode>("split");
  const previewRef = useRef<HTMLDivElement>(null);
  const documentRef = useRef<DocumentSnapshot | null>(null);
  const dirtyRef = useRef(false);
  const lastWriteAt = useRef(0);

  const previewHtml = useMemo(() => renderMarkdown(draft), [draft]);

  useEffect(() => {
    documentRef.current = document;
  }, [document]);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    let cancelled = false;
    void renderMermaidBlocks(previewRef.current, () => cancelled);
    return () => {
      cancelled = true;
    };
  }, [previewHtml]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void (async () => {
      const current = await adapter.currentWorkspace();
      if (current) {
        setWorkspace(current);
        await refreshTree();
      }
      unlisten = await adapter.subscribeWorkspaceChanges(() => {
        if (Date.now() - lastWriteAt.current < 900) return;
        void refreshTree();
        if (dirtyRef.current && documentRef.current) {
          setExternalChange(true);
        } else if (documentRef.current) {
          void loadDocument(documentRef.current.meta.id, false);
        }
      });
    })().catch((error) => {
      showError(error);
    });

    return () => {
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!dirty || !document) return;
    setSaveState("saving");
    const timer = window.setTimeout(async () => {
      try {
        lastWriteAt.current = Date.now();
        const next = await adapter.writeDocument({
          documentId: document.meta.id,
          baseRevision: document.meta.revision,
          markdown: draft
        });
        lastWriteAt.current = Date.now();
        setDocument(next);
        setDraft(next.markdown);
        setDirty(false);
        setSaveState("saved");
        await refreshTree();
      } catch (error) {
        const failure = error as { code?: string };
        setSaveState(
          failure.code === "REVISION_CONFLICT" ? "conflict" : "error"
        );
        setMessage(
          failure.code === "REVISION_CONFLICT"
            ? "文件已被外部修改。请刷新后再继续，当前草稿仍保留在编辑区。"
            : String(error)
        );
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [draft, dirty, document]);

  async function selectWorkspace() {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "打开 InkLoom 工作区"
      });
      if (typeof selected !== "string") return;
      const workspaceInfo = await adapter.openWorkspace(selected);
      setWorkspace(workspaceInfo);
      setDocument(null);
      setDraft("");
      setDirty(false);
      setExternalChange(false);
      await refreshTree();
    } catch (error) {
      showError(error);
    }
  }

  async function refreshTree() {
    const nextTree = await adapter.listTree();
    setTree(nextTree);
    return nextTree;
  }

  async function loadDocument(documentId: string, discardDraft = true) {
    if (!discardDraft && dirtyRef.current) {
      setExternalChange(true);
      return;
    }
    try {
      const next = await adapter.readDocument(documentId);
      setDocument(next);
      setDraft(next.markdown);
      setDirty(false);
      setSaveState("saved");
      setExternalChange(false);
      setMessage("");
    } catch (error) {
      showError(error);
    }
  }

  async function createDocument() {
    if (!workspace) return;
    const stamp = new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, "")
      .slice(0, 14);
    const title = "未命名文档";
    try {
      const next = await adapter.createDocument({
        workspaceId: workspace.root,
        path: workspacePath(`个人/${title}-${stamp}.md`),
        title,
        markdown: `# ${title}\n\n从这里开始记录。\n`
      });
      await refreshTree();
      setDocument(next);
      setDraft(next.markdown);
      setDirty(false);
      setMessage("已创建真实 Markdown 文件");
    } catch (error) {
      showError(error);
    }
  }

  function updateDraft(value: string) {
    setDraft(value);
    setDirty(true);
    setMessage("");
  }

  function updateTitle(title: string) {
    const next = /^#\s.+/m.test(draft)
      ? draft.replace(/^#\s.+$/m, `# ${title}`)
      : `# ${title}\n\n${draft}`;
    updateDraft(next);
  }

  function showError(error: unknown) {
    setSaveState("error");
    setMessage(error instanceof Error ? error.message : String(error));
  }

  if (!workspace) {
    return (
      <main className="welcome">
        <div className="welcome-card">
          <span className="eyebrow">{brand.productName}</span>
          <h1>把普通文件夹变成可编辑的知识库</h1>
          <p>
            选择一个文件夹。每篇正文都会以 UTF-8 Markdown
            保存，数据库以后只负责索引与版本。
          </p>
          <button className="primary" type="button" onClick={selectWorkspace}>
            打开工作区
          </button>
          {message && <p className="error">{message}</p>}
        </div>
      </main>
    );
  }

  return (
    <div className="desktop-shell">
      <header className="topbar">
        <div>
          <span className="eyebrow">{brand.productName}</span>
          <strong>{workspace.name}</strong>
        </div>
        <div className="top-actions">
          <span className={`save-state state-${saveState}`}>
            {saveState === "saving"
              ? "保存中"
              : saveState === "saved"
                ? "已写入磁盘"
                : "需要处理"}
          </span>
          <button type="button" onClick={createDocument}>
            新建文档
          </button>
          <button type="button" onClick={selectWorkspace}>
            切换工作区
          </button>
        </div>
      </header>

      {externalChange && (
        <div className="notice">
          检测到磁盘中的文件发生变化。当前草稿尚未覆盖。
          <button
            type="button"
            onClick={() => document && loadDocument(document.meta.id)}
          >
            刷新当前文档
          </button>
        </div>
      )}
      {message && <div className="notice">{message}</div>}

      <div className="workspace-grid">
        <aside className="tree-panel">
          <div className="panel-caption">WORKSPACE</div>
          {tree ? (
            <Tree
              node={tree}
              activeId={document?.meta.id}
              onSelect={(id) => {
                if (
                  dirty &&
                  !window.confirm(
                    "当前草稿尚未保存，切换文档会丢弃草稿。继续？"
                  )
                ) {
                  return;
                }
                void loadDocument(id);
              }}
            />
          ) : (
            <p className="muted">正在读取目录…</p>
          )}
        </aside>

        <main className="editor-panel">
          {document ? (
            <>
              <div className="document-head">
                <input
                  aria-label="文档标题"
                  value={document.meta.title}
                  onChange={(event) => updateTitle(event.target.value)}
                />
                <div className="document-meta">
                  <span>{document.meta.path}</span>
                  <span>{countWords(draft)} 字</span>
                  <div className="view-switcher">
                    {(["source", "split", "read"] as const).map((mode) => (
                      <button
                        className={viewMode === mode ? "is-active" : ""}
                        key={mode}
                        type="button"
                        onClick={() => setViewMode(mode)}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className={`editor-surface mode-${viewMode}`}>
                {viewMode !== "read" && (
                  <textarea
                    aria-label="Markdown 源码"
                    spellCheck={false}
                    value={draft}
                    onChange={(event) => updateDraft(event.target.value)}
                  />
                )}
                {viewMode !== "source" && (
                  <div
                    ref={previewRef}
                    className="preview"
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="empty-editor">
              <h2>从左侧打开一篇 Markdown</h2>
              <p>文件会直接读写当前工作区，不经过浏览器 localStorage。</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function Tree({
  node,
  activeId,
  onSelect,
  depth = 0
}: {
  node: WorkspaceNode;
  activeId?: string;
  onSelect: (documentId: string) => void;
  depth?: number;
}) {
  if (node.kind === "document") {
    return (
      <button
        className={`tree-document ${activeId === node.id ? "is-active" : ""}`}
        style={{ paddingLeft: `${14 + depth * 14}px` }}
        type="button"
        onClick={() => onSelect(node.id)}
      >
        <span className="file-mark">MD</span>
        {node.meta.title}
      </button>
    );
  }

  return (
    <section className="tree-folder">
      {depth > 0 && (
        <div
          className="tree-folder-label"
          style={{ paddingLeft: `${14 + (depth - 1) * 14}px` }}
        >
          {node.name}
        </div>
      )}
      {node.children.map((child) => (
        <Tree
          key={`${child.kind}:${child.id}`}
          node={child}
          activeId={activeId}
          onSelect={onSelect}
          depth={depth + 1}
        />
      ))}
    </section>
  );
}
