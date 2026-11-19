# InkLoom Brand and Visual Baseline

## Name

- Visible English brand: `InkLoom`
- Repository/package stem: `inkloom`
- Browser origin: `https://inkloom.imhgl.com`

Do not add Chinese text to the Logo lockup. The Chinese name may appear in
product research or external copy, but not inside the visible brand component.

## Direction

The interface is a calm white writing desk: near-white surfaces, precise
typography, restrained pine-green accents and softly rounded tools.

The memorable visual moment is the editor itself:

- preview and editing occupy the same document surface;
- diagrams stay visibly editable;
- knowledge-base documents transition smoothly between preview and edit;
- motion answers user actions and never decorates the page with continuous
  effects.

## Palette

| Token | Value | Use |
| --- | --- | --- |
| Canvas | `#F7F9F8` | Application background |
| Surface | `#FFFFFF` | Document and primary panels |
| Surface subtle | `#FCFDFC` | Rails and grouped surfaces |
| Surface muted | `#F1F5F3` | Skeleton and quiet fills |
| Text | `#17231D` | Primary text |
| Text secondary | `#5F6D65` | Supporting copy |
| Brand | `#2F7D5D` | Links and selected actions |
| Brand soft | `#EAF6EF` | Active and hover fills |
| Warning | `#B7791F` | Pending and warning |
| Danger | `#C65353` | Destructive confirmation |

Pine and mint are accents, not large background regions. The app must remain
white/near-white at the page level.

## Typography

- UI and document: self-hosted Geist Sans variable, with system Chinese fallback.
- Code, shortcuts and IDs: self-hosted Geist Mono.
- Chinese: PingFang SC, Hiragino Sans GB, HarmonyOS Sans SC, Microsoft YaHei,
  Noto Sans CJK SC.
- Body: 16–17px with 1.78 line height.
- UI: 13–14px.
- Avoid animated font weights and negative tracking on Chinese.

The UI borrows the precision and restraint of the Codex client, while the
document remains comfortable for long-form Chinese writing.

## Shape and Motion

- Controls: 10px radius.
- Menus: 12px radius.
- Panels: 14px radius.
- Login and dialogs: 18px radius.
- Motion primarily uses transform and opacity.
- Use restrained 120–240ms transitions and the shared ease-out token.
- Respect `prefers-reduced-motion`.

## Logo

The visible logo is Lucide `PenLine`, rendered by the code-owned brand
component. Do not generate raster logo alternatives.

## Assets

- `apps/web/public/favicon.svg`
- `apps/web/src/components/brand-mark.tsx`

Detailed visual and interaction requirements are in
[docs/UX_AND_EDITOR_SPEC.md](../docs/UX_AND_EDITOR_SPEC.md).
