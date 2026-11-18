# 开发计划与验收

## 当前基线

- 当前可运行产物：`apps/web`
- 当前阶段：Web 交互原型完成，等待进入本地桌面 MVP

## 任务清单

### T1: 开源仓库与品牌整理（P0）

- 目标：统一项目名、仓库结构、域名约定和交接文档。
- 验收标准：
  - 仓库根目录包含 README、AGENTS、DEVELOP_PLAN 和 HANDOFF。
  - 所有用户可见品牌统一为 InkLoom / 墨织。
  - 包作用域统一为 `@inkloom/*`。
  - 浏览器主域明确为 `inkloom.imhgl.com`。
- 边界：本任务不改生产存储和同步实现。
- 状态：done
- 进度（只追加新行，不修改旧行）：
  - 2026-11-13 计划 建立开源仓库整理任务卡。
  - 2026-11-13 执行 完成 monorepo 骨架、品牌替换和交接材料。
  - 2026-11-13 验证 Web 生产构建通过，Mermaid 与 Excalidraw 实机验证通过。
  - 2026-11-13 交付 产出 `apps/web`、产品方案、部署说明和仓库交接文档；剩余差距：GitHub 远端尚未创建。

### T2: Web 交互原型基线（P0）

- 目标：验证 Markdown、Mermaid、Excalidraw 和文件树的核心交互。
- 验收标准：
  - 可新建、搜索、切换和删除文档。
  - 源码、分栏和阅读模式可切换。
  - Mermaid 可渲染 SVG。
  - Excalidraw 可打开、编辑并保存场景。
  - `pnpm build` 成功。
- 边界：使用 localStorage，不实现真实文件系统和云同步。
- 状态：done
- 进度（只追加新行，不修改旧行）：
  - 2026-11-13 计划 建立浏览器交互原型任务卡。
  - 2026-11-13 执行 完成编辑器、图表和文档树原型。
  - 2026-11-13 验证 TypeScript + Vite 构建通过，浏览器实机验证通过。
  - 2026-11-13 交付 产出 `apps/web`；剩余差距：正式存储 adapter 尚未接入。

### T3: 抽取 core、editor、diagrams、storage 包（P0）

- 目标：把单页原型拆成可复用 workspace 包，为 Web 与 Tauri 共用。
- 验收标准：
  - `@inkloom/core` 定义文档、逻辑路径、revision、能力声明、adapter 和 Bridge 类型。
  - `@inkloom/editor` 提供 Markdown 视图与源码视图接口。
  - `@inkloom/diagrams` 懒加载 Mermaid 与 Excalidraw。
  - `@inkloom/storage` 至少实现 BrowserLocalAdapter。
  - Web 不直接访问 localStorage，而是通过 adapter。
  - Web 行为与当前原型一致。
- 边界：不接入真实磁盘和云 API。
- 状态：done
- 进度（只追加新行，不修改旧行）：
  - 2026-11-13 计划 创建任务卡，等待开始。
  - 2026-11-18 计划 按交接顺序启动 T3；以当前 Web 原型行为为回归基线，先抽取 core 文档记录、BrowserLocalAdapter 和 diagrams 按需加载边界，再切换 Web 依赖。验收范围固化为 typecheck、test、build 与浏览器交互回归。
  - 2026-11-18 执行 `@inkloom/core` 增加文档扩展 JSON 与可更新标题/标签契约；`@inkloom/editor` 提供 Markdown 视图、标题提取和字数统计；`@inkloom/diagrams` 接管 DOMPurify/Mermaid 安全渲染与 Excalidraw 懒加载；`@inkloom/storage` 新增可注入介质的 `BrowserLocalAdapter`，Web 通过 adapter 持久化工作区。
  - 2026-11-18 验证 `pnpm typecheck`、`pnpm test`（11 项）与 `pnpm build` 全部通过；浏览器实际验证 Mermaid 输出 SVG，Excalidraw 新增加一个图元后从 11 变为 12，关闭重开及整页刷新后场景仍为 12 个图元。
  - 2026-11-18 交付 产出共享包实现、Web composition root、storage/editor 测试和 lockfile；原单页渲染与存储逻辑已移出 `App.tsx`，剩余差距：无。

### T4: Tauri 桌面本地工作区（P0）

- 目标：实现打开普通文件夹、读写 `.md`、附件和 Excalidraw 场景。
- 验收标准：
  - 用户选择工作区后可列出目录树。
  - 新建文档后磁盘出现 UTF-8 `.md` 文件。
  - 保存使用临时文件 + 原子替换。
  - 外部修改可被监听并刷新。
  - 越界路径和符号链接被拒绝。
- 边界：不实现团队权限和实时协作。
- 状态：planned
- 进度（只追加新行，不修改旧行）：
  - 2026-11-13 计划 创建任务卡，等待开始。

### T5: SQLite 索引与版本历史（P0）

- 目标：实现可重建的全文索引、反链和自动快照。
- 验收标准：
  - 标题、正文、标签和路径可搜索。
  - 删除索引文件后可完整重建。
  - 文档改名后反链保持。
  - 可恢复最近历史版本。
- 边界：不实现跨设备同步。
- 状态：planned
- 进度（只追加新行，不修改旧行）：
  - 2026-11-13 计划 创建任务卡，等待开始。

### T6: 图表生产化（P1）

- 目标：把 Mermaid 与 Excalidraw 从演示实现升级为可靠资产模型。
- 验收标准：
  - Mermaid 源码往返不丢失。
  - Excalidraw scene 与 SVG 预览分文件保存。
  - 普通 Markdown 阅读器可看到 SVG。
  - 图表依赖完成安全审计和版本锁定。
- 边界：不实现图表云端协同。
- 状态：planned
- 进度（只追加新行，不修改旧行）：
  - 2026-11-13 计划 创建任务卡，等待开始。

### T7: Web 云工作区与同步（P1）

- 目标：在 `inkloom.imhgl.com` 提供登录、云端文档和多端同步。
- 验收标准：
  - Web 与桌面可双向同步 revision。
  - 断网编辑进入本地队列。
  - 冲突产生明确副本，不静默覆盖。
  - API 与 Web 使用独立子域和最小 CORS。
- 边界：实时多人编辑留到下一阶段。
- 状态：planned
- 进度（只追加新行，不修改旧行）：
  - 2026-11-13 计划 创建任务卡，等待开始。

### T8: 实时协作与团队能力（P2）

- 目标：引入 Yjs 协同、权限、评论和分享。
- 验收标准：
  - 两个客户端并发编辑可稳定固化 Markdown。
  - 权限撤销立即生效。
  - 评论和分享链接按工作区隔离。
- 边界：不包含计费系统。
- 状态：planned
- 进度（只追加新行，不修改旧行）：
  - 2026-11-13 计划 创建任务卡，等待开始。

### T9: 移动端就绪契约与 Adapter 测试（P0）

- 目标：在任何新平台壳出现前，先固化文档、路径、revision、能力和 Bridge 契约。
- 验收标准：
  - `WorkspaceAdapter` 覆盖 tree/read/create/write/move/delete，并强制 `baseRevision`。
  - `PlatformCapabilities` 能区分 Web、Tauri desktop、Tauri mobile 和 Harmony。
  - `PlatformBridge` 请求包含版本、request id、白名单 method 和 JSON-safe payload。
  - 文件系统、OPFS、Tauri、Harmony、Cloud adapter 共用同一套 contract tests。
  - 路径标准化拒绝空段、`.`、`..` 和越界绝对路径。
  - 未支持 Bridge 方法时 UI 可读取缓存并给出明确降级状态。
- 边界：本任务不创建 HarmonyOS 或 Tauri mobile 工程。
- 状态：in-progress
- 进度（只追加新行，不修改旧行）：
  - 2026-11-13 计划 建立移动就绪基础任务卡。
  - 2026-11-13 执行 新增 core 文档、错误、能力、adapter 和平台 Bridge 契约；建立 Harmony 与 Tauri mobile composition-root 占位。
  - 2026-11-13 验证 待运行 package typecheck；adapter contract tests 尚未实现。
  - 2026-11-13 验证 `pnpm typecheck` 与 `pnpm build` 通过；adapter contract tests 仍未实现，任务保持 in-progress。
  - 2026-11-13 验证 新增 core/storage 基础契约测试，`pnpm test` 共 4 项通过；完整跨 adapter contract suite 仍待实现。
  - 2026-11-18 执行 从 T3 提交 `d34716f` 后继续 T9；本轮补齐可复用 WorkspaceAdapter contract suite、绝对路径/Bridge payload 运行时校验，以及 `BRIDGE_UNSUPPORTED` 的只读缓存降级状态。
  - 2026-11-18 执行 `@inkloom/storage/contract-tests` 导出统一 create/read/tree/revision conflict/move/delete 套件并接入 BrowserLocalAdapter；`@inkloom/core` 拒绝 POSIX、Windows drive、UNC、URI 绝对路径，新增 Bridge request 创建/解析、method 白名单、JSON-safe/循环引用校验和 cached-only 降级模型。
  - 2026-11-18 验证 `pnpm typecheck`、`pnpm test`（22 项）与 `pnpm build` 通过；BrowserLocalAdapter 通过 5 项统一 adapter contract tests，Bridge 与路径校验共 6 项通过。
  - 2026-11-18 进度 契约基础可用于后续 adapter，但 OPFS、Tauri、Harmony、Cloud 实现尚不存在，尚未接入同一 suite；T9 保持 in-progress，待 T4/T5/T7/T10 对应 adapter 落地后关闭。

### T10: HarmonyOS ArkUI + ArkWeb MVP（P2）

- 目标：提供可安装的 HarmonyOS 客户端，复用共享编辑器和云端工作区。
- 验收标准：
  - ArkUI 提供首页、工作区、账号、系统文件导入导出和同步状态。
  - ArkWeb 加载共享 React 编辑器，异步 Bridge 支持读取、保存和同步。
  - relationalStore 保存文档元数据、索引和离线队列。
  - 特权 Bridge 调用校验来源 URL、工作区和消息大小。
  - 应用被终止后重新打开可恢复未同步编辑。
  - Mermaid 可查看和编辑源码；Excalidraw 可全屏查看并进行基础编辑。
- 边界：不重写 ArkTS 版 Excalidraw，不承诺与桌面完全相同的文件夹体验。
- 状态：planned
- 进度（只追加新行，不修改旧行）：
  - 2026-11-13 计划 创建 HarmonyOS MVP 任务卡。

### T11: Tauri Android/iOS 可行性验证（P2）

- 目标：评估 Tauri 2 是否适合作为 Android/iOS 的共同移动壳。
- 验收标准：
  - 能在真机运行共享编辑器并读写应用沙箱。
  - 系统文件选择、分享、安全存储和网络同步验证通过。
  - 应用挂起和进程终止后的编辑恢复验证通过。
  - 与 Harmony 方案对比后形成继续或放弃 ADR。
- 边界：不在可行性验证前承诺双平台正式发布。
- 状态：planned
- 进度（只追加新行，不修改旧行）：
  - 2026-11-13 计划 创建 Tauri mobile 验证任务卡。

### T12: 初始化 GitHub 仓库并推送首个版本（P0）

- 目标：初始化 Git 仓库，在 GitHub 创建 InkLoom 远程仓库，并推送当前开源基线。
- 验收标准：
  - 本地仓库完成 Git 初始化，默认分支为 `main`。
  - 远程仓库创建成功且 `origin` 指向该项目。
  - 提交内容不包含 `node_modules/`、密钥或真实用户文档。
  - 推送前完成 `pnpm typecheck`、`pnpm build` 和 `pnpm test` 验证。
  - `main` 分支及首个提交已推送到 GitHub。
- 边界：本任务仅完成仓库初始化与代码托管，不配置生产部署、域名或 GitHub Secrets。
- 状态：done
- 进度（只追加新行，不修改旧行）：
  - 2026-11-13 计划 建立 GitHub 仓库初始化与首次推送任务卡。
  - 2026-11-13 执行 初始化本地 `main` 分支；确认忽略依赖、构建产物和环境变量，常见密钥模式扫描无命中。
  - 2026-11-13 验证 `pnpm typecheck`、`pnpm test`（4 项）与 `pnpm build` 全部通过；构建仅有图表 chunk 过大警告。
  - 2026-11-13 交付 创建公开仓库 `https://github.com/guol9180/inkloom`，首个提交 `9cae0f2` 已推送到 `origin/main`。

### T13: 复核项目三文档结构（P0）

- 目标：按 init-project-docs skill 复核 README、AGENTS 和 DEVELOP_PLAN 的职责边界，并同步最新开发规范。
- 动机：AGENTS 通用规范已从四条升级为五条，需确保项目文档与权威规范一致。
- 验收标准：
  - `AGENTS.md` 标题为“通用规范（必建五条）”。
  - 五条标准条目完整包含“精准修改”，语义与 skill 标准条目一致。
  - README、AGENTS、DEVELOP_PLAN 内容按既有单一事实源分工，重复事实改为链接引用。
  - DEVELOP_PLAN 状态值均在状态枚举内，进度区只追加。
- 边界：只调整三件套文档，不改运行时代码、产品方案、部署文档和交接文档。
- 状态：done
- 进度（只追加新行，不修改旧行）：
  - 2026-11-16 计划 用户明确要求再次执行 init-project-docs skill，任务卡确认。
  - 2026-11-16 执行 AGENTS 通用规范升级为必建五条并新增“精准修改”；README 部署与技术栈重复清单改为链接；DEVELOP_PLAN 当前基线移除归属 README 与部署文档的重复事实。
  - 2026-11-16 验证 `rg` 确认五条规范存在且 README 不再复制域名；脚本核对 13 个任务状态全部在枚举内；`git diff --check` 无输出。
  - 2026-11-16 交付 产出 `README.md`、`AGENTS.md`、`DEVELOP_PLAN.md`；剩余差距：无。
  - 2026-11-16 验证 `pnpm typecheck` 通过；`pnpm test` 4 项通过；`pnpm build` 成功，仍仅存在图表大 chunk 警告。

### T14: 同步 init-project-docs 注释规范（P0）

- 目标：将 init-project-docs skill 新增的注释约束同步到 AGENTS 通用规范第 5 条。
- 动机：权威“精准修改”条目已扩展注释写作边界，项目规范需保持一致。
- 验收标准：
  - `AGENTS.md` 第 5 条与 skill 标准条目语义一致。
  - 注释约束只写入 AGENTS，不在 README 或 DEVELOP_PLAN 复制。
  - README、AGENTS、DEVELOP_PLAN 职责分工不因本次同步发生变化。
  - DEVELOP_PLAN 状态值均在状态枚举内，进度区只追加。
- 边界：只改 AGENTS 和 DEVELOP_PLAN，不改运行时代码、README 或其他文档。
- 状态：done
- 进度（只追加新行，不修改旧行）：
  - 2026-11-16 计划 用户明确要求再次执行 init-project-docs skill，任务卡确认。
  - 2026-11-16 执行 AGENTS 第 5 条追加注释写作边界；README 与其他文档未复制该规范。
  - 2026-11-16 验证 第 5 条与 skill 标准条目逐字一致；14 个任务状态全部在枚举内；`git diff --check` 无输出；`pnpm typecheck`、`pnpm test`（4 项）与 `pnpm build` 通过，构建仅有既存图表大 chunk 警告。
  - 2026-11-16 交付 产出 `AGENTS.md`、`DEVELOP_PLAN.md`；剩余差距：无。

### T15: Web 云工作区可上线 MVP（P0）

- 目标：把现有 Web 原型升级为带账号、后端 API 和真实持久化的可用 MVP，用户刷新或更换浏览器后仍能读取自己的文档。
- 验收标准：
  - 用户可注册、登录、退出；密码使用强哈希保存，会话 Cookie 为 HttpOnly、SameSite=Lax，生产环境启用 Secure。
  - 每个用户拥有独立工作区；文档、标题、标签、Markdown 与画布场景持久化到服务端 SQLite。
  - Web 的创建、读取、自动保存、移动、删除、Markdown 导入导出继续可用，且不直接把 localStorage 当生产数据源。
  - 每次写入携带 `baseRevision`；过期 revision 返回明确冲突，禁止静默覆盖。
  - 自动保存失败或 revision 冲突在界面明确提示；本地仅保留临时草稿用于恢复，不作为正文事实源。
  - API 校验会话、工作区归属、路径、请求体大小和 Origin，并对 Web 域名执行最小 CORS。
  - `pnpm typecheck`、`pnpm test`、`pnpm build` 通过；API 契约测试覆盖认证、跨用户隔离、CRUD、刷新恢复和 revision 冲突。
- 边界：不实现跨设备离线队列、实时协作、团队权限、对象存储、评论或分享；不继续 T4 桌面开发。
- 状态：done
- 进度（只追加新行，不修改旧行）：
  - 2026-11-18 计划 用户确认先交付可真实保存数据的 Web 端；复用现有原型 UI，以账号会话、SQLite API、Cloud adapter 和 revision 安全为 M1 上线范围，完成后暂停后续开发等待确认。
  - 2026-11-18 执行 `@inkloom/api` 增加 scrypt 账号、HttpOnly 会话、最小 CORS、用户隔离、SQLite 文档/历史 revision、移动与删除；`@inkloom/storage` 增加 Cloud adapter；Web 切换为云端工作区并补齐登录页、草稿恢复、冲突副本、真实版本历史和移动路径入口。
  - 2026-11-18 验证 `pnpm typecheck` 通过；`pnpm test` 31 项通过，其中 API 4 项覆盖注册登录刷新、CRUD、跨用户隔离、revision 冲突、历史恢复、移动、越界路径和 Origin 限制；`pnpm build` 通过。
  - 2026-11-18 验证 浏览器完成登录、Markdown 自动保存 revision 1→2、整页刷新恢复、Mermaid 渲染、Excalidraw 场景持久化；模拟另一会话写入后，本地冲突内容保存为独立副本，云端内容保持 `SERVER_CONFLICT_20261118` 未被覆盖。
  - 2026-11-18 交付 产出可本地运行的 Web + API MVP、Cloud adapter、API 集成测试和运行文档；剩余差距：生产域名尚未部署，由 T16 关闭。

### T16: Web 端到端测试与生产部署（P0）

- 目标：在 T15 完成后执行自动化与浏览器回归，将 Web 和 API 部署到约定生产域名并验证真实账号和持久化。
- 验收标准：
  - 单元、API 集成、浏览器端到端测试覆盖注册登录、刷新恢复、编辑保存、删除、导出和冲突提示。
  - 生产构建、健康检查、安全响应头、CORS 和 Cookie 配置在目标域名验证通过。
  - `https://inkloom.imhgl.com` 可访问 Web，`https://api.inkloom.imhgl.com/api/health` 返回健康状态。
  - 部署步骤、环境变量、备份与回滚方式同步到 `docs/DEPLOYMENT.md`。
- 边界：不进行 M2 离线同步、桌面或移动端发布。
- 状态：planned
- 进度（只追加新行，不修改旧行）：
  - 2026-11-18 计划 跟随 T15 建立生产发布与上线验证任务卡。

## 状态枚举

| 状态 | 含义 |
| --- | --- |
| planned | 已建卡确认，未动手 |
| in-progress | 执行中 |
| done | 验收标准全部满足且有验证证据 |
| blocked | 受阻；最新进度行注明原因与可否绕行 |
| canceled | 放弃；最新进度行注明原因 |

## 卡面约定

- WHEN/THEN 用于接口和交互验收。
- done 卡不删除，保留项目历史。
- 交付进度必须写明实际产出与剩余差距。

## 里程碑

| 里程碑 | 内容 | 状态 |
| --- | --- | --- |
| M0 | 原型与开源交接 | done |
| M1 | Web 云工作区可上线 MVP（T15、T16） | in-progress |
| M1D | 桌面本地 MVP（T4–T6，等待 Web 上线后确认） | planned |
| M2 | 离线队列与双向同步 | planned |
| M3 | 实时协作 | planned |
| M4 | 移动端与 HarmonyOS | planned |

技术背景见 [README.md](./README.md) 与 [产品与技术方案](./docs/PRODUCT_AND_ARCHITECTURE.md)，改码规则见 [AGENTS.md](./AGENTS.md)。
