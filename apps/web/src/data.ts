import type { CanvasScene } from "@inkloom/diagrams";

export type Note = {
  id: string;
  title: string;
  folder: string;
  filePath: string;
  revision: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  content: string;
  canvas?: CanvasScene;
};

export const folderOrder = ["产品", "架构", "研究", "个人", "开始使用"];
