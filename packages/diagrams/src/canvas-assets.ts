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
  const sceneJson = serializeSceneJson(module, data);
  let serialized: string;
  try {
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
    serialized = new XMLSerializer().serializeToString(svgElement);
  } catch {
    // Saving the scene must not depend on Excalidraw's browser SVG exporter.
    serialized = fallbackCanvasPreviewSvg(data);
  }
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
  return serializeSceneJson(module, data);
}

function serializeSceneJson(
  module: ExcalidrawModule,
  data: ReturnType<typeof canvasEditorData>
): string {
  try {
    return module.serializeAsJSON(
      data.elements as never,
      data.appState as never,
      data.files as never,
      "local"
    );
  } catch {
    return JSON.stringify({
      type: "excalidraw",
      version: 2,
      source: "inkloom",
      elements: data.elements,
      appState: data.appState,
      files: data.files
    });
  }
}

export function fallbackCanvasPreviewSvg(
  data: ReturnType<typeof canvasEditorData>
): string {
  const elements = data.elements.filter((element) => !element.isDeleted);
  const content =
    elements.length === 0
      ? `
        <path d="M 120 250 C 260 80, 420 300, 580 155 S 900 95, 1080 230"
          fill="none" stroke="#98aaa5" stroke-width="3" stroke-dasharray="9 10"/>
        <circle cx="580" cy="155" r="7" fill="#a56827"/>
        <text x="600" y="205" text-anchor="middle" fill="#61706d"
          font-family="sans-serif" font-size="24">Excalidraw 空白画布</text>`
      : elements.map(renderFallbackElement).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 720" role="img" aria-label="Excalidraw 画布">
    <rect width="1200" height="720" fill="#fafbf9"/>
    ${content}
  </svg>`;
}

function renderFallbackElement(
  element: Record<string, unknown>,
  index: number
): string {
  const x = finiteNumber(element.x, 40 + index * 18);
  const y = finiteNumber(element.y, 40 + index * 18);
  const width = Math.max(1, finiteNumber(element.width, 140));
  const height = Math.max(1, finiteNumber(element.height, 90));
  const stroke = escapeXmlAttribute(
    String(element.strokeColor ?? "#26332d")
  );
  const fill = escapeXmlAttribute(
    String(element.backgroundColor ?? "transparent")
  );
  const type = String(element.type ?? "rectangle");
  if (type === "ellipse") {
    return `<ellipse cx="${x + width / 2}" cy="${y + height / 2}" rx="${width / 2}" ry="${height / 2}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
  }
  if (type === "diamond") {
    return `<polygon points="${x + width / 2},${y} ${x + width},${y + height / 2} ${x + width / 2},${y + height} ${x},${y + height / 2}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
  }
  if (type === "text") {
    return `<text x="${x}" y="${y + Math.max(24, height / 2)}" fill="${escapeXmlAttribute(String(element.strokeColor ?? "#26332d"))}" font-family="sans-serif" font-size="${Math.max(12, finiteNumber(element.fontSize, 20))}">${escapeXmlText(String(element.text ?? ""))}</text>`;
  }
  if (type === "arrow" || type === "line") {
    const points = Array.isArray(element.points) ? element.points : [];
    const end = points.at(-1);
    const endX =
      Array.isArray(end) && Number.isFinite(Number(end[0]))
        ? x + Number(end[0])
        : x + width;
    const endY =
      Array.isArray(end) && Number.isFinite(Number(end[1]))
        ? y + Number(end[1])
        : y + height;
    return `<line x1="${x}" y1="${y}" x2="${endX}" y2="${endY}" stroke="${stroke}" stroke-width="2"/>`;
  }
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
}

function finiteNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function escapeXmlText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeXmlAttribute(value: string): string {
  return escapeXmlText(value)
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
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
