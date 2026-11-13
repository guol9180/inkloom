# ADR 0003: Separate Mermaid and Excalidraw Storage

## Status

Accepted.

## Decision

- Mermaid is stored directly as a fenced code block in Markdown.
- Excalidraw is stored as a content-addressed `.excalidraw` JSON asset.
- An exported SVG preview is referenced from Markdown for portable rendering.
- Editor-only metadata is wrapped in HTML comments around the preview image.

## Consequences

- Every diagram remains editable.
- Ordinary Markdown readers still show a preview.
- Scene JSON does not pollute the main document content or diff.
- Diagram assets need revision, deletion, and orphan cleanup policies.
