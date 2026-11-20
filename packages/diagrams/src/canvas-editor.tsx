import {
  Suspense,
  lazy,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  canvasEditorData,
  exportCanvasAssets,
  loadExcalidrawModule,
  serializeCanvasEditorData,
  type CanvasAssetExport,
  type CanvasEditorData
} from "./canvas-assets";

const LazyExcalidraw = lazy(async () => {
  const [module] = await Promise.all([
    loadExcalidrawModule(),
    import("@excalidraw/excalidraw/index.css")
  ]);
  return { default: module.Excalidraw };
});

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
  title,
  notice,
  onCancel,
  onSave,
  onSnapshot
}: {
  scene?: CanvasEditorData;
  title: string;
  notice?: string;
  onCancel: () => void;
  onSave: (result: CanvasAssetExport) => Promise<void>;
  onSnapshot?: (sceneJson: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const dataRef = useRef<CanvasEditorData>(scene ?? { elements: [] });
  const onSnapshotRef = useRef(onSnapshot);
  onSnapshotRef.current = onSnapshot;
  const initialData = useMemo(
    () => canvasEditorData(scene) as never,
    [scene]
  );

  useEffect(() => {
    let cancelled = false;
    const timer = window.setInterval(() => {
      void serializeCanvasEditorData(dataRef.current)
        .then((sceneJson) => {
          if (!cancelled) onSnapshotRef.current?.(sceneJson);
        })
        .catch(() => undefined);
    }, 2_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  async function save() {
    setSaving(true);
    setSaveError("");
    try {
      await onSave(await exportCanvasAssets(dataRef.current));
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "画布保存失败，请重试。"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="canvas-modal" role="dialog" aria-modal="true" aria-label="Excalidraw 画布">
      <div className="canvas-modal-head">
        <div>
          <span className="section-label">EXCALIDRAW 场景</span>
          <strong>{title}</strong>
        </div>
        <div className="canvas-modal-actions">
          <span className="canvas-save-note">
            {saveError || notice || "每 2 秒保存临时快照"}
          </span>
          <button
            className="top-action secondary-action"
            type="button"
            onClick={onCancel}
            disabled={saving}
          >
            稍后继续
          </button>
          <button
            className="top-action"
            type="button"
            onClick={() => void save()}
            disabled={saving}
          >
            <CheckIcon /> {saving ? "正在保存…" : "保存并关闭"}
          </button>
        </div>
      </div>
      <div className="excalidraw-shell">
        <Suspense fallback={<div className="canvas-loading">正在加载画布引擎…</div>}>
          <LazyExcalidraw
            initialData={initialData}
            onChange={(elements, appState, files) => {
              dataRef.current = {
                elements: elements as unknown as readonly Record<
                  string,
                  unknown
                >[],
                appState: appState as unknown as Record<string, unknown>,
                files: files as unknown as Record<string, unknown>
              };
            }}
          />
        </Suspense>
      </div>
    </div>
  );
}
