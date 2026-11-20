export const CALLOUT_KINDS = [
  "note",
  "tip",
  "important",
  "warning",
  "caution"
] as const;

export type CalloutKind = (typeof CALLOUT_KINDS)[number];

export const CALLOUT_LABELS: Record<CalloutKind, string> = {
  note: "提示",
  tip: "技巧",
  important: "重要",
  warning: "警告",
  caution: "注意"
};
