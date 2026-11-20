export type ParsedDocumentLink = {
  targetPath: string;
  linkText: string;
  anchor?: string;
};

const MARKDOWN_LINK =
  /(?<!!)\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+["'][^"']*["'])?\s*\)/g;
const WIKI_LINK = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

export function extractDocumentLinks(markdown: string): ParsedDocumentLink[] {
  const links: ParsedDocumentLink[] = [];
  for (const match of markdown.matchAll(MARKDOWN_LINK)) {
    const target = normalizeTarget(match[2]);
    if (!target) continue;
    links.push({ targetPath: target.path, linkText: match[1].trim(), ...(target.anchor ? { anchor: target.anchor } : {}) });
  }
  for (const match of markdown.matchAll(WIKI_LINK)) {
    const target = normalizeTarget(match[1]);
    if (!target) continue;
    links.push({
      targetPath: target.path,
      linkText: (match[2] ?? match[1]).trim(),
      ...(target.anchor ? { anchor: target.anchor } : {})
    });
  }
  const unique = new Map<string, ParsedDocumentLink>();
  for (const link of links) {
    unique.set(`${link.targetPath}#${link.anchor ?? ""}`, link);
  }
  return [...unique.values()];
}

function normalizeTarget(
  raw: string
): { path: string; anchor?: string } | undefined {
  const value = raw.trim().replaceAll("\\", "/");
  if (
    !value ||
    value.startsWith("#") ||
    /^[a-z][a-z0-9+.-]*:/i.test(value) ||
    value.startsWith("/api/") ||
    value.includes("/assets/") ||
    value.startsWith("assets/")
  ) {
    return undefined;
  }
  const [pathPart, anchor] = value.split("#", 2);
  const path = pathPart.replace(/^\.\//, "");
  if (!path) return undefined;
  return {
    path,
    ...(anchor ? { anchor: decodeURIComponent(anchor) } : {})
  };
}
