import DOMPurify from "dompurify";

export type CanvasScene = {
  title: string;
  elements: readonly Record<string, unknown>[];
};

export type CanvasEditorData = {
  elements: readonly Record<string, unknown>[];
  appState?: Record<string, unknown>;
  files?: Record<string, unknown>;
};

export type CanvasAssetExport = {
  sceneJson: string;
  svg: string;
};

type ExcalidrawModule = typeof import("@excalidraw/excalidraw");

let excalidrawModule: Promise<ExcalidrawModule> | undefined;

export function loadExcalidrawModule(): Promise<ExcalidrawModule> {
  excalidrawModule ??= import("@excalidraw/excalidraw");
  return excalidrawModule;
}

export function normalizeCanvasElements(
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
      strokeColor: String(element.strokeColor ?? "#26332d"),
      backgroundColor: String(element.backgroundColor ?? "transparent"),
      fillStyle: String(element.fillStyle ?? "solid"),
      strokeWidth: Number(element.strokeWidth ?? 2),
      strokeStyle: String(element.strokeStyle ?? "solid"),
      roundness:
        type === "rectangle"
          ? ((element.roundness as Record<string, unknown> | null) ?? {
              type: 3
            })
          : null,
      roughness: Number(element.roughness ?? 1),
      opacity: Number(element.opacity ?? 100),
      width,
      height,
      angle: Number(element.angle ?? 0),
      seed: Number(element.seed ?? 1000 + index),
      version: Number(element.version ?? 1),
      versionNonce: Number(element.versionNonce ?? 2000 + index),
      index: element.index ?? null,
      isDeleted: Boolean(element.isDeleted ?? false),
      groupIds: Array.isArray(element.groupIds) ? element.groupIds : [],
      frameId: element.frameId ?? null,
      boundElements: element.boundElements ?? null,
      updated: Number(element.updated ?? now),
      link: element.link ?? null,
      locked: Boolean(element.locked ?? false)
    };

    if (type === "arrow" || type === "line") {
      return {
        ...common,
        type,
        points: Array.isArray(element.points)
          ? element.points
          : [
              [0, 0],
              [width, height]
            ],
        lastCommittedPoint: element.lastCommittedPoint ?? null,
        startBinding: element.startBinding ?? null,
        endBinding: element.endBinding ?? null,
        startArrowhead: element.startArrowhead ?? null,
        endArrowhead:
          element.endArrowhead ?? (type === "arrow" ? "arrow" : null),
        elbowed: Boolean(element.elbowed ?? false)
      };
    }

    if (type === "text") {
      const text = String(element.text ?? "文字");
      return {
        ...common,
        type: "text",
        text,
        originalText: String(element.originalText ?? text),
        fontSize: Number(element.fontSize ?? 20),
        fontFamily: Number(element.fontFamily ?? 1),
        textAlign: String(element.textAlign ?? "left"),
        verticalAlign: String(element.verticalAlign ?? "top"),
        containerId: element.containerId ?? null,
        autoResize: Boolean(element.autoResize ?? true),
        lineHeight: Number(element.lineHeight ?? 1.25)
      };
    }

    return common;
  });
}

export function canvasEditorData(
  scene?: CanvasEditorData
): {
  elements: readonly Record<string, unknown>[];
  appState: Record<string, unknown>;
  files: Record<string, unknown>;
} {
  return {
    elements: normalizeCanvasElements(scene?.elements ?? []),
    appState: {
      viewBackgroundColor: "#fafbf9",
      currentItemStrokeColor: "#26332d",
      currentItemBackgroundColor: "#edf3ef",
      ...(scene?.appState ?? {})
    },
    files: scene?.files ?? {}
  };
}

export async function exportCanvasAssets(
  scene?: CanvasEditorData
): Promise<CanvasAssetExport> {
  const module = await loadExcalidrawModule();
  const data = canvasEditorData(scene);
  const elements = data.elements as never;
  const appState = data.appState as never;
  const files = data.files as never;
  const sceneJson = module.serializeAsJSON(
    elements,
    appState,
    files,
    "local"
  );
  const svgElement = await module.exportToSvg({
    elements: (data.elements as Array<Record<string, unknown>>).filter(
      (element) => !element.isDeleted
    ) as never,
    appState: {
      ...data.appState,
      exportBackground: true,
      viewBackgroundColor: "#fafbf9"
    } as never,
    files
  });
  const serialized = new XMLSerializer().serializeToString(svgElement);
  return {
    sceneJson,
    svg: DOMPurify.sanitize(serialized, {
      USE_PROFILES: {
        svg: true,
        svgFilters: true
      }
    })
  };
}

export async function serializeCanvasEditorData(
  scene?: CanvasEditorData
): Promise<string> {
  const module = await loadExcalidrawModule();
  const data = canvasEditorData(scene);
  return module.serializeAsJSON(
    data.elements as never,
    data.appState as never,
    data.files as never,
    "local"
  );
}

export function parseCanvasSceneFile(value: string): CanvasEditorData {
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("画布场景格式无效。");
  }
  const record = parsed as {
    elements?: unknown;
    appState?: unknown;
    files?: unknown;
  };
  if (!Array.isArray(record.elements)) {
    throw new Error("画布场景缺少图元。");
  }
  return {
    elements: record.elements.filter(
      (element): element is Record<string, unknown> =>
        Boolean(element) && typeof element === "object"
    ),
    appState:
      record.appState && typeof record.appState === "object"
        ? (record.appState as Record<string, unknown>)
        : undefined,
    files:
      record.files && typeof record.files === "object"
        ? (record.files as Record<string, unknown>)
        : undefined
  };
}
