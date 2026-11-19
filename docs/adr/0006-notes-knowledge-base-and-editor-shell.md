# ADR 0006: Notes, Flat Knowledge Bases and a Product-Level Editor Shell

## Status

Accepted.

## Context

The first Web MVP successfully proved accounts, real server persistence,
revisions and a single-area Markdown editor. It also exposed three product and
architecture mismatches:

1. A persistent folder tree does not match the desired “capture now, organize
   later” workflow.
2. Knowledge bases were treated as a variant of nested folders or groups instead
   of first-class libraries.
3. Milkdown Crepe defaults were too limited for the desired Yuque-like editor,
   but replacing Milkdown would weaken the Markdown-first guarantee.

Detailed behavior is specified in
[UX_AND_EDITOR_SPEC.md](../UX_AND_EDITOR_SPEC.md). Product and data architecture
is specified in
[PRODUCT_AND_ARCHITECTURE.md](../PRODUCT_AND_ARCHITECTURE.md).

## Decision

### Product model

1. A workspace contains two top-level modes: Scratch and Knowledge.
2. Scratch notes are flat, directly editable Markdown documents with tags.
3. Knowledge bases are user-created top-level containers.
4. Knowledge-base documents are stored flat. There are no groups or nested
   libraries.
5. Knowledge-base content enters through archiving a scratch note or importing
   Markdown.
6. Knowledge-base documents open in read-only preview by default.
7. A user explicitly enters edit mode and returns to preview on completion.
8. Content and lifecycle metadata survive archive, return-to-scratch,
   knowledge-base moves and history restore.

### Editor

1. Keep Milkdown / ProseMirror / Remark as the editor kernel.
2. Treat Crepe as an implementation detail for basic editing, not the final
   product shell.
3. Introduce a shared command registry for toolbar, slash menu, shortcuts and
   contextual actions.
4. Implement custom NodeViews for Mermaid, Excalidraw, assets and extended
   Markdown blocks.
5. Use CodeMirror 6 only inside code and diagram source nodes.
6. Preserve original source slices for untouched or unknown Markdown.
7. Store large diagrams and files as content-addressed assets.

### Host strategy

1. Implement only the Web host in M1.1.
2. Preserve platform-neutral domain, adapter, revision, asset and command
   contracts.
3. Do not create speculative desktop or mobile UI abstractions until they are
   needed.
4. Reserve integration seams for Tauri, Tauri mobile and HarmonyOS.

## Consequences

Positive:

- The product workflow matches how users capture and organize knowledge.
- Markdown remains portable and inspectable.
- The editor can reach a Yuque-like experience without introducing an opaque
  block JSON source of truth.
- Web-only delivery remains focused while future hosts retain a clear path.

Costs:

- A product-level editor shell must be built and tested.
- Unknown Markdown source preservation requires source positions and a golden
  corpus.
- Assets require workspace authorization, MIME validation and cleanup.
- Knowledge-base read/edit transitions need careful focus and save handling.
- Existing documents will migrate to scratch notes; knowledge bases start
  empty.

## Rejected alternatives

### Keep a persistent folder tree

Rejected because users should not have to maintain fixed folders before they
know how content will be organized.

### Treat a knowledge base as a nested group

Rejected because the desired top-level classification is the knowledge base
itself, with flat Markdown storage inside it.

### Replace Milkdown with Tiptap or Lexical

Rejected for M1.1 because neither removes the product shell work, and both add
Markdown-conversion risk. ProseMirror already provides the necessary extension
surface.

### Build a fully custom block editor

Rejected because selection, IME, undo, accessibility, serialization and future
collaboration would create excessive risk and cost.
