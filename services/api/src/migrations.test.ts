import {
  copyFileSync,
  mkdtempSync,
  rmSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { DocumentDatabase } from "./database";
import { runMigrations } from "./migrations";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("data model migrations", () => {
  it("migrates legacy documents to flat scratch notes without changing content", () => {
    const directory = createTemporaryDirectory();
    const filename = join(directory, "inkloom.sqlite");
    const backupFilename = join(directory, "inkloom-backup.sqlite");
    createLegacyDatabase(filename);
    copyFileSync(filename, backupFilename);

    const database = new DocumentDatabase({
      filename,
      now: () => "2026-11-19T08:00:00.000Z"
    });
    try {
      const documents = database.db
        .prepare(
          `SELECT id, path, lifecycle, knowledge_base_id, archived_at,
                  title, markdown, tags_json, extensions_json, revision,
                  content_hash
           FROM documents
           ORDER BY id`
        )
        .all() as Array<Record<string, unknown>>;

      expect(documents).toHaveLength(4);
      expect(documents).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "document-project",
            lifecycle: "scratch",
            knowledge_base_id: null,
            archived_at: null,
            title: "同名项目",
            markdown: "# 同名项目\n\n项目正文。\n",
            tags_json: '["项目","保留"]',
            extensions_json: '{"canvas":{"elements":[]}}',
            content_hash: "hash-project",
            revision: 3
          }),
          expect.objectContaining({
            id: "document-archive",
            lifecycle: "scratch",
            knowledge_base_id: null,
            archived_at: null,
            title: "同名归档",
            markdown: "# 同名归档\n\n归档正文。\n",
            tags_json: '["归档"]',
            revision: 2
          })
        ])
      );

      const paths = documents.map((document) => String(document.path));
      expect(paths).toHaveLength(new Set(paths).size);
      expect(paths).toEqual(
        expect.arrayContaining([
          "同名.md",
          "同名 (2).md",
          "同名 (3).md",
          "根文档.md"
        ])
      );
      expect(paths.every((path) => !path.includes("/"))).toBe(true);

      const pathMappings = database.db
        .prepare(
          `SELECT document_id, original_path, migrated_path
           FROM document_path_migrations
           ORDER BY document_id`
        )
        .all();
      expect(pathMappings).toHaveLength(4);
      expect(pathMappings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            document_id: "document-project",
            original_path: "项目/同名.md",
            migrated_path: "同名 (2).md"
          }),
          expect.objectContaining({
            document_id: "document-archive",
            original_path: "归档/同名.md",
            migrated_path: "同名.md"
          })
        ])
      );

      expect(
        database.db.prepare("SELECT COUNT(*) AS count FROM document_revisions").get()
      ).toEqual({ count: 3 });
      expect(
        database.db.prepare("SELECT COUNT(*) AS count FROM knowledge_bases").get()
      ).toEqual({ count: 0 });
      expect(
        database.db
          .prepare(
            `SELECT version, name
             FROM schema_migrations
             ORDER BY version`
          )
          .all()
      ).toEqual([
        { version: 1, name: "legacy-document-baseline" },
        { version: 2, name: "scratch-knowledge-assets" },
        { version: 3, name: "knowledge-base-revisions" }
      ]);

      for (const table of [
        "knowledge_bases",
        "assets",
        "document_asset_refs",
        "document_links",
        "schema_migrations"
      ]) {
        expect(
          database.db
            .prepare(
              "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?"
            )
            .get(table)
        ).toEqual({ name: table });
      }

      const documentColumns = database.db
        .prepare("PRAGMA table_info(documents)")
        .all() as Array<{ name: string }>;
      expect(documentColumns.map((column) => column.name)).toEqual(
        expect.arrayContaining([
          "lifecycle",
          "knowledge_base_id",
          "archived_at",
          "last_opened_at"
        ])
      );
    } finally {
      database.close();
    }

    const reopened = new DocumentDatabase({
      filename,
      now: () => "2026-11-19T09:00:00.000Z"
    });
    try {
      expect(
        reopened.db.prepare("SELECT COUNT(*) AS count FROM documents").get()
      ).toEqual({ count: 4 });
      expect(
        reopened.db.prepare("SELECT COUNT(*) AS count FROM schema_migrations").get()
      ).toEqual({ count: 3 });
      expect(
        reopened.db
          .prepare("SELECT COUNT(*) AS count FROM document_path_migrations")
          .get()
      ).toEqual({ count: 4 });
    } finally {
      reopened.close();
    }

    rmSync(`${filename}-wal`, { force: true });
    rmSync(`${filename}-shm`, { force: true });
    copyFileSync(backupFilename, filename);

    const restored = new DocumentDatabase({
      filename,
      now: () => "2026-11-19T10:00:00.000Z"
    });
    try {
      expect(
        restored.db.prepare("SELECT COUNT(*) AS count FROM documents").get()
      ).toEqual({ count: 4 });
      expect(
        restored.db
          .prepare(
            `SELECT title, markdown, revision
             FROM documents
             WHERE id = 'document-project'`
          )
          .get()
      ).toEqual({
        title: "同名项目",
        markdown: "# 同名项目\n\n项目正文。\n",
        revision: 3
      });
      expect(
        restored.db.prepare("SELECT COUNT(*) AS count FROM schema_migrations").get()
      ).toEqual({ count: 3 });
    } finally {
      restored.close();
    }
  });

  it("rolls back every migration change when a migration fails", () => {
    const directory = createTemporaryDirectory();
    const filename = join(directory, "inkloom.sqlite");
    createLegacyDatabase(filename);

    const database = new DatabaseSync(filename);
    try {
      database.exec(`
        PRAGMA foreign_keys = ON;
        CREATE TABLE knowledge_bases (
          incompatible_schema TEXT
        );
      `);
      expect(() => runMigrations(database)).toThrow();
      expect(
        database
          .prepare(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'"
          )
          .get()
      ).toBeUndefined();
      const documentColumns = database
        .prepare("PRAGMA table_info(documents)")
        .all() as Array<{ name: string }>;
      expect(documentColumns.map((column) => column.name)).not.toContain("lifecycle");
    } finally {
      database.close();
    }
  });
});

function createTemporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "inkloom-migration-"));
  temporaryDirectories.push(directory);
  return directory;
}

function createLegacyDatabase(filename: string): void {
  const database = new DatabaseSync(filename);
  try {
    database.exec(`
      PRAGMA foreign_keys = ON;

      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE sessions (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE workspaces (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE documents (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        path TEXT NOT NULL,
        title TEXT NOT NULL,
        tags_json TEXT NOT NULL,
        markdown TEXT NOT NULL,
        extensions_json TEXT,
        revision INTEGER NOT NULL,
        content_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );

      CREATE UNIQUE INDEX documents_active_path
        ON documents(workspace_id, path)
        WHERE deleted_at IS NULL;

      CREATE INDEX documents_workspace
        ON documents(workspace_id, deleted_at);

      CREATE TABLE document_revisions (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        revision INTEGER NOT NULL,
        title TEXT NOT NULL,
        tags_json TEXT NOT NULL,
        markdown TEXT NOT NULL,
        extensions_json TEXT,
        content_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(document_id, revision)
      );

      INSERT INTO users
        (id, email, display_name, password_hash, password_salt, created_at)
      VALUES
        ('user-1', 'legacy@example.com', '旧用户', 'hash', 'salt',
         '2026-11-01T00:00:00.000Z');

      INSERT INTO workspaces
        (id, user_id, name, created_at, updated_at)
      VALUES
        ('workspace-1', 'user-1', '旧工作区',
         '2026-11-01T00:00:00.000Z', '2026-11-02T00:00:00.000Z');

      INSERT INTO documents
        (id, workspace_id, path, title, tags_json, markdown, extensions_json,
         revision, content_hash, created_at, updated_at, deleted_at)
      VALUES
        ('document-project', 'workspace-1', '项目/同名.md', '同名项目',
         '["项目","保留"]', '# 同名项目

项目正文。
', '{"canvas":{"elements":[]}}', 3, 'hash-project',
         '2026-11-01T00:00:00.000Z', '2026-11-03T00:00:00.000Z', NULL),
        ('document-archive', 'workspace-1', '归档/同名.md', '同名归档',
         '["归档"]', '# 同名归档

归档正文。
', NULL, 2, 'hash-archive',
         '2026-11-01T00:00:00.000Z', '2026-11-03T00:00:00.000Z', NULL),
        ('document-root', 'workspace-1', '根文档.md', '根文档',
         '[]', '# 根文档
', NULL, 1, 'hash-root',
         '2026-11-01T00:00:00.000Z', '2026-11-03T00:00:00.000Z', NULL),
        ('document-deleted', 'workspace-1', '废纸/同名.md', '已删除',
         '[]', '# 已删除
', NULL, 1, 'hash-deleted',
         '2026-11-01T00:00:00.000Z', '2026-11-03T00:00:00.000Z',
         '2026-11-03T00:00:00.000Z');

      INSERT INTO document_revisions
        (id, document_id, workspace_id, revision, title, tags_json, markdown,
         extensions_json, content_hash, created_at)
      VALUES
        ('revision-project-1', 'document-project', 'workspace-1', 1,
         '同名项目', '["项目"]', '# 第一版
', NULL, 'hash-project-1', '2026-11-01T00:00:00.000Z'),
        ('revision-project-2', 'document-project', 'workspace-1', 2,
         '同名项目', '["项目"]', '# 第二版
', NULL, 'hash-project-2', '2026-11-02T00:00:00.000Z'),
        ('revision-archive-1', 'document-archive', 'workspace-1', 1,
         '同名归档', '["归档"]', '# 归档第一版
', NULL, 'hash-archive-1', '2026-11-01T00:00:00.000Z');
    `);
  } finally {
    database.close();
  }
}
