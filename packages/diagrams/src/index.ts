export type DiagramKind = "mermaid" | "excalidraw";

export type DiagramAssetRef = {
  id: string;
  kind: DiagramKind;
  scenePath?: string;
  previewPath?: string;
  source?: string;
};

export * from "./canvas-editor";
export * from "./canvas-assets";
export * from "./markdown";
export * from "./mermaid";
