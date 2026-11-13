# @inkloom/harmony

HarmonyOS composition root using ArkUI + ArkWeb.

## Intended Layout

```text
entry/
├─ ets/
│  ├─ pages/             native workspace and settings
│  ├─ shell/             ArkWeb host
│  └─ bridge/            versioned platform bridge
├─ resources/
│  └─ rawfile/web/       packaged InkLoom Web assets
└─ module.json5
```

## Minimum Target

- ArkWeb Controller API 12+
- Native workspace list, account, file import/export, and sync status
- RelationalStore for metadata/index
- ArkWeb hosting the shared React editor
- Async JavaScript proxy only; no blocking native calls on the UI thread
- Calling frame URL validation for privileged bridge methods

See [ADR 0005](../../docs/adr/0005-mobile-ready-foundation.md).
