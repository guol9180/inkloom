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
- 状态：planned
- 进度（只追加新行，不修改旧行）：
  - 2026-11-19 计划 建立响应式任务卡，等待 T18 的功能结构稳定后执行。

### T20: Web 多视口截图与真实流程验收（P0）

- 目标：在真实 Chrome 中以多个桌面和移动视口逐项验证注册登录、文档工作区、编辑模式、抽屉、弹窗、画布与错误状态，并保存可追溯截图。
- 验收标准：
  - Playwright 覆盖 320×720、375×812、768×1024、1024×768、1440×960、2560×1440 六档视口。
  - 每个视口检查页面无横向溢出、关键控件可见可操作；核心流程截图输出到 `artifacts/ui-review/`。
  - 截图逐张人工检查后记录文件名、视口、操作路径和结论到 `artifacts/ui-review/REPORT.md`。
  - `pnpm test:e2e` 全部通过。
- 边界：只做本地测试与截图验收，不部署、不修改生产、不收集真实用户数据。
- 状态：planned
- 进度（只追加新行，不修改旧行）：
  - 2026-11-19 计划 建立多分辨率验收卡，等待 T18/T19 完成后执行。

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
| M1 | Web 云工作区可上线 MVP（T15、T16、T18–T20） | in-progress |
| M1D | 桌面本地 MVP（T4–T6，等待 Web 上线后确认） | planned |
| M2 | 离线队列与双向同步 | planned |
| M3 | 实时协作 | planned |
| M4 | 移动端与 HarmonyOS | planned |

技术背景见 [README.md](./README.md) 与 [产品与技术方案](./docs/PRODUCT_AND_ARCHITECTURE.md)，改码规则见 [AGENTS.md](./AGENTS.md)。
