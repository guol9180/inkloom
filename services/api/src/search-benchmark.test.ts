import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import { DocumentDatabase } from "./database";

describe("FTS5 search budget", () => {
  it("keeps P95 below 120ms for 1,000 documents", () => {
    const database = new DocumentDatabase({
      filename: ":memory:",
      now: (() => {
        let tick = 0;
        return () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)).toISOString();
      })()
    });
    try {
      const user = database.createUser({
        email: "search-budget@example.com",
        passwordHash: "hash",
        passwordSalt: "salt"
      });
      const workspace = database.listWorkspaces(user.id)[0]!;
      for (let index = 0; index < 1_000; index += 1) {
        const label = String(index).padStart(4, "0");
        database.createDocument(user.id, workspace.id, {
          path: `规模测试/中文检索文档-${label}.md`,
          title: `中文检索文档 ${label}`,
          markdown: `# 中文检索文档 ${label}\n\n知识库全文搜索性能基准。`,
          tags: ["搜索基准", index % 2 === 0 ? "偶数" : "奇数"]
        });
      }

      database.searchDocuments(user.id, workspace.id, {
        query: "中文检索",
        pageSize: 20
      });
      const durations: number[] = [];
      for (let sample = 0; sample < 30; sample += 1) {
        const startedAt = performance.now();
        const result = database.searchDocuments(user.id, workspace.id, {
          query: "中文检索",
          page: 1,
          pageSize: 20
        });
        durations.push(performance.now() - startedAt);
        expect(result.total).toBe(1_000);
        expect(result.results).toHaveLength(20);
      }
      durations.sort((left, right) => left - right);
      const p95 = durations[Math.ceil(durations.length * 0.95) - 1];
      expect(p95!).toBeLessThan(120);
    } finally {
      database.close();
    }
  }, 30_000);
});
