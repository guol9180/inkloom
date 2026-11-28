# InkLoom Session Handoff

## Start

按 [README.md](./README.md) 了解产品与启动方式，按
[AGENTS.md](./AGENTS.md) 获取开发约束，并从
[DEVELOP_PLAN.md](./DEVELOP_PLAN.md) 选择已确认任务。详细产品、编辑器和部署
规则只在专题文档维护，本文件不复制。

## Current State

- Production Web: `https://inkloom.imhgl.com`.
- Production API: `https://api.inkloom.imhgl.com`.
- Active release: `185ad9bcdef7cc9ca1c405a849f3a2b31a9b0e84`.
- The Notion-style workspace, accessibility pass, recoverable trash and
  performance gates are deployed.
- T65–T71 specialized interaction, accessibility, workflow, Notion-like visual
  refresh and performance-gate work is complete locally.
- Previous production release `5824e4691a3498fb2c1967a190f5a602ec968116`
  remains the rollback target.
- T62–T64 documentation governance, ADR alignment and push are complete.
- Desktop, mobile, HarmonyOS, M2 synchronization and real-time collaboration
  remain paused.

## Next Work

Monitor the deployed release and perform a new explicit release only for future
commits. Do not resume desktop, M2, collaboration or mobile work based on the
existence of scaffolds or placeholder contracts.

## Blocked Work

- T4 desktop file workspace: WIP scaffold exists, but M1D is not approved.
- T9 cross-platform adapter suite: shared contracts exist, but the OPFS, Tauri,
  Harmony and Cloud host implementations belong to paused milestones.

## Verification

T65–T71 verification evidence is recorded in
[DEVELOP_PLAN.md](./DEVELOP_PLAN.md): 55 Playwright tests, 86 Vitest tests,
lint, formatting, typecheck, bundle budgets and full build passed. Historical
M1.1 evidence is in the
[acceptance archive](./docs/archive/m1-1-acceptance-2026-11-21.md).
