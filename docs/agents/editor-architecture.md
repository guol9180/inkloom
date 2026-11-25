# InkLoom Editor Architecture

本文件维护产品级编辑器分层。交互、视觉和 Markdown 验收见
[UX 与编辑器规范](./ux-and-editor-spec.md)，决策理由见 [ADR 0006](../adr/0006-notes-knowledge-base-and-editor-shell.md)。

## 1. Editor Architecture

```text
Milkdown / ProseMirror
  schema, selection, IME, undo, Markdown parsing

Editor Command Registry
  one command definition per operation

Editor Shell
  fixed toolbar, slash menu, block handles, contextual tools

NodeViews
  Mermaid, Excalidraw, tables, images, files and extended blocks

Asset layer
  scene, SVG, image and attachment storage

Markdown codec
  source slices, canonical serialization and unknown-node preservation
```

Milkdown and ProseMirror remain the lowest-risk choice because:

- Markdown is a first-class representation.
- ProseMirror provides strong schema, selection and custom NodeView support.
- The same editor command layer can later run inside Tauri and mobile hosts.
- Tiptap and Lexical do not remove the need to build the product UI and Markdown
  fidelity layer; they would add a JSON/HTML conversion boundary.
