import type { CanvasScene } from "@inkloom/diagrams";
import type { Note } from "../../data";

export type NoteShape = {
  title: string;
  content: string;
  tags: string[];
  canvas?: CanvasScene;
};

export function noteShape(note: Note): NoteShape {
  return {
    title: note.title,
    content: note.content,
    tags: note.tags,
    canvas: note.canvas
  };
}

export function noteShapesEqual(left: NoteShape, right: NoteShape): boolean {
  return (
    left.title === right.title &&
    left.content === right.content &&
    JSON.stringify(left.tags) === JSON.stringify(right.tags) &&
    JSON.stringify(left.canvas) === JSON.stringify(right.canvas)
  );
}

export function folderHierarchy(folder: string): string[] {
  const segments = folder.split("/").filter(Boolean);
  return segments.map((_, index) => segments.slice(0, index + 1).join("/"));
}

export function nextAvailableTitle(
  baseTitle: string,
  folder: string,
  notes: readonly Note[]
): string {
  const existing = new Set(
    notes.filter((note) => note.folder === folder).map((note) => note.title)
  );
  if (!existing.has(baseTitle)) return baseTitle;
  let index = 2;
  while (existing.has(`${baseTitle} ${index}`)) index += 1;
  return `${baseTitle} ${index}`;
}

export function uniqueFilePath(
  folder: string,
  title: string,
  notes: readonly Note[]
): string {
  const safeFolder =
    folder
      .split("/")
      .map((segment) => segment.replace(/[\\:*?"<>|]/g, "-").trim())
      .filter(Boolean)
      .join("/") || "个人";
  const safeTitle =
    title.replace(/[\\/:*?"<>|]/g, "-").trim() || "未命名文档";
  const existing = new Set(notes.map((note) => note.filePath));
  let path = `${safeFolder}/${safeTitle}.md`;
  let index = 2;
  while (existing.has(path)) {
    path = `${safeFolder}/${safeTitle} ${index}.md`;
    index += 1;
  }
  return path;
}

export function formatTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}
