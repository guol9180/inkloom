# @inkloom/desktop

Tauri 2 桌面客户端。目标是把普通文件夹作为知识库，提供真实文件读写、原子保存、文件监听、SQLite 索引、系统托盘和自动更新。

## 当前状态

尚未创建 Tauri 工程。依赖方向与实施顺序见 [AGENTS.md](../../AGENTS.md) 和 [DEVELOP_PLAN.md](../../DEVELOP_PLAN.md) T4。

## 标识符

- Tauri identifier：`com.imhgl.inkloom`
- 产品名：`InkLoom`

不得把磁盘访问直接写进 React 页面；必须通过 `@inkloom/storage` 的 adapter 注入。
