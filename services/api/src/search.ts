const CJK_CHARACTER =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const WORD_CHARACTER = /[\p{L}\p{N}]/u;

export function normalizeSearchText(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase();
}

export function searchIndexTerms(value: string): string[] {
  const text = normalizeSearchText(value);
  const terms: string[] = [];
  let latin = "";
  let cjk = "";

  const flushLatin = () => {
    if (latin) terms.push(latin);
    latin = "";
  };
  const flushCjk = () => {
    if (!cjk) return;
    for (const character of cjk) terms.push(character);
    for (let index = 0; index < cjk.length - 1; index += 1) {
      terms.push(cjk.slice(index, index + 2));
    }
    cjk = "";
  };

  for (const character of text) {
    if (CJK_CHARACTER.test(character)) {
      flushLatin();
      cjk += character;
    } else if (WORD_CHARACTER.test(character)) {
      flushCjk();
      latin += character;
    } else {
      flushLatin();
      flushCjk();
    }
  }
  flushLatin();
  flushCjk();
  return [...new Set(terms)];
}

export function buildFtsQuery(value: string): string | undefined {
  const terms = searchIndexTerms(value);
  if (terms.length === 0) return undefined;
  return terms.map((term) => `"${term.replaceAll('"', '""')}"`).join(" AND ");
}

export function filenameFromPath(path: string): string {
  return path.replaceAll("\\", "/").split("/").at(-1) ?? path;
}

export function highlightSearchSnippet(
  value: string,
  query: string
): string | undefined {
  if (!value.trim() || !query.trim()) return undefined;
  const normalizedValue = normalizeSearchText(value);
  let needle = normalizeSearchText(query).trim();
  let start = normalizedValue.indexOf(needle);
  if (start < 0) {
    needle =
      searchIndexTerms(query)
        .filter((term) => term.length > 1)
        .sort((left, right) => right.length - left.length)[0] ?? "";
    start = needle ? normalizedValue.indexOf(needle) : -1;
  }
  if (start < 0) return undefined;
  const end = start + needle.length;
  const from = Math.max(0, start - 48);
  const to = Math.min(value.length, end + 80);
  return `${from > 0 ? "…" : ""}${value.slice(from, start)}<mark>${value.slice(
    start,
    end
  )}</mark>${value.slice(end, to)}${to < value.length ? "…" : ""}`;
}
