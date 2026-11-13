# ADR 0001: Markdown Is the Source of Truth

## Status

Accepted.

## Decision

Every document is persisted as Markdown. Rich text, source view, search, backlinks, and AI features are derived representations.

## Consequences

- Files remain readable and editable outside InkLoom.
- The editor must preserve unknown Markdown and frontmatter.
- Parse/serialize round-trip tests are required before changing editor nodes.
- The database is an index and coordination layer, not the only body copy.
