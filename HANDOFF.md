# InkLoom Session Handoff

## Reading Order

1. [README.md](./README.md): product snapshot, structure and commands.
2. [AGENTS.md](./AGENTS.md): engineering rules and package boundaries.
3. [DEVELOP_PLAN.md](./DEVELOP_PLAN.md): current task, scope and acceptance.
4. [PRODUCT_AND_ARCHITECTURE.md](./docs/PRODUCT_AND_ARCHITECTURE.md): product,
   data, API and host architecture.
5. [UX_AND_EDITOR_SPEC.md](./docs/UX_AND_EDITOR_SPEC.md): canonical editor and
   interaction design.
6. [DEPLOYMENT.md](./docs/DEPLOYMENT.md): production release, backup and rollback.

## Current State

- Product: InkLoom, English-only visible brand text.
- Web: `https://inkloom.imhgl.com`.
- API: `https://api.inkloom.imhgl.com`.
- Repository: `https://github.com/guol9180/inkloom`, branch `main`.
- Production application release remains
  `68578214d526c132c0b8ee9af4d744b2004ea45d`.
- Current production is the completed M1 Web cloud workspace.
- The source tree also contains a WIP Tauri desktop scaffold. Desktop is parked
  and must not enter the Web release image.

M1.1 has been re-planned as **product-grade editor and knowledge workflow**.
The product and UX decisions are documented; implementation is tracked from
T24 in [DEVELOP_PLAN.md](./DEVELOP_PLAN.md).

## Locked Product Decisions

- M1.1 implements Web only.
- Future desktop, mobile, HarmonyOS and sync hosts retain adapter and command
  entry points, but no future host implementation starts in M1.1.
- Workspace navigation has two modes: Scratch and Knowledge.
- Scratch notes are flat and directly editable.
- The new button is integrated into the `+` menu to the right of search; there
  is no separate scratch-note creation button.
- Knowledge bases are directly created top-level containers.
- Knowledge-base documents are flat Markdown files with no groups or nesting.
- Knowledge-base documents open in preview by default and require explicit
  editing.
- Milkdown / ProseMirror remains the editor kernel; the product-level editor
  shell and custom NodeViews are rebuilt around it.
- The visual theme is white/near-white.
- UI typography follows a Codex-like precise and restrained hierarchy using
  Geist Sans, system Chinese fonts and Geist Mono.
- All content loading uses layout-stable skeleton screens.
- Content editing is autosave-only with IndexedDB drafts, serialized writes,
  idle/max-interval checkpoints, conflict copies and one editor owner per tab.
- Markdown source is canonical; unknown syntax and untouched source slices must
  be preserved.

## Next Work

Start with T33 now that T25–T32 are completed:

- Connect image paste, drag/drop, upload progress, cancel and retry to the asset
  service.
- Add image alignment, width, alt/caption, lightbox, replace and attachment
  download blocks.
- Include Markdown, images, attachments, canvas scenes and SVG previews in ZIP
  export.

T44 production migration and deployment still require explicit user
authorization. Back up and verify the production SQLite database before release.

Do not resume desktop, M2 synchronization, real-time collaboration or mobile
work without explicit user confirmation.

## Verified Before Handoff

The last production check returned:

```json
{
  "web": 200,
  "api": 200,
  "cors": 204,
  "securityHeaders": true
}
```

The documentation reset itself must be verified in the T24 progress entry before
this handoff is considered current.
