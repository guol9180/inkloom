import type { DatabaseSync } from "node:sqlite";
import { extractDocumentLinks } from "./links";
import { filenameFromPath, searchIndexTerms } from "./search";

type Migration = {
  version: number;
  name: string;
  up: (database: DatabaseSync, appliedAt: string) => void;
};

type DocumentPathRow = {
  id: string;
  workspace_id: string;
  path: string;
};

const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: "legacy-document-baseline",
    up(database) {
      database.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          display_name TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          password_salt TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sessions (
          token_hash TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS workspaces (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS documents (
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

        CREATE UNIQUE INDEX IF NOT EXISTS documents_active_path
          ON documents(workspace_id, path)
          WHERE deleted_at IS NULL;

        CREATE INDEX IF NOT EXISTS documents_workspace
          ON documents(workspace_id, deleted_at);

        CREATE TABLE IF NOT EXISTS document_revisions (
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
      `);
    }
  },
  {
    version: 2,
    name: "scratch-knowledge-assets",
    up(database, appliedAt) {
      database.exec(`
        CREATE TABLE knowledge_bases (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(workspace_id, name)
        );

        ALTER TABLE documents
          ADD COLUMN lifecycle TEXT NOT NULL DEFAULT 'scratch'
          CHECK (lifecycle IN ('scratch', 'knowledge'));
        ALTER TABLE documents
          ADD COLUMN knowledge_base_id TEXT
          REFERENCES knowledge_bases(id);
        ALTER TABLE documents ADD COLUMN archived_at TEXT;
        ALTER TABLE documents ADD COLUMN last_opened_at TEXT;

        CREATE TABLE assets (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          hash TEXT NOT NULL,
          mime TEXT NOT NULL,
          size INTEGER NOT NULL CHECK (size >= 0),
          kind TEXT NOT NULL
            CHECK (kind IN ('image', 'attachment', 'excalidraw', 'svg')),
          storage_key TEXT NOT NULL,
          created_at TEXT NOT NULL,
          UNIQUE(workspace_id, hash)
        );

        CREATE TABLE document_asset_refs (
          document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
          asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
          created_at TEXT NOT NULL,
          PRIMARY KEY(document_id, asset_id)
        );

        CREATE TABLE document_links (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          source_document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
          target_document_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
          target_path TEXT NOT NULL,
          link_text TEXT NOT NULL,
          anchor TEXT,
          broken INTEGER NOT NULL DEFAULT 0 CHECK (broken IN (0, 1)),
          updated_at TEXT NOT NULL
        );

        CREATE TABLE document_path_migrations (
          document_id TEXT PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          original_path TEXT NOT NULL,
          migrated_path TEXT NOT NULL,
          migrated_at TEXT NOT NULL
        );

        DROP INDEX IF EXISTS documents_active_path;

        CREATE UNIQUE INDEX documents_scratch_path
          ON documents(workspace_id, path)
          WHERE deleted_at IS NULL AND lifecycle = 'scratch';

        CREATE UNIQUE INDEX documents_knowledge_path
          ON documents(knowledge_base_id, path)
          WHERE deleted_at IS NULL AND lifecycle = 'knowledge';

        CREATE INDEX documents_lifecycle
          ON documents(workspace_id, lifecycle, deleted_at, updated_at);
        CREATE INDEX documents_last_opened
          ON documents(workspace_id, last_opened_at);
        CREATE INDEX document_links_source
          ON document_links(source_document_id);
        CREATE INDEX document_links_target
          ON document_links(target_document_id);
      `);

      flattenLegacyDocumentPaths(database, appliedAt);
    }
  },
  {
    version: 3,
    name: "knowledge-base-revisions",
    up(database) {
      database.exec(`
        ALTER TABLE knowledge_bases
          ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
        CREATE INDEX knowledge_bases_workspace_order
          ON knowledge_bases(workspace_id, sort_order, created_at);
      `);
    }
  },
  {
    version: 4,
    name: "sqlite-fts5-document-search",
    up(database) {
      database.exec(`
        CREATE VIRTUAL TABLE document_search USING fts5(
          document_id UNINDEXED,
          workspace_id UNINDEXED,
          lifecycle UNINDEXED,
          knowledge_base_id UNINDEXED,
          title,
          markdown,
          tags,
          path,
          filename,
          search_terms,
          tokenize = 'unicode61 remove_diacritics 2'
        );
      `);
      const rows = database
        .prepare(
          `SELECT id, workspace_id, lifecycle, knowledge_base_id, title,
                  tags_json, markdown, path
           FROM documents
           WHERE deleted_at IS NULL`
        )
        .all() as Array<{
        id: string;
        workspace_id: string;
        lifecycle: string;
        knowledge_base_id: string | null;
        title: string;
        tags_json: string;
        markdown: string;
        path: string;
      }>;
      const insert = database.prepare(
        `INSERT INTO document_search
          (document_id, workspace_id, lifecycle, knowledge_base_id, title,
           markdown, tags, path, filename, search_terms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const row of rows) {
        const tags = parseStringArray(row.tags_json).join(" ");
        const filename = filenameFromPath(row.path);
        insert.run(
          row.id,
          row.workspace_id,
          row.lifecycle,
          row.knowledge_base_id,
          row.title,
          row.markdown,
          tags,
          row.path,
          filename,
          searchIndexTerms(
            `${row.title}\n${row.markdown}\n${tags}\n${row.path}`
          ).join(" ")
        );
      }
    }
  },
  {
    version: 5,
    name: "document-link-index",
    up(database, appliedAt) {
      const documents = database
        .prepare(
          `SELECT id, workspace_id, markdown
           FROM documents
           WHERE deleted_at IS NULL`
        )
        .all() as Array<{ id: string; workspace_id: string; markdown: string }>;
      const insert = database.prepare(
        `INSERT INTO document_links
          (id, workspace_id, source_document_id, target_document_id, target_path,
           link_text, anchor, broken, updated_at)
         VALUES (?, ?, ?, NULL, ?, ?, ?, 1, ?)`
      );
      let sequence = 0;
      for (const document of documents) {
        for (const link of extractDocumentLinks(document.markdown)) {
          insert.run(
            `link-migration-${sequence++}`,
            document.workspace_id,
            document.id,
            link.targetPath,
            link.linkText,
            link.anchor ?? null,
            appliedAt
          );
        }
      }
      database.exec(`
        UPDATE document_links
        SET target_document_id = (
          SELECT documents.id FROM documents
          WHERE documents.workspace_id = document_links.workspace_id
            AND documents.deleted_at IS NULL
            AND (
              documents.path = document_links.target_path
              OR documents.path = document_links.target_path || '.md'
              OR documents.title = document_links.target_path
            )
          LIMIT 1
        );
        UPDATE document_links
        SET broken = CASE
          WHEN target_document_id IS NULL THEN 1
          ELSE 0
        END;
      `);
    }
  }
];

export function runMigrations(
  database: DatabaseSync,
  appliedAt = new Date().toISOString()
): void {
  database.exec("BEGIN IMMEDIATE");
  try {
    database.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `);

    const appliedVersions = new Set(
      (
        database
          .prepare("SELECT version FROM schema_migrations")
          .all() as Array<{ version: number }>
      ).map((row) => row.version)
    );
    const recordMigration = database.prepare(
      `INSERT INTO schema_migrations (version, name, applied_at)
       VALUES (?, ?, ?)`
    );

    for (const migration of MIGRATIONS) {
      if (appliedVersions.has(migration.version)) continue;
      migration.up(database, appliedAt);
      recordMigration.run(migration.version, migration.name, appliedAt);
    }

    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function flattenLegacyDocumentPaths(
  database: DatabaseSync,
  migratedAt: string
): void {
  const rows = database
    .prepare(
      `SELECT id, workspace_id, path
       FROM documents
       ORDER BY
         CASE WHEN deleted_at IS NULL THEN 0 ELSE 1 END,
         workspace_id ASC,
         path ASC,
         id ASC`
    )
    .all() as DocumentPathRow[];
  const usedPaths = new Map<string, Set<string>>();
  const updateDocument = database.prepare(
    `UPDATE documents
     SET path = ?, lifecycle = 'scratch', knowledge_base_id = NULL,
         archived_at = NULL
     WHERE id = ?`
  );
  const recordPath = database.prepare(
    `INSERT INTO document_path_migrations
      (document_id, workspace_id, original_path, migrated_path, migrated_at)
     VALUES (?, ?, ?, ?, ?)`
  );

  for (const row of rows) {
    const workspacePaths = usedPaths.get(row.workspace_id) ?? new Set<string>();
    usedPaths.set(row.workspace_id, workspacePaths);
    const migratedPath = allocateFlatPath(row.path, workspacePaths);
    updateDocument.run(migratedPath, row.id);
    recordPath.run(
      row.id,
      row.workspace_id,
      row.path,
      migratedPath,
      migratedAt
    );
  }
}

function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) &&
      parsed.every((item) => typeof item === "string")
      ? parsed
      : [];
  } catch {
    return [];
  }
}

function allocateFlatPath(
  originalPath: string,
  usedPaths: Set<string>
): string {
  const fileName = originalPath.split("/").at(-1) || "未命名文档.md";
  const dotIndex = fileName.lastIndexOf(".");
  const stem = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
  const extension = dotIndex > 0 ? fileName.slice(dotIndex) : "";
  let sequence = 1;
  let candidate = fileName;

  while (usedPaths.has(candidate.toLowerCase())) {
    sequence += 1;
    candidate = `${stem} (${sequence})${extension}`;
  }
  usedPaths.add(candidate.toLowerCase());
  return candidate;
}
