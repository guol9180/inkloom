import type { DocumentId } from "@inkloom/core";
import type { RootContent } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { mathFromMarkdown } from "mdast-util-math";
import { gfm } from "micromark-extension-gfm";
import { math } from "micromark-extension-math";

export * from "./markdown-source";
export * from "./canvas-block";
export * from "./markdown-diff";

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
  offset: number;
  line: number;
  column: number;
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
  const root = fromMarkdown(markdown, {
    extensions: [gfm(), math()],
    mdastExtensions: [gfmFromMarkdown(), mathFromMarkdown()]
  });
  const headings: MarkdownHeading[] = [];
  const usedIds = new Map<string, number>();

  function visit(node: (typeof root)["children"][number]) {
    if (node.type === "heading") {
      const text = markdownNodeText(node).trim();
      const baseId = slugifyHeading(text) || `heading-${headings.length + 1}`;
      const duplicate = usedIds.get(baseId) ?? 0;
      usedIds.set(baseId, duplicate + 1);
      headings.push({
        depth: node.depth,
        text,
        id: duplicate === 0 ? baseId : `${baseId}-${duplicate + 1}`,
        offset: node.position?.start.offset ?? 0,
        line: node.position?.start.line ?? 1,
        column: node.position?.start.column ?? 1
      });
    }
    if ("children" in node) {
      for (const child of node.children) visit(child);
    }
  }

  for (const child of root.children) visit(child);
  return headings;
}

function markdownNodeText(node: RootContent): string {
  if ("value" in node && typeof node.value === "string") return node.value;
  if ("children" in node) {
    return node.children.map((child) => markdownNodeText(child)).join("");
  }
  return "";
}

export function countWords(markdown: string): number {
  const plain = stripMarkdown(markdown);
  const cjk = plain.match(/[\u3400-\u9fff]/g)?.length ?? 0;
  const latin =
    plain.replace(/[\u3400-\u9fff]/g, " ").match(/[A-Za-z0-9]+/g)?.length ?? 0;
  return cjk + latin;
}
