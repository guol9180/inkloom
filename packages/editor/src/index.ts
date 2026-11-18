import type { DocumentId } from "@inkloom/core";

export type EditorMode = "rich" | "source" | "split" | "read";
export type MarkdownViewMode = Exclude<EditorMode, "rich">;

export interface MarkdownEditorController {
  documentId: DocumentId;
  getMarkdown(): string;
  setMode(mode: EditorMode): void;
  focus(): void;
  dispose(): void;
}

export interface MarkdownView {
  readonly mode: MarkdownViewMode;
  setMarkdown(markdown: string): void;
  getMarkdown(): string;
  focusSource(): void;
}

export type MarkdownHeading = {
  depth: number;
  id: string;
  text: string;
};

export function stripMarkdown(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_~|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugifyHeading(value: string): string {
  return stripMarkdown(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");
}

export function extractHeadings(markdown: string): MarkdownHeading[] {
  return [...markdown.matchAll(/^(#{1,3})\s+(.+)$/gm)].map((match) => {
    const text = match[2].replace(/[*_`~]/g, "");
    return {
      depth: match[1].length,
      text,
      id: slugifyHeading(text)
    };
  });
}

export function countWords(markdown: string): number {
  const plain = stripMarkdown(markdown);
  const cjk = plain.match(/[\u3400-\u9fff]/g)?.length ?? 0;
  const latin = plain.replace(/[\u3400-\u9fff]/g, " ").match(/[A-Za-z0-9]+/g)?.length ?? 0;
  return cjk + latin;
}
