# InkLoom Session Handoff

## Start

按 [README.md](./README.md) 了解产品与启动方式，按
[AGENTS.md](./AGENTS.md) 获取开发约束，并从
[DEVELOP_PLAN.md](./DEVELOP_PLAN.md) 选择已确认任务。详细产品、编辑器和部署
规则只在专题文档维护，本文件不复制。

## Current State

- Production Web: `https://inkloom.imhgl.com`.
- Production API: `https://api.inkloom.imhgl.com`.
- Active release: `5824e4691a3498fb2c1967a190f5a602ec968116`.
- M1.1 Web product-grade editor and knowledge workflow are deployed.
- T62–T64 documentation governance, ADR alignment and push are complete; no product
  implementation milestone is active.
- Desktop, mobile, HarmonyOS, M2 synchronization and real-time collaboration
  remain paused.

## Next Work

Wait for the user to explicitly approve a new milestone. Do not resume desktop,
M2, collaboration or mobile work based on the existence of scaffolds or
placeholder contracts.

## Blocked Work

- T4 desktop file workspace: WIP scaffold exists, but M1D is not approved.
- T9 cross-platform adapter suite: shared contracts exist, but the OPFS, Tauri,
  Harmony and Cloud host implementations belong to paused milestones.

## Verification

The deployed release, container/data retention and production checks are
recorded in [DEVELOP_PLAN.md](./DEVELOP_PLAN.md). Historical M1.1 evidence is in
the [acceptance archive](./docs/archive/m1-1-acceptance-2026-11-21.md).
