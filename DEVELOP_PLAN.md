# 开发计划与验收

## 当前基线

- 当前生产：M1 Web 云工作区已上线，运行 release `6857821`。
- 当前开发目标：M1.1 Web 产品级编辑器与知识流。
- 当前实现模式：只开发 Web；保留桌面、移动、HarmonyOS 和同步的领域/adapter 接入口，不实现对应 host。
- 当前任务：T44 M1.1 生产发布；用户已授权上线并明确生产数据无需保留，按全新空数据初始化。
- 桌面端 T4 保持 `in-progress` 但暂停；M1D、M2、M3、M4 未获确认不得开始。

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
- 状态：in-progress
- 进度（只追加新行，不修改旧行）：
  - 2026-11-13 计划 创建任务卡，等待开始。
  - 2026-11-18 计划 启动 T4；桌面壳复用共享 React 编辑器与 `@inkloom/storage` adapter，Rust 仅负责工作区选择、目录枚举、UTF-8 读写、原子替换、文件监听和路径/符号链接安全。验收以 Rust 单元/集成测试、adapter contract、Tauri 构建和本机文件夹回归为准。
  - 2026-11-19 进度 用户要求先提交当前桌面端代码；本提交按 WIP 处理，T4 保持 in-progress，不宣称完整磁盘工作区验收完成。

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
- 状态：done
- 进度（只追加新行，不修改旧行）：
  - 2026-11-18 计划 跟随 T15 建立生产发布与上线验证任务卡。
  - 2026-11-18 执行 启动 T16；补齐生产运行镜像、反向代理、数据库持久化与备份/回滚说明，运行全量自动化和浏览器回归后准备部署约定域名。
  - 2026-11-18 执行 新增 Playwright 端到端流程、Caddy/Docker 生产配置、GitHub Actions 手动部署与生产健康检查脚本；安全覆盖后审计从 8 high/3 moderate/1 low 收敛到 1 high/1 low，剩余 high 仅在 Excalidraw 的 Sass 构建链且不在生产 Web bundle 中。
  - 2026-11-18 验证 `pnpm typecheck` 通过；`pnpm test` 31 项通过；`pnpm build` 通过；Playwright 1 项完整流程通过，覆盖注册、编辑保存、刷新恢复、导出、删除、冲突隔离和退出；`apps/web/dist` 扫描确认不含 `@parcel/watcher`、`chokidar` 或 `picomatch`。
  - 2026-11-18 等待 生产域名尚未解析、目标服务器未提供可用部署凭据；用户要求部署前等待指令，因此不执行 DNS、SSH、容器或线上变更，T16 保持 in-progress。
  - 2026-11-18 计划 用户授权部署 `3afe1c7` 并建立生产规范；移除旧 workbench 容器但保留其镜像和数据卷，统一 Caddy 为 Inkloom Web/Edge 容器，API 仅在内网 `inkloom-edge` 网络暴露，沿用现有证书卷并补齐内存、日志与健康检查约束。
  - 2026-11-18 执行 用户要求禁止生产服务器构建应用；Compose 改为仅拉取 GHCR 中带 commit SHA 的 `inkloom-api` 与 `inkloom-edge` 镜像，GitHub Actions 负责测试、构建、推送、部署和生产验证。
  - 2026-11-18 执行 删除旧 workbench 容器并保留镜像与 `workbench_workbench-docs` 数据卷；Docker 全局启用 `10m × 3` 日志轮转；创建专用 `inkloom-deploy` 用户，部署密钥、固定 host key 与 GHCR 凭据仅存放在 GitHub Secrets。
  - 2026-11-18 执行 修复 release checkout 的 lockfile/悬空导出问题，并将 API 容器监听地址改为可配置 `HOST`；生产设置为 `0.0.0.0`，Caddy 通过 `inkloom-edge` 内网访问 API。
  - 2026-11-18 验证 干净 release worktree 通过 frozen install、`pnpm typecheck`、26 项单元/集成测试与 `pnpm build`；GitHub Actions run `44280666039` 通过 Playwright E2E、外部构建、GHCR 推送、自动部署和生产验证。
  - 2026-11-18 验证 `https://inkloom.imhgl.com` 返回 HTTP/2 200，`https://api.inkloom.imhgl.com/api/health` 返回 `{"ok":true,"service":"inkloom-api"}`；CSP、HSTS、frame、MIME 和 referrer 安全头生效，容器无 OOM，系统无 failed unit。
  - 2026-11-18 交付 Inkloom API 与共享 Caddy Edge 已部署到生产，release SHA 为 `f71fe4e4308713ec2852541371b91426ac50631d`；workbench 当前停止，镜像和数据卷保留供后续重新部署。剩余差距：无。
  - 2026-11-18 执行 清理 1Panel 安装包与解压目录、`.zai` 日志、旧 OpenClaw dashboard/ClawHub/mcporter、空 acme.sh、主机 Node/npm 和编译缓存；撤销 1Panel 遗留的 root SSH 公钥，仅保留仍在使用的 Workbench 管理公钥。
  - 2026-11-18 交付 `docs/DEPLOYMENT.md` 增补发布前检查、外部构建、固定 SHA、共享 Edge、容器监听、资源与日志上限、秘密管理和回滚规范；文档不记录主机地址、密钥、令牌或用户数据。
  - 2026-11-18 验证 排查并终止残留的交互式 `1pctl uninstall` 脚本及 `sed` 子进程；CPU 用户态占用由约 47% 降至约 0.3%，1 秒采样空闲率约 99.3%，容器 CPU 为 0%，API 健康且无 failed unit。

### T17: 集中生产部署凭据到私有控制面（P0）

- 目标：把生产部署从公开 Inkloom 仓库迁出，公开仓库只负责测试、构建和推送镜像，部署由私有 `imhgl-ops` 控制面执行。
- 验收标准：
  - 公开仓库 workflow 不再包含 SSH、服务器路径、GHCR 读取令牌或部署步骤。
  - 公开仓库的五项 `INKLOOM_DEPLOY_*` Secrets 被删除。
  - 私有 `imhgl-ops` 的 `verify` workflow 已通过 GitHub Actions 验证新凭据。
  - 服务器旧 Actions 公钥撤销，仅保留 `imhgl-ops` 新公钥。
  - 部署、回滚和凭据管理文档指向私有控制面，且不记录真实秘密。
- 边界：本任务不发布新应用版本、不重启生产容器、不修改数据卷；T4 与后续产品功能开发不在范围内。
- 状态：done
- 进度（只追加新行，不修改旧行）：
  - 2026-11-18 计划 关闭公开仓库双部署入口，切换为私有控制面唯一持有部署凭据
  - 2026-11-18 执行 公开仓库改为仅测试、构建和推送镜像；删除 SSH、服务器路径、GHCR 读取令牌与部署步骤，公开仓库五项 `INKLOOM_DEPLOY_*` Secrets 已删除
  - 2026-11-18 验证 私有 `imhgl-ops` verify run `44291541583` 成功；服务器撤旧公钥后新 Ed25519 密钥仍可只读登录并看到健康的 `inkloom-api`
  - 2026-11-18 验证 临时干净 worktree 通过 `pnpm typecheck`、26 项测试和 Web/API 生产构建；本地 T4 未提交文件未进入验证补丁或提交
  - 2026-11-18 交付 公开仓库提交 `3affe4b` 已推送，私有控制面提交 `61d73a8` 已推送；剩余差距：无

### T18: Web 工作区交互闭环与保存可靠性（P0）

- 目标：把已上线的 Web 云端工作区从“原型直连后端”完善为可日常使用的产品界面，补齐当前 MVP 内可见但未完成的操作，并消除切换和离开页面时的保存风险。
- 验收标准：
  - 工作区切换/创建/重命名、账号设置、标签增删、文档移动/重命名和删除保护都有真实交互，不保留无响应按钮、仅提示“未实现”的入口或依赖浏览器 prompt 的核心操作。
  - 自动保存、连续切换文档、刷新和离开页面时不会丢失已编辑内容；失败、冲突和恢复状态有明确且可操作的反馈。
  - 文档创建、搜索、移动/重命名、标签管理、删除、Markdown 导入导出、历史恢复、Mermaid 与 Excalidraw 流程通过自动化测试。
  - `pnpm typecheck`、`pnpm test`、`pnpm build` 通过。
- 边界：只完善现有 Web 云工作区与支撑它的 API，不开发 M2 离线同步、实时协作、桌面 Tauri、移动原生或对象存储；不改生产部署和线上数据。
- 状态：done
- 进度（只追加新行，不修改旧行）：
  - 2026-11-19 计划 用户指出当前前端仍是原型半成品；重新审阅后先关闭可见交互和保存可靠性缺口，再进入响应式与逐项截图验收。
  - 2026-11-19 执行 工作区支持创建、切换和重命名；账号设置、标签增删、文档移动/重命名、删除确认、历史恢复和退出登录改为可键盘操作的弹窗流程；文件树支持多层目录；自动保存改为串行队列并在切换前落盘。
  - 2026-11-19 验证 `@inkloom/web`、`@inkloom/api`、`@inkloom/storage` typecheck 通过；API 5 项测试通过；Chrome 中 2 项 E2E 通过，覆盖工作区管理、标签、导入、移动、刷新、导出、历史恢复、重新登录、revision 冲突和冲突副本删除。
  - 2026-11-19 交付 产出 Web/API 工作区产品化交互、保存队列与扩展 E2E；响应式和逐视口截图由 T19/T20 继续。

### T19: Web 连续分辨率自适应（P0）

- 目标：让 Web 工作区从 320px 手机到 2560px 桌面宽度都能连续、无横向溢出地完成写作和文件管理。
- 验收标准：
  - 桌面、笔记本、平板横竖屏和手机布局使用可收放侧栏/信息栏，不互相遮挡，不出现不可达的关键操作。
  - 编辑、分栏、阅读、工具栏、标签、弹窗、画布、认证页和错误页在各目标宽度下均可用。
  - 可见焦点、键盘关闭抽屉/弹窗、触控目标尺寸、`prefers-reduced-motion` 和安全区域适配完整。
  - `pnpm typecheck`、`pnpm build` 通过。
- 边界：不改变云端功能和数据模型；仅调整 Web 组合层、样式与必要的可访问交互。
- 状态：done
- 进度（只追加新行，不修改旧行）：
  - 2026-11-19 计划 建立响应式任务卡，等待 T18 的功能结构稳定后执行。
  - 2026-11-19 计划 T18 已完成并提交为 `8dba537`；开始统一视口高度、抽屉互斥、桌面信息栏收放和手机端关键操作可达性。
  - 2026-11-19 执行 Web 统一使用 `100dvh` 与安全区域；笔记本和平板的信息栏、手机的侧栏改为带遮罩的互斥抽屉；桌面信息栏折叠后正确回收栅格；手机工具栏收敛为图标、关键操作进入更多菜单；登录页、弹窗、画布和超宽稿纸重新适配。
  - 2026-11-19 验证 `@inkloom/web` typecheck 与生产构建通过；Chrome 在 320×720、375×812、768×1024、1024×768、1440×960、2560×1440 六档视口全部通过横向溢出检查并完成首轮截图复核。
  - 2026-11-19 交付 响应式组合层与样式已就绪；逐图结论和正式截图清单由 T20 固化。

### T20: Web 多视口截图与真实流程验收（P0）

- 目标：在真实 Chrome 中以多个桌面和移动视口逐项验证注册登录、文档工作区、编辑模式、抽屉、弹窗、画布与错误状态，并保存可追溯截图。
- 验收标准：
  - Playwright 覆盖 320×720、375×812、768×1024、1024×768、1440×960、2560×1440 六档视口。
  - 每个视口检查页面无横向溢出、关键控件可见可操作；核心流程截图输出到 `artifacts/ui-review/`。
  - 截图逐张人工检查后记录文件名、视口、操作路径和结论到 `artifacts/ui-review/REPORT.md`。
  - `pnpm test:e2e` 全部通过。
- 边界：只做本地测试与截图验收，不部署、不修改生产、不收集真实用户数据。
- 状态：done
- 进度（只追加新行，不修改旧行）：
  - 2026-11-19 计划 建立多分辨率验收卡，等待 T18/T19 完成后执行。
  - 2026-11-19 计划 T19 已完成并提交为 `4f6b3d5`；启动六档 Chrome 截图与逐图记录。
  - 2026-11-19 执行 新增六视口 Playwright 截图用例，覆盖登录页、工作区、文件栏、信息栏、文档菜单、工作区/标签/设置弹窗、阅读模式和已加载 Excalidraw；每个视口执行 `scrollWidth <= clientWidth` 检查。
  - 2026-11-19 执行 首轮截图定位并修正登录页小屏裁切、超宽稿纸未撑满、手机工具栏文字挤排、抽屉动画中途截屏和文档菜单层级问题，随后全量重拍。
  - 2026-11-19 验证 `pnpm test:e2e` 中 8 项 Chrome 测试全部通过（6 项多视口 + 2 项完整业务流）；`pnpm test` 32 项通过；输出 26 张截图和逐图报告。
  - 2026-11-19 交付 产出 `tests/e2e/ui-review.spec.ts`、`artifacts/ui-review/REPORT.md` 与全部截图；本轮不部署，M1 新版本等待用户指令发布。

### T21: Web 清新视觉与品牌 Logo 重设计（P0）

- 目标：把现有深色书脊式界面改造成更轻、更清新的写作工作台，并同步重做 Logo、登录页、应用主界面和品牌资产。
- 验收标准：
  - Logo 改为简约矢量交织符号，工作区、登录页、加载页和仓库品牌图统一使用。
  - 色彩改为低压力雾青、薄荷、深绿与少量杏色；侧栏、顶栏、编辑器、信息栏、弹窗和图表区域形成统一的新主题。
  - 登录页重新设计为明亮双栏入口，品牌说明、登录表单和移动端布局均保持清晰可用。
  - 保留现有功能、真实保存流程、键盘焦点、冻结的前端交互契约和 320–2560px 响应式能力。
  - `pnpm test`、Web/API 构建与 `pnpm test:e2e` 通过，并重新生成多视口截图。
- 边界：只调整 Web 品牌、视觉、文案层级和不影响领域行为的组件结构；不改 API、数据库、存储语义、部署配置或线上环境。
- 状态：done
- 进度（只追加新行，不修改旧行）：
  - 2026-11-19 计划 用户要求更清新舒服的 UI、简约 Logo 和登录页调整；建立独立视觉改版任务，完成后再等待用户确认部署。
  - 2026-11-19 执行 Logo 最终采用折页与穿行线符号，移除中文品牌混排；Web 顶栏、登录页、浏览器标题、欢迎文档和品牌 SVG 统一使用 `InkLoom`。
  - 2026-11-19 执行 主界面切换为雾青、薄荷、深绿和杏色体系；浅色文件栏替换深色书脊，编辑稿纸、信息栏、弹窗、图表区与登录页统一为明亮低压力视觉。
  - 2026-11-19 验证 `pnpm test` 32 项通过；非桌面工作区 typecheck 通过；`pnpm test:e2e` 8 项通过；六档视口重新生成 26 张截图且无横向溢出。
  - 2026-11-19 交付 产出新版 `BrandMark`、Logo SVG、favicon、登录页、全局主题、README 展示图和截图报告；新版本尚未部署。

### T22: Web 正式前端技术栈重构（P0）

- 目标：脱离原型前端结构，按 React 19、TypeScript、Vite、React Router、Tailwind CSS 4、TanStack Query、Milkdown Crepe 和可访问组件原语重建 Web 应用，在保留现有云端业务闭环的同时实现类语雀/Typora 的单区所见即所得编辑体验。
- 验收标准：
  - 登录、注册、工作区、文档、标签、历史、画布和账号操作全部保留，并由 React Router 提供可刷新、可后退的稳定 URL。
  - 设计 Token、组件变体和页面样式统一迁入 Tailwind CSS 4；复杂编辑器与画布样式只保留必要的专用 CSS。
  - 文档正文由 Milkdown Crepe 管理，编辑和排版结果处于同一区域；不提供源码/预览切换，正文持续序列化回 Markdown。
  - 编辑器提供单行完整格式工具栏，覆盖撤销重做、段落类型、行内格式、列表、任务、链接、引用、分隔线、代码块、表格和图表入口。
  - 默认新账号、新工作区和新文档使用干净空白文档，不再注入欢迎稿或演示正文。
  - 服务端状态使用 TanStack Query，文档和列表的加载、失效与失败状态具有明确反馈。
  - 品牌图标直接使用 Lucide 图标，不生成或保留自绘 Logo 资产；品牌文本只显示英文 `InkLoom`。
  - 320×720、375×812、768×1024、1024×768、1440×960、2560×1440 六档视口无横向溢出，关键操作可达。
  - `pnpm test`、非桌面 workspace typecheck、Web/API 构建与 `pnpm test:e2e` 通过，并重新生成逐张截图验收报告。
- 边界：不改 API、数据库、认证 Cookie、revision、存储语义或部署配置；不开发 M2、实时协作、桌面和移动端功能；不推送、不部署，发布继续等待用户指令。
- 状态：done
- 进度（只追加新行，不修改旧行）：
  - 2026-11-19 计划 用户确认放弃原型前端的无约束实现，按正式前端基线重做；视觉方向采用纸白工作台、松针绿和日光黄强调，Logo 从图标库选取。
  - 2026-11-19 执行 完成 React Router URL、Tailwind 4 Token、TanStack Query 服务端状态、Radix 弹窗/菜单、Zustand 瞬时状态和 Lucide 品牌图标迁移；移除原型单文件页面与自绘 Logo。
  - 2026-11-19 执行 根据用户实机反馈把编辑方案由源码/分栏预览改为 Milkdown Crepe 单区所见即所得，加入撤销重做、正文/H1/H2/H3、加粗、斜体、删除线、行内代码、列表、任务、链接、引用、分隔线、代码块、表格和标签工具栏；清除未加载公共样式导致的底部裸控件。
  - 2026-11-19 执行 内容区增加语雀式加号菜单，按“图表”和“内容”分类插入 Mermaid、Excalidraw、代码块和表格；图表继续以围栏代码块写入 Markdown。
  - 2026-11-19 执行 Web 文档区移除大标题、标签头部和视图切换，标题改名进入文档菜单；API 默认文档改为 `个人/未命名文档.md` 空白正文，新建文档同样不再添加欢迎模板。
  - 2026-11-19 验证 非桌面 workspace typecheck 通过；`pnpm test` 32 项通过；`pnpm build` 的 Web/API 构建通过；Playwright 10 项通过，覆盖空白默认文档、Milkdown 编辑、快捷格式、图表菜单插入、工作区往返、刷新恢复、冲突副本、历史恢复和六档视口。
  - 2026-11-19 交付 产出正式路由与前端分层、Milkdown 编辑器、响应式完整工具栏、图表插入菜单、Tailwind 设计系统、`artifacts/ui-review/REPORT.md` 和 27 张截图；剩余差距：尚未部署，发布继续等待用户指令。

### T23: 共享边缘拆分与最新版生产发布（P0）

- 目标：按多项目生产架构把全局 Caddy、Inkloom 静态 Web 和 Inkloom API 拆成独立运行单元，并把当前 `main` 的最新代码部署到生产。
- 验收标准：
  - 公开仓库只构建并发布 `inkloom-api` 与 `inkloom-web`，不再发布包含全局 Caddy 的 `inkloom-edge`。
  - `platform-edge` 由私有控制面管理，只负责 TLS、安全头和多项目路由。
  - `inkloom-web` 与 `inkloom-api` 只加入共享外部网络，不公开宿主机业务端口。
  - 迁移前生成并验证 SQLite 备份，迁移后保留原数据卷和回滚材料。
  - `https://inkloom.imhgl.com`、`https://api.inkloom.imhgl.com/api/health`、安全响应头和容器健康检查全部通过。
  - 新代码使用公开仓库完整 commit SHA，不在服务器构建。
- 边界：不恢复 Workbench，不改业务数据模型，不删除 `workbench_workbench-docs`，不在服务器运行包管理或容器构建。
- 状态：done
- 进度（只追加新行，不修改旧行）：
  - 2026-11-19 计划 拆分共享边缘、静态 Web 和 API，备份后以短维护窗口迁移并发布最新 main
  - 2026-11-19 执行 公开镜像改为 `inkloom-api` 与无公网端口的 `inkloom-web`；全局 Caddy 改由私有控制面独立发布，网络切换为 `platform-edge`
  - 2026-11-19 执行 修复格式化快捷键 E2E 的键盘选区竞态；修复 `inkloom-web` 只读根文件系统下 Caddy 无法写临时状态的问题
  - 2026-11-19 验证 最新提交自动 CI run `44487148562` 成功；外部镜像构建 run `44487180919` 成功；迁移 run `44488275293` 成功，临时 Caddy 配置语法校验通过
  - 2026-11-19 验证 迁移前 SQLite 归档已通过 gzip 与 tar 校验，包含 `inkloom.sqlite`、WAL 和 SHM；三个容器均 healthy、无 OOM，公网 Web 200、API 200
  - 2026-11-19 验证 `pnpm verify:production` 返回 Web 200、API 200、CORS 204、securityHeaders true；非桌面 typecheck、32 项测试、Web/API 构建和 10 项 Playwright 通过
  - 2026-11-19 交付 生产运行 SHA 为 `68578214d526c132c0b8ee9af4d744b2004ea45d`；三容器架构、迁移备份、回滚旧栈材料和部署文档已就绪，剩余差距：无

### T24: 产品规范与 Web-first M1.1 计划重排（P0）

- 目标：把随记、扁平知识库、产品级编辑器、白色主题、字体、动效、Markdown 保真和 Web-first 接入边界写入单一事实源，并建立 M1.1 可执行任务序列。
- 验收标准：
  - README、AGENTS、PRODUCT_AND_ARCHITECTURE、UX_AND_EDITOR_SPEC、HANDOFF 和子应用说明不再保留冲突的固定文件夹、知识库分组或旧桌面状态。
  - 本文包含 T25–T44 的目标、验收标准、边界、状态和依赖顺序。
  - 明确 M1.1 只实现 Web，保留 host-neutral 领域、adapter、revision、asset 和 editor command 接入口。
  - 文档交叉链接无循环复制，AGENTS 五条必建规范保持完整。
  - Markdown 检索不存在旧模式下会被误执行的现行指令；历史任务进度保留。
- 边界：只改文档和计划，不改运行时代码、数据库、部署配置或生产数据。
- 状态：done
- 进度（只追加新行，不修改旧行）：
  - 2026-11-19 计划 用户确认重新整理全部产品和交互规范，并建立 Web-only、保留其余端接入口的 M1.1 计划。
  - 2026-11-19 执行 新增 UX 与编辑器单一事实源和 ADR 0006，重写产品架构、README、AGENTS、HANDOFF、START_HERE、CONTRIBUTING、Web/Desktop 子说明和品牌基线，并建立 T25–T44。
  - 2026-11-19 验证 `git diff --check` 无输出；本地文档链接全部解析；T1–T44 连续无缺号；计划状态均在枚举内；AGENTS 必建五条完整；旧固定文件夹、分栏工作流和过期桌面描述检索无命中。
  - 2026-11-19 验证 `pnpm typecheck` 通过；`pnpm test` 32 项通过；`pnpm build` Web/API 构建通过，保留既有大 chunk 警告。
  - 2026-11-19 交付 产出 `docs/UX_AND_EDITOR_SPEC.md`、`docs/PRODUCT_AND_ARCHITECTURE.md`、`docs/adr/0006-notes-knowledge-base-and-editor-shell.md`、README/AGENTS/计划/交接与子应用文档；剩余差距：M1.1 运行时代码尚未开始，下一任务为 T25。

### T25: 随记、扁平知识库与资产数据结构迁移（P0）

- 目标：为随记生命周期、独立知识库、文档平铺归属、资产和链接索引增加可回滚的增量数据库迁移。
- 验收标准：
  - 新增 `knowledge_bases`、`assets`、`document_asset_refs`、`document_links` 和 `schema_migrations`。
  - `documents` 增加 lifecycle、knowledgeBaseId、archivedAt 和 lastOpenedAt；知识库文档无组层级。
  - 现有文档迁移为平铺随记，保留 ID、标题、正文、标签、revision 和历史；旧目录层级仅作为迁移映射记录，不自动创建知识库或固定文件夹。
  - 平铺路径冲突时生成唯一文件名，绝不覆盖正文。
  - 迁移在事务中执行，重复运行幂等，并支持生产备份恢复演练。
- 边界：不改 Web UI；不删除现有列和用户数据；不启动 M2。
- 状态：completed
- 进度（只追加新行，不修改旧行）：
  - 2026-11-19 计划 建立增量迁移任务卡，依赖 T24。
  - 2026-11-19 执行 开始 T25：建立版本化事务迁移、旧路径映射与迁移/恢复演练测试。
  - 2026-11-20 执行 新增 `schema_migrations`、`knowledge_bases`、`assets`、`document_asset_refs`、`document_links` 与旧路径映射表；`documents` 增量加入 lifecycle、knowledgeBaseId、archivedAt 和 lastOpenedAt，活动文档优先压平并稳定避让同名路径，全部旧内容仅更新归属元数据。
  - 2026-11-20 验证 `pnpm typecheck` 通过；`pnpm test` 34 项通过；`pnpm build` 通过，保留既有大 chunk 警告；迁移测试覆盖旧库迁移、幂等重开、备份恢复、失败事务回滚、正文/标签/revision/历史/扩展保留；Playwright 首轮 9/10 通过，唯一删除确认动效竞态单测重跑通过，其余 6 个分辨率与编辑器工作流均通过。
  - 2026-11-20 交付 产出 `services/api/src/migrations.ts` 与迁移测试，更新核心文档生命周期契约、服务端行映射和浏览器旧草稿兼容；剩余差距：无。

### T26: 随记与知识库工作区 API（P0）

- 目标：提供 M1.1 信息架构所需的随记、知识库、归档、移回、最近打开和排序 API。
- 验收标准：
  - API 覆盖随记列表、知识库 CRUD、知识库平铺文档列表、归档和移回随记。
  - 所有写操作校验工作区归属和 `baseRevision`；冲突返回稳定错误码。
  - 删除知识库只移回文档，不删除 Markdown、资产或历史。
  - API 契约测试覆盖跨用户隔离、归档、移回、知识库删除、并发冲突和路径更新。
- 边界：不实现全文搜索、版本 UI、API v2 或团队权限。
- 状态：completed
- 进度（只追加新行，不修改旧行）：
  - 2026-11-19 计划 建立工作流 API 任务卡，依赖 T25。
  - 2026-11-20 执行 开始 T26：实现随记、知识库、归档、移回、最近打开与排序 API。
  - 2026-11-20 执行 新增知识库 revision 增量迁移和随记/最近/知识库文档摘要、知识库 CRUD、归档、移回、打开记录接口；删除知识库在事务中把全部文档移回随记并写入历史快照，移回或删除时自动避让随记同名路径。
  - 2026-11-20 验证 `pnpm typecheck` 通过；`pnpm test` 35 项通过；`pnpm build` 通过；工作区 Playwright 4 项全部通过，覆盖保存、刷新、恢复、冲突副本、标题样式和图表入口。
  - 2026-11-20 交付 API 契约测试覆盖跨用户隔离、随记/知识库平铺列表、标题排序、归档、最近打开、知识库重命名与删除、revision 冲突和移回路径避让；剩余差距：无。

### T27: Markdown 源码保真与未知语法保护（P0）

- 目标：建立 source-slice 混合序列化模型，保证未修改或未知 Markdown 不被重写。
- 验收标准：
  - 文档解析保留源码位置，未修改块保存时使用原始 source slice。
  - 未知围栏、HTML、frontmatter、注释、链接定义和脚注定义不丢失。
  - 建立覆盖中文、嵌套列表、表格、公式、Mermaid、InkLoom 扩展块和异常语法的 golden corpus。
  - 只有 corpus、API 回读和刷新恢复测试全部通过后才允许声明 Markdown 无损。
- 边界：不实现主编辑器 UI；不引入新的自创 Markdown 容器。
- 状态：completed
- 进度（只追加新行，不修改旧行）：
  - 2026-11-19 计划 建立保真内核任务卡，依赖 T26。
  - 2026-11-20 执行 开始 T27：建立保留源码位置的 source-slice 模型、golden corpus 与 API 回读验证。
  - 2026-11-20 执行 在 `@inkloom/editor` 新增基于 mdast/GFM/数学语法的 source-slice 模型，记录块类型、源码偏移、行号和保护状态；未修改块始终拼接原始切片，frontmatter、HTML、未知围栏、链接定义、脚注定义与异常语法保留原文。
  - 2026-11-20 验证 10 组 golden corpus 覆盖中文、内联样式、链接图片、嵌套列表、任务、引用、表格、代码围栏、Mermaid、公式、脚注、定义、HTML、InkLoom canvas/file 块、frontmatter、异常语法、CRLF 和无末尾换行；`pnpm typecheck` 通过；`pnpm test` 50 项通过；`pnpm build` 通过；API 回读、更新、历史恢复均逐字节保持复杂 Markdown。
  - 2026-11-20 交付 source-slice 保真内核与 API 回读/历史恢复证据；剩余差距：全局“Markdown 无损”声明仍需 T29–T43 的主编辑器接入、真实刷新恢复和完整验收后确认。

### T28: 白色应用壳、路由与认证页（P0）

- 目标：按新信息架构重建 Web 应用壳、认证页和路由，并统一白色主题。
- 验收标准：
  - 登录和注册使用居中近白面板，不铺满全屏双栏内容。
  - 顶部栏为 `Logo + 向下箭头`，不显示工作区名称。
  - 随记、知识库和预览优先路由可刷新、可后退并有认证保护。
  - 未选中文档时显示模式对应的快捷创建空状态。
  - 骨架屏、空状态和错误页使用统一应用壳。
- 边界：暂不实现新编辑器命令和知识库业务流程。
- 状态：completed
- 进度（只追加新行，不修改旧行）：
  - 2026-11-19 计划 建立应用壳任务卡，依赖 T27 的领域接口。
  - 2026-11-20 执行 重建近白应用壳与居中认证页；新增 `/notes`、`/knowledge` 可刷新路由、旧文档链接兼容重定向、认证保护、顶部 `Logo + 向下箭头` 工作区菜单、随记/知识库导航、搜索框右侧统一 `+` 菜单和模式化空状态。
  - 2026-11-20 验证 `pnpm typecheck` 通过；`pnpm test` 50 项通过；`pnpm build` 通过且首屏 chunk 从原型编辑器的 MB 级降至 Web 主包约 461 kB；Playwright 路由/保存/刷新/退出登录/认证回跳 3 项通过；六档分辨率 6 项通过，320 移动抽屉等待动画结束后无裁切或横向溢出。
  - 2026-11-20 交付 产出 `product-workspace-page.tsx`、骨架屏、近白 token、认证页与路由验收；剩余差距：正文编辑器仍使用临时文本编辑面，下一任务 T29 替换为产品级 Milkdown Editor Shell。

### T29: 产品级 Milkdown Editor Shell（P0）

- 目标：保留 Milkdown/ProseMirror 内核，建立统一工具栏、斜杠菜单、块手柄、快捷键和上下文工具栏。
- 验收标准：
  - 工具栏、斜杠菜单和快捷键共享 Command Registry。
  - 行首只显示 `⠿`；单击打开菜单，拖动调整顺序。
  - `Ctrl+J` 聚焦文档搜索，`Ctrl+K` 在编辑器中添加链接。
  - 固定工具栏单行横向滚动，移动端无页面横向溢出。
  - 选区悬浮工具条、焦点返回和 reduced-motion 行为通过测试。
- 边界：不实现图表、资产和知识库预览。
- 状态：completed
- 进度（只追加新行，不修改旧行）：
  - 2026-11-19 计划 建立 Editor Shell 任务卡，依赖 T27/T28。
  - 2026-11-20 执行 新增统一 Editor Command Registry，工具栏、斜杠菜单、快捷键和选区工具条共享命令定义；固定单行工具栏支持横向滚动，正文块 gutter 仅显示 `⠿`，点击打开块菜单、指针拖动排序、复制与删除。
  - 2026-11-20 执行 接入 `Ctrl+J` 文档搜索、`Ctrl+K` 链接命令、选区悬浮格式条、焦点回到编辑器及 reduced-motion；撤销原型“隐藏首个 H1”规则，并让 `⠿` 按手柄图层坐标和块首行行高居中对齐。
  - 2026-11-20 验证 `pnpm typecheck` 通过；`pnpm test` 50 项通过；`pnpm build` 通过；Playwright 12 项全部通过，覆盖命令注册表、工具栏、斜杠菜单、Ctrl+J、Ctrl+K、选区工具条、块手柄拖动、新建空白随记、真实保存/刷新、知识库路由与 320–2560 六档无横向溢出截图。
  - 2026-11-20 交付 产出 `command-registry.ts`、`product-markdown-editor.tsx` 和编辑器 E2E；剩余差距：更完整的表格/块操作属于 T30，知识库预览编辑属于 T38。

### T30: 正文块与表格完整能力（P0）

- 目标：完成标题、列表、任务、引用、代码、分割线、表格、高亮、折叠和公式块。
- 验收标准：
  - 各块符合 UX 规范的视觉、Markdown 映射和快捷键。
  - 表格支持表头、对齐、增删行列、TSV/HTML 粘贴和内部滚动。
  - 表格第一版不提供合并单元格，未知 HTML 表格保留。
  - callout、toggle、代码块和引用完成往返与键盘验收。
- 边界：不实现 Mermaid、Excalidraw、图片和附件。
- 状态：completed
- 进度（只追加新行，不修改旧行）：
  - 2026-11-19 计划 建立基础块任务卡，依赖 T29。
  - 2026-11-20 执行 开始 T30：补齐基础文本块、表格交互和 Markdown 往返，并保留 T29 的 `⠿` 首行中线对齐。
  - 2026-11-20 执行 补齐 H1–H6、列表、任务、引用、代码、分割线、公式、GitHub 风格提示块和原生 `details` 折叠块；表格增加专用上下文工具栏、增删行列、对齐、内部滚动及 TSV/HTML 粘贴，表头行禁止直接删除以避免破坏 GFM 结构。
  - 2026-11-20 验证 `pnpm typecheck` 通过；`pnpm test` 50 项通过；`pnpm build` 通过；Playwright 15 项通过，覆盖结构化块保存/刷新恢复、粘贴、键盘任务列表、引用与代码往返以及 320–2560 六档视口无页面横向溢出。
  - 2026-11-20 交付 产出共享块插件、表格上下文工具栏、Markdown 标记规范化与编辑器 E2E；1440 和 320 截图保存在已忽略的 `test-results/ui-review/`；剩余差距：手动保存按钮按用户确认保留到 T31 自动保存链路完成后移除。

### T31: 草稿、自动保存、检查点与冲突（P0）

- 目标：把保存链路升级为 IndexedDB 草稿、串行保存、历史检查点和安全冲突恢复。
- 验收标准：
  - localStorage 只保留 UI 偏好和 active ID，完整草稿与画布快照进入 IndexedDB。
  - 保存请求串行、合并旧快照并在内容哈希未变时跳过。
  - 停止输入约 2 秒或连续编辑满 30 秒生成历史检查点。
  - revision 冲突创建云端副本；失败时草稿不丢失。
  - 多标签页只允许一个编辑所有者。
- 边界：不实现跨设备离线队列。
- 状态：completed
- 进度（只追加新行，不修改旧行）：
  - 2026-11-19 计划 建立保存可靠性任务卡，依赖 T26/T30。
  - 2026-11-20 计划 用户确认内容区全部走自动保存，不保留手动“保存”按钮；该交互在自动保存链路完成后一并移除。
  - 2026-11-20 执行 开始 T31：梳理现有保存状态、浏览器草稿 adapter 与 revision 冲突接口，随后接入自动保存和单编辑所有者。
  - 2026-11-20 执行 新增 IndexedDB 草稿仓库与旧 localStorage 草稿迁移；内容变化立即写入本机草稿，800ms 后串行自动保存，2 秒空闲或连续编辑满 30 秒生成检查点，内容哈希未变时跳过写入。
  - 2026-11-20 执行 移除手动“保存”按钮；接入保存状态指示、离线/失败重试、revision 冲突副本、服务器版本重载，以及 Web Locks + BroadcastChannel 单标签页编辑所有权。
  - 2026-11-20 验证 `pnpm typecheck` 通过；`pnpm test` 51 项通过；`pnpm build` 通过；Playwright 19 项通过，覆盖自动保存、2 秒检查点、IndexedDB 断网恢复、冲突副本、哈希跳过、多标签接管及 320–2560 六档视口无页面横向溢出。
  - 2026-11-20 交付 产出 IndexedDB 草稿 adapter、自动保存 hook、编辑所有权 hook、检查点 API 开关和保存 UI；剩余差距：资产上传等待属于 T32/T33。

### T32: Content-addressed 资产服务（P0）

- 目标：提供工作区隔离、内容哈希和可替换对象存储的图片、附件、Excalidraw 场景和 SVG 资产能力。
- 验收标准：
  - 支持二进制流式上传、SHA-256、MIME/文件头/大小校验和秒传。
  - 资产读取校验工作区权限；不可变内容地址不覆盖旧资产。
  - 生产持久卷实现与 S3-compatible adapter 契约分离。
  - 引用失效和孤儿清理不会删除仍被文档使用的资产。
- 边界：不把 Base64 或大 JSON 写入正文；不接 CDN。
- 状态：completed
- 进度（只追加新行，不修改旧行）：
  - 2026-11-19 计划 建立资产服务任务卡，依赖 T25/T26。
  - 2026-11-20 执行 开始 T32：盘点现有 asset 数据表、API 路由和部署持久卷，建立内容寻址存储 adapter 与工作区权限校验。
  - 2026-11-20 执行 新增独立 `AssetBlobStore` 契约与本地持久卷实现；原始二进制流按 SHA-256 写入不可变内容地址，并完成 MIME、魔数、大小、工作区权限和同哈希秒传校验。
  - 2026-11-20 执行 接入资产上传、HEAD/GET、信息查询与引用感知的孤儿清理；文档创建和保存会同步 `document_asset_refs`，仍被 Markdown 引用的资产不会被删除。
  - 2026-11-20 验证 `pnpm typecheck` 通过；`pnpm test` 52 项通过；`pnpm build` 通过；API 集成测试覆盖超过 2 MiB 的流式上传、SHA-256、秒传、MIME 魔数拒绝、缓存头、HEAD、工作区隔离、引用保留和无引用清理。
  - 2026-11-20 交付 产出资产存储契约、本地持久卷 adapter、资产 API、SQLite 引用同步和部署环境变量；剩余差距：图片/附件编辑器接入属于 T33。

### T33: 图片与附件块（P0）

- 目标：完成粘贴、拖入、上传、显示、下载和导出全链路。
- 验收标准：
  - 图片和附件支持上传进度、取消、重试和内容去重。
  - 图片支持对齐、宽度、alt、说明、大图和替换。
  - 附件使用可移植注释加普通下载链接。
  - ZIP 导出包含 Markdown、图片、附件、画布场景和 SVG。
- 边界：不实现对危险文件的内联执行或第三方嵌入。
- 状态：completed
- 进度（只追加新行，不修改旧行）：
  - 2026-11-19 计划 建立资产块任务卡，依赖 T32。
  - 2026-11-20 执行 开始 T33：接入图片/附件上传命令、编辑器粘贴与拖入入口，并定义可移植 Markdown 注释包装。
  - 2026-11-20 执行 接入图片选择、剪贴板粘贴、拖放、上传进度、取消、重试与替换；图片复用 Milkdown 的说明、比例缩放和尺寸能力，并补充左/中/右对齐与大图预览。
  - 2026-11-20 执行 附件使用 `inkloom:file` HTML 注释包装和普通 Markdown 下载链接往返；新增单文件导出按钮，生成包含 Markdown、图片、附件和画布场景的无损 ZIP。
  - 2026-11-20 验证 `pnpm typecheck` 通过；`pnpm test` 53 项通过；`pnpm build` 通过；Playwright 22 项通过，覆盖图片/附件上传、失败重试、进度取消、粘贴、拖放、替换、对齐、刷新恢复、双击大图与 ZIP 下载内容。
  - 2026-11-20 交付 产出图片/附件上传命令、资产上传 UI、附件 NodeView、图片块菜单、ZIP 写入器和导出链路；剩余差距：Mermaid 和 Excalidraw 独立块分别属于 T34/T35。

### T34: Mermaid 独立图表块（P0）

- 目标：把 Mermaid 从普通围栏占位升级为源码与实时预览同屏的 NodeView。
- 验收标准：
  - 桌面左右分栏，移动端上下排列，支持块级全屏。
  - 使用 CodeMirror 6、约 300ms 防抖、模板和错误行提示。
  - 语法错误不清空源码，Markdown 只保存标准 `mermaid` fence。
  - Mermaid strict 安全级别、唯一 ID 和懒加载生效。
- 边界：不加入 PlantUML、Flowchart 或 Graphviz 渲染器。
- 状态：completed
- 进度（只追加新行，不修改旧行）：
  - 2026-11-19 计划 建立 Mermaid 任务卡，依赖 T29/T30。
  - 2026-11-20 执行 开始 T34：盘点现有 diagrams 包与 Mermaid 依赖，接入懒加载块渲染和安全错误边界。
  - 2026-11-20 执行 新增独立 `inkloom_mermaid` ProseMirror 节点与 Markdown remark 往返，围栏仍序列化为标准 `mermaid` code fence；实现 CodeMirror 6 源码编辑、约 300ms 防抖预览、常用模板、错误行提示、全屏和桌面左右/移动上下布局。
  - 2026-11-20 执行 Mermaid 保持 strict 安全级别并继续经过 DOMPurify；关闭 HTML label 以输出原生 SVG 文本，避免安全清洗后节点文字丢失。图表包仅在节点首次渲染时动态加载，并接入工具栏与斜杠菜单的新增入口。
  - 2026-11-20 验证 `pnpm typecheck` 通过；`pnpm test` 57 项通过；`pnpm build` 通过；Playwright 23 项全部通过，覆盖 Mermaid 插入、源码/预览同屏、语法错误保留源码、标准围栏自动保存、全屏 Esc、刷新恢复和 320px 单列无横向溢出。构建仍有既有大 chunk 告警，Mermaid 已按按需 chunk 输出。
  - 2026-11-20 交付 产出 Mermaid 安全渲染器、模板与错误解析、独立编辑器节点、CodeMirror 源码面板、全屏和响应式样式；剩余差距：Excalidraw 独立画布资产块属于 T35。

### T35: Excalidraw 画布资产块（P0）

- 目标：实现 SVG 预览卡、场景资产和块级全屏编辑。
- 验收标准：
  - 文档首屏只加载 SVG，不加载 Excalidraw bundle。
  - 编辑保存生成独立 scene 与 SVG 资产，Markdown 保存 portable 注释块。
  - 现有 `extensions.canvas` 中的画布数据迁移为 scene、SVG 和 portable 注释块，迁移失败时保留原扩展数据。
  - 2 秒临时快照、关闭保存、刷新恢复和 revision 冲突流程通过。
  - 资产缺失不清空引用，允许重新上传或删除。
- 边界：不实现多人同时绘制。
- 状态：completed
- 进度（只追加新行，不修改旧行）：
  - 2026-11-19 计划 建立画布任务卡，依赖 T32/T33。
  - 2026-11-20 执行 开始 T35：盘点 `extensions.canvas`、资产 API、文档 revision 与现有 Excalidraw 占位实现，确定 SVG 预览、scene 资产和可移植注释块的迁移路径。
  - 2026-11-20 执行 新增独立 `inkloom_canvas` 原子节点和 `inkloom:canvas` 便携 Markdown 块；正文保存标准 SVG 图片引用、scene/preview 内容寻址路径，不把 Excalidraw elements JSON 写入正文。
  - 2026-11-20 执行 接入 `.excalidraw` 场景与 SVG 预览双资产上传，首屏仅渲染 SVG；Excalidraw 引擎和样式仅在编辑/迁移时动态加载。实现每 2 秒本地临时快照、取消后恢复、“保存并关闭”、缺失资产提示与重新编辑入口。
  - 2026-11-20 执行 现有 `extensions.canvas` 自动导出 scene/SVG、上传资产并插入便携块；迁移失败不删除原扩展数据。资产响应支持 Web/API 子域分离的 CORS/CORP，并按图片用途区分 SVG inline 预览与直接下载；下载读取使用独立缓存键，避免复用无 CORS 的图片缓存。
  - 2026-11-20 验证 `pnpm typecheck` 通过；`pnpm test` 62 项通过；`pnpm build` 通过；Playwright 25 项全部通过，覆盖真实绘制、双资产上传、标准 Markdown 往返、2 秒快照、保存/刷新、旧扩展迁移保留、普通图片附件导出、自动保存冲突和六档视口。构建仍有既有大 chunk 告警，Excalidraw 保持按需 chunk。
  - 2026-11-20 交付 产出 Canvas 便携块协议、scene/SVG 导出助手、Excalidraw 编辑器动态加载、画布网络与卡片、旧画布迁移、快照恢复和端到端测试；剩余差距：无。

### T36: 随记工作流（P0）

- 目标：完成扁平随记导航、标签、最近文档、导入导出和归档入口。
- 验收标准：
  - 左侧随记无固定文件夹、无重复新建按钮，所有新建入口在搜索框右侧 `+`。
  - 新建随记直接创建空白 Markdown 并进入编辑。
  - 标签筛选、最近文档、删除和导出可用。
  - 归档前保存成功，失败则保留在随记和本地草稿。
- 边界：不实现知识库预览和搜索索引。
- 状态：completed
- 进度（只追加新行，不修改旧行）：
  - 2026-11-19 计划 建立随记工作流任务卡，依赖 T26/T31/T33。
  - 2026-11-20 执行 开始 T36：盘点现有随记列表、`+` 菜单、标签、最近文档和归档入口，先补齐随记边界内工作流。
  - 2026-11-20 执行 随记新建改为直接创建空白 Markdown 并进入编辑，标题弹窗只保留给知识库；搜索框右侧 `+` 继续统一承载随记、知识库与 Markdown 导入入口。
  - 2026-11-20 执行 标签纳入自动保存状态机，正文与标签共用草稿、串行写入、冲突副本和 revision；补充侧栏标签筛选、最近文档刷新、标签编辑弹窗、导出、删除确认和归档入口。
  - 2026-11-20 验证 `pnpm typecheck` 通过；`pnpm test` 62 项通过；`pnpm build` 通过；Playwright 27 项全部通过，覆盖随记无弹窗新建、标签保存与刷新、标签筛选、最近文档、导出、删除、归档前保存、冲突恢复和六档视口。构建仍有既有大 chunk 告警。
  - 2026-11-20 交付 产出扁平随记创建/导航/标签/最近/导出/删除/归档流程；剩余差距：知识库内平铺管理、移回与删除库属于 T37。

### T37: 扁平知识库工作流（P0）

- 目标：完成知识库创建、平铺文档、归档、移回和删除知识库。
- 验收标准：
  - 知识库是顶层容器，内部无分组或嵌套；文档直接平铺。
  - 归档弹窗直接选择知识库，不出现二次确认。
  - 删除知识库移回全部文档，不删除正文或历史。
  - 移动和排序携带 revision，冲突不静默覆盖。
- 边界：不允许在知识库中直接新建文档。
- 状态：completed
- 进度（只追加新行，不修改旧行）：
  - 2026-11-19 计划 建立知识库任务卡，依赖 T26/T36。
  - 2026-11-20 执行 开始 T37：核对现有平铺知识库列表、归档、移回和删除知识库 API，补齐 revision 安全与界面操作。
  - 2026-11-20 执行 知识库侧栏新增重命名、上移、下移和删除知识库入口；排序交换分别携带两个知识库的 `baseRevision`，冲突时不静默覆盖。
  - 2026-11-20 执行 知识库文档新增“移回随记”；移回前先 flush 自动保存并读取最新 revision。删除知识库前同样使用知识库 revision 校验，文档正文、标签、资产引用和版本历史全部保留并回到随记。
  - 2026-11-20 验证 `pnpm typecheck` 通过；`pnpm test` 62 项通过；`pnpm build` 通过；Playwright 29 项全部通过，覆盖平铺知识库、归档、移回、删除库保留文档、重命名、revision 排序、自动保存和六档视口。构建仍有既有大 chunk 告警。
  - 2026-11-20 交付 产出完整扁平知识库管理、文档往返与删除保护；剩余差距：知识库文档默认只读预览属于 T38。

### T38: 知识库预览优先与编辑切换（P0）

- 目标：知识库文档默认只读预览，显式进入编辑并在完成后返回预览。
- 验收标准：
  - 预览隐藏工具栏和块手柄，允许选择、复制、链接、图片和图表查看。
  - 点击编辑后不重载文档、不跳滚动位置、不改变阅读排版。
  - 完成前保存成功；失败保持编辑状态和草稿。
  - 刷新后恢复只读预览；可恢复草稿需要显式操作。
- 边界：不改变知识库归属或权限语义。
- 状态：completed
- 进度（只追加新行，不修改旧行）：
  - 2026-11-19 计划 建立预览切换任务卡，依赖 T37。
  - 2026-11-20 执行 知识库文档改为在同一个 Milkdown/ProseMirror 内容区中预览；默认关闭编辑能力并隐藏格式栏、块手柄、Mermaid 源码编辑和画布编辑入口。
  - 2026-11-20 执行 显式“编辑/完成”切换不卸载文档，切换时补偿工具栏高度以保持当前滚动位置；保存失败保持编辑状态，完成成功后返回与编辑时相同的阅读排版。
  - 2026-11-20 验证 `pnpm typecheck` 通过；`pnpm test` 62 项通过；`pnpm build` 通过；Playwright 30 项全部通过，覆盖默认只读、无工具栏/手柄、滚动保持、保存失败留编辑态、刷新回预览、单编辑所有权降级为只读及六档视口。构建仍有既有大 chunk 告警。
  - 2026-11-20 交付 产出统一预览/编辑内容区、只读图表和画布视图、所有权只读降级与保存失败保护；剩余差距：无。

### T39: SQLite FTS5 文档搜索（P0）

- 目标：用服务端全文索引替代下载整个工作区后的客户端搜索。
- 验收标准：
  - 索引标题、正文、标签、路径和文件名。
  - 中文搜索策略、结果摘要、随记/知识库分类和分页通过测试。
  - 1,000 篇文档基准满足 P95 目标。
  - 搜索失败只影响搜索区域。
- 边界：不引入独立搜索引擎或 AI 语义搜索。
- 状态：completed
- 进度（只追加新行，不修改旧行）：
  - 2026-11-19 计划 建立搜索任务卡，依赖 T25/T36/T37。
  - 2026-11-20 执行 开始 T39：盘点 SQLite migration、文档写入事务、列表摘要和 Web 搜索入口，确定 FTS5 表与中文分词回退策略。
  - 2026-11-20 执行 新增 SQLite FTS5 migration 与索引同步；标题、正文、标签、路径、文件名进入索引，生命周期和知识库归属用于结果分类。应用层为中文生成单字与相邻二元组词项，单字、双字和英文查询均可命中。
  - 2026-11-20 执行 Web 搜索改为服务端无限分页查询，增加 250ms 防抖、随记/知识库分组、原始正文高亮摘要、标签和分类跳转；搜索失败仅在侧栏显示，不阻塞正文。
  - 2026-11-20 验证 `pnpm typecheck` 通过；`pnpm test` 68 项通过，其中 1,000 篇文档搜索基准强制断言 P95 小于 120ms；`pnpm build` 通过；Playwright 31 项全部通过，覆盖中文检索、跨随记/知识库结果、高亮摘要、跳转、自动保存和六档视口。构建仍有既有大 chunk 告警。
  - 2026-11-20 交付 产出 FTS5 schema 与迁移、索引同步、中文词项/查询/摘要工具、搜索 API、CloudClient 无限分页和 Web 搜索结果界面；剩余差距：大纲、反向链接与文档信息栏属于 T40。

### T40: 大纲、真实反向链接与文档信息栏（P0）

- 目标：补齐知识库阅读页需要的上下文信息。
- 验收标准：
  - 大纲由 AST 节点位置驱动并可准确定位标题。
  - 反向链接来自服务端链接索引，支持命中摘要和断链。
  - 信息栏展示资产、标签、最近版本和高级属性。
  - 局部加载失败不阻塞正文。
- 边界：不实现知识图谱、标签网络或 AI 推荐。
- 状态：completed
- 进度（只追加新行，不修改旧行）：
  - 2026-11-19 计划 建立信息栏任务卡，依赖 T39。
  - 2026-11-20 执行 开始 T40：盘点 AST 标题位置、document_links 同步、资产引用和现有文档信息组件，先补齐服务端反向链接契约。
  - 2026-11-20 执行 大纲改为 mdast AST 提取，记录标题 offset/line/column，并处理重复标题 ID；信息栏按 AST 顺序定位 ProseMirror 标题，不依赖正则扫描代码围栏。
  - 2026-11-20 执行 新增内部 Markdown/Wiki 链接解析与 `document_links` 同步，保存、创建、移动、删除和知识库迁移都会维护反向链接、目标路径与断链状态。
  - 2026-11-20 执行 新增文档上下文 API 与右侧信息栏，聚合出链、真实反链、命中摘要、断链、资产、最近版本和高级属性；上下文独立加载，失败仅在栏内提示。
  - 2026-11-20 验证 `pnpm typecheck` 通过；`pnpm test` 70 项通过；`pnpm build` 通过；Playwright 33 项全部通过，覆盖 AST 大纲定位、真实反链、断链、路径迁移、信息栏加载和局部失败隔离。构建仍有既有大 chunk 告警。
  - 2026-11-20 交付 产出 AST 大纲位置、链接解析/回填/同步、文档上下文 API、CloudClient 契约和响应式信息栏；剩余差距：历史版本交互属于 T41。

### T41: 版本历史预览、差异与恢复（P0）

- 目标：提供只读历史预览、块级差异和安全恢复。
- 验收标准：
  - 历史抽屉按日期和检查点类型展示。
  - 历史预览使用同一 Markdown NodeView，Mermaid、画布和附件状态正确。
  - 恢复先保存当前状态，再追加新 revision。
  - 缺失资产保留引用并明确提示。
- 边界：不做旧版本直接编辑或多版本合并。
- 状态：completed
- 进度（只追加新行，不修改旧行）：
  - 2026-11-19 计划 建立历史任务卡，依赖 T31/T40。
  - 2026-11-20 执行 新增历史抽屉与只读历史预览，历史 Markdown 复用同一 ProductMarkdownEditor/NodeView；支持内容预览与顶层块差异切换。
  - 2026-11-20 执行 恢复前先 flush 当前自动保存并读取最新 revision，再调用服务端恢复接口追加新 revision；自动保存状态机通过 `replaceDocument` 原子替换基线，避免恢复后下一次编辑产生伪冲突。
  - 2026-11-20 验证 `pnpm typecheck` 通过；`pnpm test` 72 项通过；`pnpm build` 通过；Playwright 34 项全部通过，覆盖历史 Mermaid 预览、块差异、恢复前保存、追加 revision、刷新持久化和六档视口。构建仍有既有大 chunk 告警。
  - 2026-11-20 交付 产出 revision 列表/抽屉、块差异算法、NodeView 历史预览、资产缺失提示和安全恢复链路；剩余差距：无。

### T42: 全局视觉、字体、动效与响应式收口（P0）

- 目标：把白色主题、Geist 字体、圆润组件、骨架屏和丝滑动效统一应用到全站。
- 验收标准：
  - 颜色、字体、圆角、阴影、间距和动效全部使用语义 token。
  - 320、375、768、1024、1440、2560 六档视口无页面横向溢出。
  - 所有内容加载使用尺寸稳定的骨架屏；按钮保留文字加载状态。
  - hover、focus、pressed、disabled、loading 和 reduced-motion 完整。
  - 200% 浏览器缩放、键盘、触控和安全区域通过。
- 边界：不新增业务能力。
- 状态：completed
- 进度（只追加新行，不修改旧行）：
  - 2026-11-19 计划 建立视觉收口任务卡，依赖 T28–T41。
  - 2026-11-20 执行 开始 T42：用现有六档截图和源码审计统一语义色、浮层阴影、触控与 reduced-motion 行为，并补 200% 缩放和键盘验收。
  - 2026-11-20 执行 增加 surface、shadow、radius、easing 和 duration 语义 token，统一登录页、工作区、编辑器、信息栏、历史抽屉和弹窗常用表面；提高过小元信息字号，并补齐粗指针 44px 触控目标。
  - 2026-11-20 执行 保留用户明确要求的单一白色主题，不引入暗色翻转；2560 宽屏保持受控阅读列宽，320 到 2560 六档均无横向溢出。
  - 2026-11-20 验证 `pnpm typecheck` 通过；`pnpm test` 72 项通过；`pnpm build` 通过；Playwright 35 项全部通过，包含触控、键盘、200% 缩放、reduced-motion、骨架屏、弹窗动效和六档截图。视觉预检评分：工艺 4.5、需求契合 5、系统一致性 4.5、无障碍 4.5、文案 4.5。构建仍有既有大 chunk 告警。
  - 2026-11-20 交付 产出统一白色视觉 token、响应式与触控/动效收口；剩余差距：无。

### T43: M1.1 全链路测试与视觉验收（P0）

- 目标：用自动化与逐图验收证明编辑器、工作流和数据安全达到发布条件。
- 验收标准：
  - Markdown golden corpus、API 集成、资产、保存冲突、归档、预览编辑和搜索全部通过。
  - Playwright 覆盖六档视口和主要业务流，截图输出到已忽略的 `test-results/ui-review/`，不提交版本库。
  - `pnpm typecheck`、`pnpm test`、`pnpm build` 和 `pnpm test:e2e` 通过。
  - 性能、无横向溢出、200% 缩放、键盘和 reduced-motion 有实机记录。
  - 所有未解决风险如实写入报告。
- 边界：不部署生产，不收集真实用户数据。
- 状态：completed
- 进度（只追加新行，不修改旧行）：
  - 2026-11-19 计划 建立全链路验收任务卡，依赖 T42。
  - 2026-11-20 执行 开始 T43：补关键功能截图，汇总自动化、性能、跨视口和已知风险；T44 部署不启动。
  - 2026-11-20 执行 增加 Mermaid、画布、搜索、信息栏和历史版本关键功能截图；截图仍写入已忽略的 `test-results/ui-review/`。
  - 2026-11-20 验证 `pnpm typecheck` 通过；`pnpm test` 72 项通过；`pnpm build` 通过；Playwright 35 项通过；1,000 篇 FTS5 查询 P95 小于 120ms；六档视口、触控、键盘、200% 缩放和 reduced-motion 全部通过。
  - 2026-11-20 交付 产出 [M1.1 验收报告](./docs/M1_1_ACCEPTANCE.md)，记录核心链路、截图索引、构建告警、浏览器覆盖、SQLite experimental API 等发布风险；T44 等待用户授权。
  - 2026-11-20 验证 最终再次执行 `pnpm typecheck`、`pnpm test`（72 项）、`pnpm build`、Playwright（35 项）全部通过；修复画布缓存命中时 loading 状态竞态，并确认历史 Mermaid、画布、搜索、信息栏和历史抽屉截图均为就绪状态。

### T44: M1.1 生产发布与全新数据初始化（P0）

- 目标：在用户明确授权后发布 M1.1 Web 与 API 镜像，并按要求清空旧生产数据、以空数据结构完成上线验证。
- 验收标准：
  - 发布前记录当前 release SHA；用户确认旧生产数据无需保留，不执行旧数据迁移。
  - 仅在 GitHub Actions 外部构建，私有控制面按完整 SHA 部署。
  - 生产 Web/API、Cookie/CORS、安全头、空库初始化、注册登录、随记/知识库、归档和预览编辑通过。
  - 发布后检查容器健康、资源和日志，不删除旧 release 回滚材料。
- 边界：不发布桌面、移动、M2 或协作能力；不迁移旧文档与资产，清空操作仅针对 InkLoom 生产数据卷。
- 状态：in-progress
- 进度（只追加新行，不修改旧行）：
  - 2026-11-19 计划 建立生产迁移任务卡，依赖 T43 和用户明确授权。
  - 2026-11-21 计划 用户明确授权发布，并说明生产环境数据不重要、可直接删除；将任务调整为不迁移旧数据，部署后从空库初始化。
  - 2026-11-21 执行 镜像发布门禁发现自动保存竞态：保存成功后的父级快照更新会重建 autosave effect，可能丢失连续编辑期间待提交的内容；开始修复后重新执行完整发布验证。
  - 2026-11-21 执行 `useDocumentAutosave` 改用文档 ref 读取最新快照，effect 仅绑定用户、工作区和文档 ID；新增“首次保存响应被延迟时继续输入”端到端回归，确保后续输入不会被保存成功后的父级快照覆盖。
  - 2026-11-21 验证 `pnpm typecheck`、`pnpm test`（72 项）、`pnpm build` 与 Playwright（36 项）全部通过；构建仍仅有既存大 chunk 告警。
  - 2026-11-21 执行 GitHub Linux CI 暴露历史版本用例依赖编辑器中心点击和按键输入时序；改为直接定位文档末尾段落并使用 `insertText`，移除对 Mermaid NodeView 命中位置和平台按键行为的依赖。
  - 2026-11-21 验证 历史版本用例连续运行 3 次全部通过。

### T45: 移除仓库内 UI Review 截图归档（P0）

- 目标：删除无长期价值的版本化 UI 截图和报告，同时保留六档视口的自动化溢出与业务流检查。
- 验收标准：
  - `artifacts/ui-review/` 中全部已跟踪截图和报告从仓库删除。
  - `tests/e2e/ui-review.spec.ts` 继续执行，截图改写为 `test-results/ui-review/`。
  - `test-results/` 保持被 `.gitignore` 忽略，测试不会重新污染工作树。
  - 当前计划和后续验收不再要求提交整套截图。
- 边界：不删除跨视口测试，不改变产品代码、生产数据或部署。
- 状态：done
- 进度（只追加新行，不修改旧行）：
  - 2026-11-19 计划 用户确认仓库内 UI Review 截图没有长期价值，建立测试产物清理任务。
  - 2026-11-19 执行 删除 `artifacts/ui-review/` 下 27 个已跟踪截图和报告；跨视口 Playwright 测试保留，截图目录改为 `test-results/ui-review/`，该路径已被 `.gitignore` 覆盖。
  - 2026-11-19 验证 `pnpm typecheck` 通过；Playwright 六档视口共 6 项通过（25.5s），确认测试产物不会污染工作树。
  - 2026-11-19 交付 仓库不再跟踪整套 UI Review 截图；剩余差距：无。

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
| M1 | Web 云工作区可上线 MVP（T15、T16、T18–T22） | done |
| M1.1 | Web 产品级编辑器与知识流（T24–T44） | in-progress |
| M1D | 桌面本地 MVP（T4–T6，等待 M1.1 后确认） | planned |
| M2 | 离线队列与双向同步 | planned |
| M3 | 实时协作 | planned |
| M4 | 移动端与 HarmonyOS | planned |

技术背景见 [README.md](./README.md) 与 [产品与技术方案](./docs/PRODUCT_AND_ARCHITECTURE.md)，改码规则见 [AGENTS.md](./AGENTS.md)。
