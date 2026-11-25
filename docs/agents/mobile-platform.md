# 移动平台约束

本文件只记录未来 Tauri mobile、Android、iOS 与 HarmonyOS host 的特有约束。当前
M1.1 不实现这些 host；是否启动对应里程碑以
[DEVELOP_PLAN.md](../../DEVELOP_PLAN.md) 为准。

- `WorkspacePath` 是逻辑路径；Android URI、iOS security-scoped URL 和 Harmony sandbox 绝对路径不得进入共享状态。
- `PlatformCapabilities` 是能力判断的唯一来源，禁止通过 user-agent 猜测平台能力。
- Bridge 请求必须带 `PLATFORM_BRIDGE_VERSION`、request id、method 白名单和 JSON-safe payload。
- 原生句柄、文件描述符、数据库对象不得跨 Bridge 传给 JavaScript。
- 所有写入都携带 `baseRevision`；冲突必须返回 `RevisionConflictError` 等价错误。
- Harmony ArkWeb 特权调用必须校验来源 URL；耗时操作使用异步代理。
- 移动端进入网络同步前先完成本地持久化，必须能恢复被系统终止的编辑。
- 新增 adapter 必须通过统一的 adapter contract tests 后才能声明平台支持。

长期边界见
[ADR 0005](../adr/0005-mobile-ready-foundation.md)，任务与验收见
[DEVELOP_PLAN.md](../../DEVELOP_PLAN.md)。
