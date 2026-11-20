export type EditorCommandId =
  | "undo"
  | "redo"
  | "paragraph"
  | "heading-1"
  | "heading-2"
  | "heading-3"
  | "heading-4"
  | "heading-5"
  | "heading-6"
  | "bold"
  | "italic"
  | "strike"
  | "inline-code"
  | "bullet-list"
  | "ordered-list"
  | "task-list"
  | "link"
  | "quote"
  | "divider"
  | "code-block"
  | "formula"
  | "callout"
  | "toggle"
  | "table";

export type EditorCommandDefinition = {
  id: EditorCommandId;
  label: string;
  hint?: string;
  keywords: readonly string[];
  group: "history" | "block" | "inline" | "list" | "insert";
  slash: boolean;
};

export const EDITOR_COMMANDS: readonly EditorCommandDefinition[] = [
  { id: "undo", label: "撤销", hint: "Ctrl Z", keywords: ["undo"], group: "history", slash: false },
  { id: "redo", label: "重做", hint: "Ctrl Shift Z", keywords: ["redo"], group: "history", slash: false },
  { id: "paragraph", label: "正文", keywords: ["paragraph", "text"], group: "block", slash: true },
  { id: "heading-1", label: "一级标题", hint: "#", keywords: ["heading", "h1", "标题"], group: "block", slash: true },
  { id: "heading-2", label: "二级标题", hint: "##", keywords: ["heading", "h2", "标题"], group: "block", slash: true },
  { id: "heading-3", label: "三级标题", hint: "###", keywords: ["heading", "h3", "标题"], group: "block", slash: true },
  { id: "heading-4", label: "四级标题", hint: "####", keywords: ["heading", "h4", "标题"], group: "block", slash: true },
  { id: "heading-5", label: "五级标题", hint: "#####", keywords: ["heading", "h5", "标题"], group: "block", slash: true },
  { id: "heading-6", label: "六级标题", hint: "######", keywords: ["heading", "h6", "标题"], group: "block", slash: true },
  { id: "bold", label: "加粗", hint: "Ctrl B", keywords: ["bold", "strong"], group: "inline", slash: false },
  { id: "italic", label: "斜体", hint: "Ctrl I", keywords: ["italic", "emphasis"], group: "inline", slash: false },
  { id: "strike", label: "删除线", keywords: ["strike", "delete"], group: "inline", slash: false },
  { id: "inline-code", label: "行内代码", keywords: ["code", "inline"], group: "inline", slash: false },
  { id: "bullet-list", label: "无序列表", keywords: ["bullet", "list", "列表"], group: "list", slash: true },
  { id: "ordered-list", label: "有序列表", keywords: ["ordered", "number", "列表"], group: "list", slash: true },
  { id: "task-list", label: "任务列表", keywords: ["task", "todo", "任务"], group: "list", slash: true },
  { id: "link", label: "链接", hint: "Ctrl K", keywords: ["link", "url"], group: "inline", slash: true },
  { id: "quote", label: "引用", keywords: ["quote", "blockquote"], group: "block", slash: true },
  { id: "divider", label: "分隔线", keywords: ["divider", "hr"], group: "insert", slash: true },
  { id: "code-block", label: "代码块", keywords: ["code", "fence"], group: "insert", slash: true },
  { id: "formula", label: "公式", keywords: ["formula", "math", "latex", "公式"], group: "insert", slash: true },
  { id: "callout", label: "提示块", keywords: ["callout", "note", "alert", "高亮", "提示"], group: "insert", slash: true },
  { id: "toggle", label: "折叠块", keywords: ["toggle", "details", "折叠"], group: "insert", slash: true },
  { id: "table", label: "表格", hint: "3 × 3", keywords: ["table", "表格"], group: "insert", slash: true }
];

const TOOLBAR_ORDER: readonly EditorCommandId[] = [
  "undo",
  "redo",
  "paragraph",
  "heading-1",
  "heading-2",
  "heading-3",
  "heading-4",
  "heading-5",
  "heading-6",
  "bold",
  "italic",
  "strike",
  "inline-code",
  "bullet-list",
  "ordered-list",
  "task-list",
  "link",
  "quote",
  "divider",
  "code-block",
  "formula",
  "callout",
  "toggle",
  "table"
];

export const TOOLBAR_COMMANDS = TOOLBAR_ORDER.map(
  (id) => EDITOR_COMMANDS.find((command) => command.id === id)!
);

export function filterSlashCommands(query: string): EditorCommandDefinition[] {
  const normalized = query.trim().toLowerCase();
  return EDITOR_COMMANDS.filter(
    (command) =>
      command.slash &&
      (!normalized ||
        command.label.toLowerCase().includes(normalized) ||
        command.keywords.some((keyword) => keyword.includes(normalized)))
  );
}

export function commandShortcutMatches(
  command: EditorCommandId,
  event: Pick<
    KeyboardEvent,
    "key" | "code" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey"
  >
): boolean {
  const mod = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();
  if (!mod) return false;
  if (
    command === "paragraph" ||
    command === "heading-1" ||
    command === "heading-2" ||
    command === "heading-3" ||
    command === "heading-4" ||
    command === "heading-5" ||
    command === "heading-6"
  ) {
    return (
      event.altKey &&
      !event.shiftKey &&
      key === (command === "paragraph" ? "0" : command.at(-1))
    );
  }
  if (event.altKey) return false;
  if (command === "bold") return key === "b" && !event.shiftKey;
  if (command === "italic") return key === "i" && !event.shiftKey;
  if (command === "link") return key === "k" && !event.shiftKey;
  if (command === "strike") return key === "x" && event.shiftKey;
  if (command === "inline-code") return key === "e" && !event.shiftKey;
  if (command === "bullet-list") {
    return event.code === "Digit8" && event.shiftKey;
  }
  if (command === "ordered-list") {
    return event.code === "Digit7" && event.shiftKey;
  }
  if (command === "task-list") {
    return event.code === "Digit9" && event.shiftKey;
  }
  if (command === "undo") return key === "z" && !event.shiftKey;
  if (command === "redo") return key === "z" && event.shiftKey;
  return false;
}
