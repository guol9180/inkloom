import { parseMarkdownSource } from "./markdown-source";

export type MarkdownBlockDiff = {
  kind: "unchanged" | "added" | "removed";
  source: string;
};

export function diffMarkdownBlocks(
  previous: string,
  current: string
): MarkdownBlockDiff[] {
  const before = comparableBlocks(previous);
  const after = comparableBlocks(current);
  const rows = before.length + 1;
  const columns = after.length + 1;
  const lcs = Array.from({ length: rows }, () =>
    Array<number>(columns).fill(0)
  );
  for (let left = before.length - 1; left >= 0; left -= 1) {
    for (let right = after.length - 1; right >= 0; right -= 1) {
      lcs[left]![right] =
        before[left]!.trim() === after[right]!.trim()
          ? lcs[left + 1]![right + 1]! + 1
          : Math.max(lcs[left + 1]![right]!, lcs[left]![right + 1]!);
    }
  }

  const result: MarkdownBlockDiff[] = [];
  let left = 0;
  let right = 0;
  while (left < before.length || right < after.length) {
    if (
      left < before.length &&
      right < after.length &&
      before[left]!.trim() === after[right]!.trim()
    ) {
      result.push({ kind: "unchanged", source: after[right]! });
      left += 1;
      right += 1;
    } else if (
      left < before.length &&
      (right >= after.length ||
        lcs[left + 1]![right]! >= lcs[left]![right + 1]!)
    ) {
      result.push({ kind: "removed", source: before[left]! });
      left += 1;
    } else {
      result.push({ kind: "added", source: after[right]! });
      right += 1;
    }
  }
  return coalesce(result);
}

function comparableBlocks(markdown: string): string[] {
  return parseMarkdownSource(markdown)
    .blocks.filter(
      (block) => block.source.trim().length > 0 && block.type !== "whitespace"
    )
    .map((block) => block.source);
}

function coalesce(rows: MarkdownBlockDiff[]): MarkdownBlockDiff[] {
  return rows.filter(
    (row, index) =>
      row.kind === "unchanged" ||
      index === 0 ||
      rows[index - 1]!.kind !== row.kind ||
      rows[index - 1]!.source !== row.source
  );
}
