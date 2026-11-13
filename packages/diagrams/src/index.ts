export type DiagramKind = "mermaid" | "excalidraw";

export type DiagramAssetRef = {
  id: string;
  kind: DiagramKind;
  scenePath?: string;
  previewPath?: string;
  source?: string;
};
