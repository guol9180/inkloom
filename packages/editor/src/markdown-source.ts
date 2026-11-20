import type { RootContent } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { mathFromMarkdown } from "mdast-util-math";
import { gfm } from "micromark-extension-gfm";
import { math } from "micromark-extension-math";

export type MarkdownSourceBlock = {
  id: string;
  type: string;
  source: string;
  startOffset: number;
  endOffset: number;
  startLine: number;
  endLine: number;
  protected: boolean;
};

export type MarkdownSourceDiagnostic = {
  code: "PARSE_FAILED";
  message: string;
};

export type MarkdownSourceDocument = {
  source: string;
  blocks: readonly MarkdownSourceBlock[];
  diagnostics: readonly MarkdownSourceDiagnostic[];
};

export type MarkdownBlockReplacements =
  | ReadonlyMap<string, string>
  | Readonly<Record<string, string>>;

const PROTECTED_NODE_TYPES = new Set([
  "code",
  "definition",
  "footnoteDefinition",
  "html"
]);

export function parseMarkdownSource(source: string): MarkdownSourceDocument {
  const blocks: MarkdownSourceBlock[] = [];
  const diagnostics: MarkdownSourceDiagnostic[] = [];
  const frontmatter = readFrontmatter(source);
  let bodyStart = 0;

  if (frontmatter) {
    blocks.push(
      createBlock(
        source,
        "frontmatter",
        0,
        frontmatter.endOffset,
        true,
        blocks.length
      )
    );
    bodyStart = frontmatter.endOffset;
  }

  const body = source.slice(bodyStart);
  let children: RootContent[] = [];
  try {
    children = fromMarkdown(body, {
      extensions: [gfm(), math()],
      mdastExtensions: [gfmFromMarkdown(), mathFromMarkdown()]
    }).children;
  } catch (error) {
    diagnostics.push({
      code: "PARSE_FAILED",
      message: error instanceof Error ? error.message : String(error)
    });
    if (body.length > 0) {
      blocks.push(
        createBlock(
          source,
          "raw",
          bodyStart,
          source.length,
          true,
          blocks.length
        )
      );
    }
    return { source, blocks, diagnostics };
  }

  let cursor = bodyStart;
  for (const child of children) {
    const startOffset = bodyStart + (child.position?.start.offset ?? 0);
    const endOffset = bodyStart + (child.position?.end.offset ?? 0);
    if (startOffset > cursor) {
      blocks.push(
        createGapBlock(source, cursor, startOffset, blocks.length)
      );
    }
    blocks.push(
      createBlock(
        source,
        child.type,
        startOffset,
        endOffset,
        PROTECTED_NODE_TYPES.has(child.type),
        blocks.length
      )
    );
    cursor = endOffset;
  }
  if (cursor < source.length) {
    blocks.push(createGapBlock(source, cursor, source.length, blocks.length));
  }

  return { source, blocks, diagnostics };
}

export function serializeMarkdownSource(
  document: MarkdownSourceDocument,
  replacements: MarkdownBlockReplacements = {}
): string {
  const lookup =
    replacements instanceof Map
      ? (id: string) => replacements.get(id)
      : (id: string) =>
          (replacements as Readonly<Record<string, string>>)[id];
  return document.blocks
    .map((block) => lookup(block.id) ?? block.source)
    .join("");
}

export function replaceMarkdownSourceBlock(
  document: MarkdownSourceDocument,
  blockId: string,
  source: string
): MarkdownSourceDocument {
  if (!document.blocks.some((block) => block.id === blockId)) {
    throw new Error(`Unknown Markdown source block: ${blockId}`);
  }
  return {
    ...document,
    blocks: document.blocks.map((block) =>
      block.id === blockId ? { ...block, source } : block
    )
  };
}

export function findMarkdownSourceBlock(
  document: MarkdownSourceDocument,
  offset: number
): MarkdownSourceBlock | undefined {
  return document.blocks.find(
    (block) => offset >= block.startOffset && offset < block.endOffset
  );
}

export function isMarkdownSourceLossless(
  document: MarkdownSourceDocument
): boolean {
  return (
    document.diagnostics.length === 0 &&
    serializeMarkdownSource(document) === document.source
  );
}

function createGapBlock(
  source: string,
  startOffset: number,
  endOffset: number,
  index: number
): MarkdownSourceBlock {
  const text = source.slice(startOffset, endOffset);
  return createBlock(
    source,
    text.trim().length === 0 ? "whitespace" : "raw",
    startOffset,
    endOffset,
    text.trim().length > 0,
    index
  );
}

function createBlock(
  source: string,
  type: string,
  startOffset: number,
  endOffset: number,
  protectedBlock: boolean,
  index: number
): MarkdownSourceBlock {
  return {
    id: `source-${startOffset}-${endOffset}-${index}`,
    type,
    source: source.slice(startOffset, endOffset),
    startOffset,
    endOffset,
    startLine: lineAtOffset(source, startOffset),
    endLine: lineAtOffset(source, Math.max(startOffset, endOffset - 1)),
    protected: protectedBlock
  };
}

function lineAtOffset(source: string, offset: number): number {
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (source.charCodeAt(index) === 10) line += 1;
  }
  return line;
}

function readFrontmatter(
  source: string
): { endOffset: number } | undefined {
  const opening = /^(?:\uFEFF)?(---|\+\+\+)[ \t]*\r?\n/.exec(source);
  if (!opening) return undefined;
  const marker = opening[1];
  const closingPattern = new RegExp(
    `\\r?\\n${escapeRegExp(marker)}[ \\t]*(?:\\r?\\n|$)`,
    "g"
  );
  closingPattern.lastIndex = opening[0].length;
  const closing = closingPattern.exec(source);
  return closing ? { endOffset: closing.index + closing[0].length } : undefined;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
