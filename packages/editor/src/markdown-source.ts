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
  ReadonlyMap<string, string> | Readonly<Record<string, string>>;

type SourceMergeHunk = {
  start: number;
  end: number;
  replacement: readonly string[];
};

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
      blocks.push(createGapBlock(source, cursor, startOffset, blocks.length));
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
      : (id: string) => (replacements as Readonly<Record<string, string>>)[id];
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

/**
 * Applies editor changes to the original Markdown source.
 *
 * Milkdown canonicalizes a document when serializing it. Source-only changes
 * (definition: reassembling frontmatter or preserving an unknown construct)
 * are diffed separately from user edits so untouched source slices survive.
 */
export function reconcileMarkdownSource(
  originalSource: string,
  baselineCanonical: string,
  nextCanonical: string
): string {
  if (originalSource === baselineCanonical) return nextCanonical;

  const originalBlocks = markdownBlocks(originalSource);
  const baselineBlocks = markdownBlocks(baselineCanonical);
  const nextBlocks = markdownBlocks(nextCanonical);
  const sourceHunks = diffBlockHunks(baselineBlocks, originalBlocks);
  const userHunks = diffBlockHunks(baselineBlocks, nextBlocks);

  const hunks = [
    ...sourceHunks.filter(
      (sourceHunk) =>
        !userHunks.some((userHunk) => hunksOverlap(sourceHunk, userHunk))
    ),
    ...userHunks
  ].sort((left, right) => left.start - right.start || left.end - right.end);

  if (hunks.length === 0) return originalSource;

  const result: string[] = [];
  let cursor = 0;
  for (const hunk of hunks) {
    if (hunk.start < cursor) continue;
    result.push(...baselineBlocks.slice(cursor, hunk.start));
    result.push(...hunk.replacement);
    cursor = hunk.end;
  }
  result.push(...baselineBlocks.slice(cursor));
  return result.join("");
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

function readFrontmatter(source: string): { endOffset: number } | undefined {
  const opening = /^(?:\uFEFF)?(---|\+\+\+)[ \t]*\r?\n/.exec(source);
  if (!opening) return undefined;
  const marker = opening[1] ?? "---";
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

function markdownBlocks(source: string): string[] {
  return parseMarkdownSource(source).blocks.map((block) => block.source);
}

function diffBlockHunks(
  baseline: readonly string[],
  variant: readonly string[]
): SourceMergeHunk[] {
  const width = variant.length + 1;
  const lcs = new Uint32Array((baseline.length + 1) * width);
  for (let left = baseline.length - 1; left >= 0; left -= 1) {
    for (let right = variant.length - 1; right >= 0; right -= 1) {
      const index = left * width + right;
      lcs[index] =
        baseline[left] === variant[right]
          ? lcs[(left + 1) * width + right + 1]! + 1
          : Math.max(
              lcs[(left + 1) * width + right]!,
              lcs[left * width + right + 1]!
            );
    }
  }

  const hunks: SourceMergeHunk[] = [];
  let baselineIndex = 0;
  let variantIndex = 0;
  let hunkStart = -1;
  let replacementStart = -1;

  const flush = () => {
    if (hunkStart < 0) return;
    hunks.push({
      start: hunkStart,
      end: baselineIndex,
      replacement: variant.slice(replacementStart, variantIndex)
    });
    hunkStart = -1;
    replacementStart = -1;
  };

  while (baselineIndex < baseline.length || variantIndex < variant.length) {
    if (
      baselineIndex < baseline.length &&
      variantIndex < variant.length &&
      baseline[baselineIndex] === variant[variantIndex]
    ) {
      flush();
      baselineIndex += 1;
      variantIndex += 1;
      continue;
    }

    if (hunkStart < 0) {
      hunkStart = baselineIndex;
      replacementStart = variantIndex;
    }
    if (
      baselineIndex < baseline.length &&
      (variantIndex >= variant.length ||
        lcs[(baselineIndex + 1) * width + variantIndex]! >=
          lcs[baselineIndex * width + variantIndex + 1]!)
    ) {
      baselineIndex += 1;
    } else {
      variantIndex += 1;
    }
  }
  flush();
  return hunks;
}

function hunksOverlap(left: SourceMergeHunk, right: SourceMergeHunk): boolean {
  return left.start < right.end && right.start < left.end;
}
