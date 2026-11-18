import {
  Suspense,
  lazy,
  useMemo,
  useRef
} from "react";
import "@excalidraw/excalidraw/index.css";
import type { CanvasScene } from "./markdown";

const LazyExcalidraw = lazy(async () => {
  const module = await import("@excalidraw/excalidraw");
  return { default: module.Excalidraw };
});

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

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m20 6-11 11-5-5" />
    </svg>
  );
}

export function CanvasEditor({
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
            <CheckIcon /> 保存画布
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
