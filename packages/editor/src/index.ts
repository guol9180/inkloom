import type { DocumentId } from "@inkloom/core";

export type EditorMode = "rich" | "source" | "split" | "read";

export interface MarkdownEditorController {
  documentId: DocumentId;
  getMarkdown(): string;
  setMode(mode: EditorMode): void;
  focus(): void;
  dispose(): void;
}
