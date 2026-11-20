import { useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { CanvasBlockAttrs } from "@inkloom/editor";
import { cloudClient } from "../../cloud-workspace";
import type { WorkspaceId } from "@inkloom/core";
import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import type {
  EditorView as ProseEditorView,
  NodeView
} from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";
import {
  ImageOff,
  LoaderCircle,
  Pencil,
  Shapes
} from "lucide-react";

export function createCanvasNodeViewPlugin(
  getWorkspaceId: () => string,
  onOpen: (canvas: CanvasBlockAttrs) => void,
  getReadOnly: () => boolean
) {
  return $prose(
    () =>
      new Plugin({
        key: new PluginKey("INKLOOM_CANVAS_NODE_VIEW"),
        props: {
          nodeViews: {
            inkloom_canvas(node, view, getPos) {
              return new CanvasNodeView(
                node,
                view,
                getPos,
                getWorkspaceId,
                onOpen,
                getReadOnly
              );
            }
          }
        }
      })
  );
}

class CanvasNodeView implements NodeView {
  readonly dom: HTMLElement;
  private node: ProseNode;
  private readonly root: Root;

  constructor(
    node: ProseNode,
    private readonly view: ProseEditorView,
    private readonly getPos: () => number | undefined,
    private readonly getWorkspaceId: () => string,
    private readonly onOpen: (canvas: CanvasBlockAttrs) => void,
    private readonly getReadOnly: () => boolean
  ) {
    this.node = node;
    this.dom = document.createElement("div");
    this.dom.className = "inkloom-canvas-view";
    this.dom.contentEditable = "false";
    this.root = createRoot(this.dom);
    this.render();
  }

  update(node: ProseNode) {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.render();
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

  private render() {
    const attrs = canvasAttrs(this.node);
    this.root.render(
      <CanvasBlock
        canvas={attrs}
        workspaceId={this.getWorkspaceId()}
        readOnly={this.getReadOnly()}
        onOpen={() => this.onOpen(attrs)}
      />
    );
  }
}

export function canvasAttrs(node: ProseNode): CanvasBlockAttrs {
  return {
    id: String(node.attrs.id ?? ""),
    title: String(node.attrs.title ?? "自由画布"),
    sceneHash: String(node.attrs.sceneHash ?? ""),
    previewHash: String(node.attrs.previewHash ?? "")
  };
}

function CanvasBlock({
  canvas,
  workspaceId,
  readOnly,
  onOpen
}: {
  canvas: CanvasBlockAttrs;
  workspaceId: string;
  readOnly: boolean;
  onOpen: () => void;
}) {
  const [state, setState] = useState<"loading" | "ready" | "missing">(
    "loading"
  );
  const source =
    workspaceId && canvas.previewHash
      ? cloudClient.assetUrl(workspaceId as WorkspaceId, canvas.previewHash)
      : "";

  useEffect(() => {
    setState(source ? "loading" : "missing");
  }, [source]);

  return (
    <section className="inkloom-canvas-card" aria-label={`Excalidraw 画布：${canvas.title}`}>
      <header className="inkloom-canvas-toolbar">
        <div className="inkloom-canvas-title">
          <span className="inkloom-canvas-icon">
            <Shapes size={14} aria-hidden="true" />
          </span>
          <span>{canvas.title}</span>
        </div>
        {!readOnly && (
          <button
            type="button"
            className="inkloom-canvas-edit"
            onClick={onOpen}
            aria-label="编辑画布"
          >
            <Pencil size={13} />
            编辑
          </button>
        )}
      </header>
      <div className="inkloom-canvas-preview" data-state={state}>
        {state === "loading" && (
          <div className="inkloom-canvas-status">
            <LoaderCircle size={18} className="animate-spin" />
            <span>正在加载 SVG 预览</span>
          </div>
        )}
        {state === "missing" && (
          <button
            type="button"
            className="inkloom-canvas-status inkloom-canvas-missing"
            onClick={readOnly ? undefined : onOpen}
            disabled={readOnly}
          >
            <ImageOff size={19} />
            <span>
              {readOnly
                ? "预览资产缺失"
                : "预览资产缺失，点击重新绘制或上传"}
            </span>
          </button>
        )}
        {source && (
          <img
            src={source}
            alt={`${canvas.title}预览`}
            onLoad={() => setState("ready")}
            onError={() => setState("missing")}
          />
        )}
      </div>
    </section>
  );
}
