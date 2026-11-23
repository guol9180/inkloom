export type CanvasBlockAttrs = {
  id: string;
  title: string;
  sceneHash: string;
  previewHash: string;
};

const ASSET_HASH_PATTERN = "[a-f0-9]{64}";
const SCENE_REFERENCE = new RegExp(
  `^assets\\/(${ASSET_HASH_PATTERN})\\.excalidraw$`,
  "i"
);
const PREVIEW_REFERENCE = new RegExp(
  `^assets\\/(${ASSET_HASH_PATTERN})\\.svg$`,
  "i"
);
const CANVAS_BLOCK_PATTERN =
  /^<!--\s*inkloom:canvas\s*\n([\s\S]*?)-->\s*\n!\[([^\]]*)\]\(([^)]+)\)\s*\n<!--\s*\/inkloom:canvas\s*-->$/;

export function isCanvasBlockAttrs(value: unknown): value is CanvasBlockAttrs {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<CanvasBlockAttrs>;
  return (
    typeof record.id === "string" &&
    Boolean(record.id.trim()) &&
    typeof record.title === "string" &&
    Boolean(record.title.trim()) &&
    typeof record.sceneHash === "string" &&
    SCENE_REFERENCE.test(`assets/${record.sceneHash}.excalidraw`) &&
    typeof record.previewHash === "string" &&
    PREVIEW_REFERENCE.test(`assets/${record.previewHash}.svg`)
  );
}

export function serializeCanvasBlock(attrs: CanvasBlockAttrs): string {
  if (!isCanvasBlockAttrs(attrs)) {
    throw new Error("画布块属性无效。");
  }
  const title = attrs.title.replace(/\s+/g, " ").trim();
  return [
    "<!-- inkloom:canvas",
    `id: ${attrs.id}`,
    `title: ${title}`,
    `scene: assets/${attrs.sceneHash}.excalidraw`,
    `preview: assets/${attrs.previewHash}.svg`,
    "-->",
    "",
    `![${escapeImageAlt(title)}](assets/${attrs.previewHash}.svg)`,
    "",
    "<!-- /inkloom:canvas -->"
  ].join("\n");
}

export function parseCanvasBlock(value: string): CanvasBlockAttrs | undefined {
  const match = value.trim().match(CANVAS_BLOCK_PATTERN);
  if (!match) return undefined;
  const values = new Map<string, string>();
  for (const line of (match[1] ?? "").split(/\r?\n/)) {
    const entry = line.match(/^\s*([a-z][a-z0-9_-]*):\s*(.*?)\s*$/i);
    const key = entry?.[1];
    const value = entry?.[2];
    if (key && value !== undefined) values.set(key.toLowerCase(), value);
  }
  const id = values.get("id");
  const title = values.get("title");
  const sceneHash = values.get("scene")?.match(SCENE_REFERENCE)?.[1];
  const previewHash =
    values.get("preview")?.match(PREVIEW_REFERENCE)?.[1] ??
    (match[3] ?? "").match(PREVIEW_REFERENCE)?.[1];
  if (!id || !title || !sceneHash || !previewHash) return undefined;
  return {
    id,
    title,
    sceneHash: sceneHash.toLowerCase(),
    previewHash: previewHash.toLowerCase()
  };
}

function escapeImageAlt(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("]", "\\]");
}
