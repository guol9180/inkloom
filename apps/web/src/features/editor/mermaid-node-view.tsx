import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { createRoot, type Root } from "react-dom/client";
import { basicSetup } from "codemirror";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import {
  MERMAID_TEMPLATES,
  matchingMermaidTemplate,
  renderMermaidSvg,
  toMermaidRenderError,
  type MermaidRenderError
} from "@inkloom/diagrams";
import { Fragment, type Node as ProseNode } from "@milkdown/kit/prose/model";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import type {
  EditorView as ProseEditorView,
  NodeView
} from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";
import {
  ChevronDown,
  Maximize2,
  Network,
  TriangleAlert,
  X
} from "lucide-react";
import { FullscreenDialog } from "@inkloom/ui";

const MERMAID_RENDER_DELAY_MS = 300;

export function createMermaidNodeViewPlugin(getReadOnly: () => boolean) {
  return $prose(
    () =>
      new Plugin({
        key: new PluginKey("INKLOOM_MERMAID_NODE_VIEW"),
        props: {
          nodeViews: {
            inkloom_mermaid(node, view, getPos) {
              return new MermaidNodeView(node, view, getPos, getReadOnly);
            }
          }
        }
      })
  );
}

class MermaidNodeView implements NodeView {
  readonly dom: HTMLElement;
  private node: ProseNode;
  private readonly root: Root;

  constructor(
    node: ProseNode,
    private readonly view: ProseEditorView,
    private readonly getPos: () => number | undefined,
    private readonly getReadOnly: () => boolean
  ) {
    this.node = node;
    this.dom = document.createElement("div");
    this.dom.className = "inkloom-mermaid-view";
    this.dom.contentEditable = "false";
    this.root = createRoot(this.dom);
    this.render(node.textContent);
  }

  update(node: ProseNode) {
    if (node.type !== this.node.type) {
      return false;
    }
    this.node = node;
    this.render(node.textContent);
    return true;
  }

  stopEvent() {
    return true;
  }

  ignoreMutation() {
    return true;
  }

  selectNode() {
    this.dom.dataset.selected = "true";
  }

  deselectNode() {
    delete this.dom.dataset.selected;
  }

  destroy() {
    this.root.unmount();
  }

  private render(source: string) {
    this.root.render(
      <MermaidBlock
        source={source}
        readOnly={this.getReadOnly()}
        onSourceChange={this.changeSource}
      />
    );
  }

  private readonly changeSource = (source: string) => {
    if (this.getReadOnly()) return;
    if (source === this.node.textContent) return;
    const position = this.getPos();
    if (position === undefined) return;
    const current = this.view.state.doc.nodeAt(position);
    if (!current) return;
    const content = source ? current.type.schema.text(source) : Fragment.empty;
    const transaction = this.view.state.tr.replaceWith(
      position + 1,
      position + current.nodeSize - 1,
      content
    );
    this.view.dispatch(transaction);
    this.node = transaction.doc.nodeAt(position) ?? current;
  };
}

function MermaidBlock({
  source,
  readOnly,
  onSourceChange
}: {
  source: string;
  readOnly: boolean;
  onSourceChange: (source: string) => void;
}) {
  const [svg, setSvg] = useState("");
  const [rendering, setRendering] = useState(true);
  const [error, setError] = useState<MermaidRenderError>();
  const [fullscreen, setFullscreen] = useState(false);
  const [visible, setVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const selectedTemplate = matchingMermaidTemplate(source);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "320px 0px" }
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if ((!visible && !fullscreen) || !source.trim()) {
      setRendering(false);
      setError(undefined);
      if (!source.trim()) setSvg("");
      return;
    }
    let cancelled = false;
    setRendering(true);
    const timer = window.setTimeout(() => {
      void renderMermaidSvg(source)
        .then((nextSvg) => {
          if (cancelled) return;
          setSvg(nextSvg);
          setError(undefined);
        })
        .catch((renderError: unknown) => {
          if (!cancelled) setError(toMermaidRenderError(renderError));
        })
        .finally(() => {
          if (!cancelled) setRendering(false);
        });
    }, MERMAID_RENDER_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [fullscreen, source, visible]);

  function handleTemplate(event: ChangeEvent<HTMLSelectElement>) {
    const template = MERMAID_TEMPLATES.find(
      (item) => item.id === event.target.value
    );
    if (template) onSourceChange(template.source);
  }

  const content = (
    <section
      ref={sectionRef}
      className={`inkloom-mermaid-panel ${
        fullscreen ? "is-fullscreen" : ""
      } ${readOnly ? "is-readonly" : ""}`}
      aria-label="Mermaid 图表"
    >
      <header className="inkloom-mermaid-toolbar">
        <div className="inkloom-mermaid-title">
          <span className="inkloom-mermaid-icon">
            <Network size={14} aria-hidden="true" />
          </span>
          <span>Mermaid</span>
        </div>
        <div className="inkloom-mermaid-actions">
          {!readOnly && (
            <label className="inkloom-mermaid-template">
              <span className="sr-only">图表模板</span>
              <select
                aria-label="图表模板"
                value={selectedTemplate}
                onChange={handleTemplate}
              >
                {selectedTemplate === "custom" && (
                  <option value="custom">自定义</option>
                )}
                {MERMAID_TEMPLATES.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={12} aria-hidden="true" />
            </label>
          )}
          <button
            type="button"
            className="inkloom-mermaid-icon-button"
            aria-label={fullscreen ? "退出全屏" : "全屏编辑图表"}
            title={fullscreen ? "退出全屏" : "全屏编辑"}
            onClick={() => setFullscreen((current) => !current)}
          >
            {fullscreen ? <X size={14} /> : <Maximize2 size={14} />}
            <span>{fullscreen ? "退出" : "编辑"}</span>
          </button>
        </div>
      </header>

      <div className="inkloom-mermaid-workspace">
        {!readOnly && (
          <div className="inkloom-mermaid-source">
            <span className="inkloom-mermaid-pane-label">源码</span>
            <MermaidSourceEditor value={source} onChange={onSourceChange} />
          </div>
        )}
        <div className="inkloom-mermaid-preview">
          <span className="inkloom-mermaid-pane-label">
            预览
            {rendering && <span className="inkloom-mermaid-rendering" />}
          </span>
          <div className="inkloom-mermaid-canvas">
            {svg ? (
              <div
                className="inkloom-mermaid-svg"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            ) : (
              <div className="inkloom-mermaid-empty">
                <Network size={22} aria-hidden="true" />
                <span>输入 Mermaid 源码后显示图表</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="inkloom-mermaid-error" role="status">
          <TriangleAlert size={14} aria-hidden="true" />
          <span>
            {error.line ? `第 ${error.line} 行：` : ""}
            {error.message}
          </span>
        </div>
      )}
    </section>
  );

  return fullscreen ? (
    <FullscreenDialog
      open
      title="Mermaid 图表编辑"
      description="编辑源码并预览 Mermaid 图表。"
      onClose={() => setFullscreen(false)}
      showClose={false}
    >
      {content}
    </FullscreenDialog>
  ) : (
    content
  );
}

function MermaidSourceEditor({
  value,
  onChange
}: {
  value: string;
  onChange: (source: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | undefined>(undefined);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          keymap.of([...defaultKeymap, indentWithTab]),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({
            "aria-label": "Mermaid 源码",
            spellcheck: "false"
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString());
            }
          }),
          EditorView.theme({
            "&": {
              height: "100%",
              backgroundColor: "transparent"
            },
            ".cm-scroller": {
              overflow: "auto",
              fontFamily:
                "Geist Mono, ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: "12px",
              lineHeight: "1.65"
            },
            ".cm-content": {
              padding: "12px 14px",
              caretColor: "#365d4c"
            },
            ".cm-gutters": {
              border: "0",
              backgroundColor: "transparent",
              color: "#a4aea8"
            },
            ".cm-activeLine, .cm-activeLineGutter": {
              backgroundColor: "#f7f9f6"
            },
            ".cm-focused": {
              outline: "none"
            }
          })
        ]
      })
    });
    viewRef.current = view;
    return () => {
      viewRef.current = undefined;
      view.destroy();
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || value === view.state.doc.toString()) return;
    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: value
      }
    });
  }, [value]);

  return <div ref={hostRef} className="inkloom-mermaid-codemirror" />;
}
