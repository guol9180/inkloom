# 开发计划与验收

## 当前基线

- 当前生产：M1.1 Web 产品级编辑器与知识流已上线，运行 release `5824e46`。
- 当前开发目标：M1.1 已交付；M1D 与后续里程碑等待用户确认。
- 当前实现模式：只开发 Web；保留桌面、移动、HarmonyOS 和同步的领域/adapter 接入口，不实现对应 host。
- 当前任务：无；T63 文档分层与 ADR 契约修正已完成。
- 桌面端 T4 与跨平台契约 T9 因 M1.1 范围暂停而标记 blocked；M1D、M2、M3、M4 未获确认不得开始。

## 任务清单

### 执行中

### T64: 提交并推送文档治理改动（P1）

- 目标：将 T62–T63 产生的文档重组与 ADR 修正按仓库门禁提交并推送到远端 `main`。
- 验收标准：
  - 暂存内容只包含文档及其重命名，不包含 `.ops-tmp/` 或运行时代码。
  - `typecheck`、测试、构建与格式检查通过。
  - 使用 Conventional Commits 创建提交并推送到 `origin/main`。
  - 本地与远端 SHA 一致，T64 终态和验证证据同步回计划。
- 边界：不修改应用行为、不部署生产、不清理 `.ops-tmp/`。
- 状态：in-progress
- 进度（只追加新行，不修改旧行）：
  - 2026-11-25 计划 建立文档治理改动提交与推送任务卡。

### 待执行（自上而下即执行顺序）

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

### 受阻

### T4: Tauri 桌面本地工作区（P0）

- 目标：实现打开普通文件夹、读写 `.md`、附件和 Excalidraw 场景。
- 验收标准：
  - 用户选择工作区后可列出目录树。
  - 新建文档后磁盘出现 UTF-8 `.md` 文件。
  - 保存使用临时文件 + 原子替换。
  - 外部修改可被监听并刷新。
  - 越界路径和符号链接被拒绝。
- 边界：不实现团队权限和实时协作。
- 状态：blocked
- 进度（只追加新行，不修改旧行）：
  - 2026-11-13 计划 创建任务卡，等待开始。
  - 2026-11-18 计划 启动 T4；桌面壳复用共享 React 编辑器与 `@inkloom/storage` adapter，Rust 仅负责工作区选择、目录枚举、UTF-8 读写、原子替换、文件监听和路径/符号链接安全。验收以 Rust 单元/集成测试、adapter contract、Tauri 构建和本机文件夹回归为准。
  - 2026-11-19 进度 用户要求先提交当前桌面端代码；本提交按 WIP 处理，T4 保持 in-progress，不宣称完整磁盘工作区验收完成。
  - 2026-11-24 执行 状态校正为 blocked：桌面端仍为 WIP，用户明确要求 M1.1 期间只交付 Web；待 M1D 获准后可恢复。

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
- 状态：blocked
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
  - 2026-11-24 执行 状态校正为 blocked：共享契约基础已完成，但 OPFS、Tauri、Harmony、Cloud adapter 均由后续 paused 里程碑承接；待对应 host 获准后可恢复。

### 最近完成 / 已取消（新在上）

### T63: 文档分层与 ADR 契约修正（P0）

- 目标：按最新版 `init-project-docs` 规范修正 ADR 路径与状态头，收敛 AGENTS 主文件职责，拆分过载的架构专题，并同步所有引用。
- 验收标准：
  - ADR 全部位于 `docs/adr/`，每份文件状态头同时包含状态和日期。
  - ADR 0004 的当前偏差由新 ADR 0007 明确承接，旧 ADR 只因状态变化而更新。
  - AGENTS 只保留必建五条、流程、短红线和专题索引；代码风格与仓库边界细节移入 `docs/agents/`。
  - 产品架构、数据/API、编辑器、安全与性能分别归入职责明确的专题文档，不再由单个大文件混合维护。
  - 所有 ADR、AGENTS 和架构文档引用可达，核心文档预算、任务状态和 Prettier 检查通过。
- 边界：只调整文档结构、状态头、引用和归属；不改运行时代码、数据库、部署配置或生产数据，不重写 accepted ADR 的决策正文和已完成任务历史。
- 状态：done
- 进度（只追加新行，不修改旧行）：
  - 2026-11-24 计划 根据最新版 `init-project-docs` 复审结论建立文档分层与 ADR 契约修正卡。
  - 2026-11-24 执行 将 7 份 ADR 统一迁入 `docs/adr/`，补全状态日期，并新增 ADR 0007 承接 ADR 0004 的桌面 scaffold 时序例外；accepted ADR 仅调整状态头及迁移后的相对链接目标。
  - 2026-11-24 执行 将产品架构拆分为产品/仓库、数据/API、编辑器、安全/性能四个专题；AGENTS 从 112 行收敛到 96 行，详细代码风格移入独立专题。
  - 2026-11-24 验证 24 个核心与专题 Markdown 文件无失效文件链接和标题锚点；7 份 ADR 编号连续且状态头均含日期；Prettier 与 `git diff --check` 通过。
  - 2026-11-24 交付 README 156 行、AGENTS 96 行、DEVELOP_PLAN 低于 300 行；最大 AGENTS 单节 17 行，剩余差距：无。

### T62: 项目文档治理与归档（P0）

- 目标：按 `init-project-docs` 规范修正三份核心文档及专题文档的职责、状态、容量和交叉引用，消除过期与冲突信息。
- 验收标准：
  - 核心文档内的任务状态均使用约定枚举，生命周期分区与状态字段一致。
  - `DEVELOP_PLAN.md` 不超过 300 行，done / canceled 卡不超过 15 张，超出的历史卡整卡归档并保留索引。
  - `README.md`、`AGENTS.md`、`HANDOFF.md` 与 `docs/` 之间的当前事实、导航和下一步不存在冲突或重复副本。
  - 专题文档归入 `docs/agents/`，历史验收与任务卡归入 `docs/archive/`，所有相对链接与锚点可达。
  - `AGENTS.md` 保留完整必建五条，README、AGENTS、DEVELOP_PLAN 均在容量预算内。
- 边界：只整理文档归属、状态、容量、入口和过期事实；不改运行时代码、数据库、部署配置或生产数据，不重写已归档任务的历史进度。
- 状态：done
- 进度（只追加新行，不修改旧行）：
  - 2026-11-24 计划 用户确认按 `init-project-docs` 审核结论建卡并修正。
  - 2026-11-24 执行 建立 `docs/agents/` 与 `docs/archive/`，迁移专题文档、ADR、历史验收和 52 张已完成任务卡；删除重复入口 `START_HERE.md`，同步入口、安全、变更、子项目与品牌文档链接。
  - 2026-11-24 执行 将 T4、T9 校正为 blocked，把 T5/T6/T7/T8/T10/T11 放入待执行区，补齐生命周期分区、归档索引和当前任务状态。
  - 2026-11-24 验证 32 个 Markdown 文件无失效文件链接或标题锚点；T1–T62 均只出现一张任务卡且无重复/缺失；核心文档通过 Prettier。
  - 2026-11-24 交付 README 147 行、AGENTS 112 行、DEVELOP_PLAN 268 行、done 卡 2 张；剩余差距：无。

### T61: Frontmatter 源片段保真回归（P0）

- 目标：修复编辑正文时 frontmatter 起始分隔符被替换为异常实体文本的问题，确保未知字段和原始语法无损保留。
- 验收标准：
  - 写入包含未知 frontmatter 字段的文档后，只修改正文再保存，完整 frontmatter 原文保持逐字不变。
  - 未知语言代码块、HTML 注释和引用定义继续保真。
  - 单测、全量 Playwright、构建和发布工作流通过。
- 边界：不改变 frontmatter 公开数据结构、编辑器命令或文档导出格式。
- 状态：done
- 进度（只追加新行，不修改旧行）：
  - 2026-11-23 计划 镜像发布 CI 发现 frontmatter 起始 `---` 被异常改写；建立源片段保真修复卡。
  - 2026-11-24 执行 最小单测复现 canonical 首块替换与 frontmatter 源 hunk 重叠故障；修正 hunk 排序，使受保护源片段在同起点优先插入，再追加用户替换，避免静默丢弃原稿。
  - 2026-11-24 验证 新增 frontmatter 重叠回归先红后绿；未知字段只保留一次；原始 E2E 源片段保真用例、删除专项连续 10/10、完整 Playwright 47/47、Vitest 85/85、lint、format 与全仓构建通过。
  - 2026-11-24 验证 `main` CI run `45303582813` 与镜像发布 run `45303610509` 成功；运维配置提交 `cbcd74b` 补齐代理信任和认证限流，生产部署 run `45305087168` 成功，release 更新为 `5824e4691a3498fb2c1967a190f5a602ec968116`。
  - 2026-11-24 验证 生产 Web/API/Caddy 健康，镜像与 `DEPLOYED_RELEASE` 均为 `5824e46`；API health 为 `ok:true`，CORS 预检 204，Web 200 且安全头完整，`inkloom-data` 数据卷保留。剩余差距：无。

## 归档索引

历史任务卡已整卡迁移至 [M1.1 历史任务归档](./docs/archive/plan-2026-11-m1.md)，以下索引按原任务编号排列。

- T1: 开源仓库与品牌整理（done 2026-11-13）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T2: Web 交互原型基线（done 2026-11-13）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T3: 抽取 core、editor、diagrams、storage 包（done 2026-11-18）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T12: 初始化 GitHub 仓库并推送首个版本（done 2026-11-13）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T13: 复核项目三文档结构（done 2026-11-16）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T14: 同步 init-project-docs 注释规范（done 2026-11-16）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T15: Web 云工作区可上线 MVP（done 2026-11-18）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T16: Web 端到端测试与生产部署（done 2026-11-18）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T17: 集中生产部署凭据到私有控制面（done 2026-11-18）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T18: Web 工作区交互闭环与保存可靠性（done 2026-11-19）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T19: Web 连续分辨率自适应（done 2026-11-19）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T20: Web 多视口截图与真实流程验收（done 2026-11-19）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T21: Web 清新视觉与品牌 Logo 重设计（done 2026-11-19）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T22: Web 正式前端技术栈重构（done 2026-11-19）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T23: 共享边缘拆分与最新版生产发布（done 2026-11-19）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T24: 产品规范与 Web-first M1.1 计划重排（done 2026-11-19）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T25: 随记、扁平知识库与资产数据结构迁移（done 2026-11-20）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T26: 随记与知识库工作区 API（done 2026-11-20）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T27: Markdown 源码保真与未知语法保护（done 2026-11-20）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T28: 白色应用壳、路由与认证页（done 2026-11-20）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T29: 产品级 Milkdown Editor Shell（done 2026-11-20）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T30: 正文块与表格完整能力（done 2026-11-20）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T31: 草稿、自动保存、检查点与冲突（done 2026-11-20）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T32: Content-addressed 资产服务（done 2026-11-20）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T33: 图片与附件块（done 2026-11-20）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T34: Mermaid 独立图表块（done 2026-11-20）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T35: Excalidraw 画布资产块（done 2026-11-20）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T36: 随记工作流（done 2026-11-20）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T37: 扁平知识库工作流（done 2026-11-20）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T38: 知识库预览优先与编辑切换（done 2026-11-20）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T39: SQLite FTS5 文档搜索（done 2026-11-20）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T40: 大纲、真实反向链接与文档信息栏（done 2026-11-20）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T41: 版本历史预览、差异与恢复（done 2026-11-20）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T42: 全局视觉、字体、动效与响应式收口（done 2026-11-20）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T43: M1.1 全链路测试与视觉验收（done 2026-11-20）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T44: M1.1 生产发布与全新数据初始化（done 2026-11-21）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T45: 移除仓库内 UI Review 截图归档（done 2026-11-19）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T46: 编辑器全宽、信息栏动效与块级图表插入（done 2026-11-21）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T47: 文档列表行操作与重命名（done 2026-11-21）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T48: 块操作菜单层级整理（done 2026-11-21）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T49: 工作区设置、空白画布保存与初始文档布局（done 2026-11-21）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T50: Markdown 源片段运行时接线（done 2026-11-23）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T51: API 写入原子性与异常输入隔离（done 2026-11-23）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T52: 认证可用性与登录限流（done 2026-11-23）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T53: 最近文档与知识库原子排序（done 2026-11-23）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T54: 前端架构净化与加载性能（done 2026-11-23）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T55: 质量门禁、依赖与跨平台契约收口（done 2026-11-23）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T56: 块操作手柄独立左侧操作槽（done 2026-11-23）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T57: 文档列表与编辑器块视觉层级修复（done 2026-11-23）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T58: 编辑器块节距与图表边缘插入（done 2026-11-23）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T59: 删除文档后的列表缓存一致性（done 2026-11-24）→ [历史归档](./docs/archive/plan-2026-11-m1.md)
- T60: 提示块标签独立行布局（done 2026-11-23）→ [历史归档](./docs/archive/plan-2026-11-m1.md)

## 状态枚举

| 状态        | 含义                               |
| ----------- | ---------------------------------- |
| planned     | 已建卡确认，未动手                 |
| in-progress | 执行中                             |
| done        | 验收标准全部满足且有验证证据       |
| blocked     | 受阻；最新进度行注明原因与可否绕行 |
| canceled    | 放弃；最新进度行注明原因           |

## 卡面约定

- WHEN/THEN 用于接口和交互验收。
- done 卡不删除，保留项目历史。
- 交付进度必须写明实际产出与剩余差距。

## 里程碑

| 里程碑 | 内容                                        | 状态    |
| ------ | ------------------------------------------- | ------- |
| M0     | 原型与开源交接                              | done    |
| M1     | Web 云工作区可上线 MVP（T15、T16、T18–T22） | done    |
| M1.1   | Web 产品级编辑器与知识流（T24–T44）         | done    |
| M1D    | 桌面本地 MVP（T4–T6，等待 M1.1 后确认）     | planned |
| M2     | 离线队列与双向同步                          | planned |
| M3     | 实时协作                                    | planned |
| M4     | 移动端与 HarmonyOS                          | planned |

技术背景见 [README.md](./README.md) 与
[产品与技术方案](./docs/agents/product-and-architecture.md)，改码规则见
[AGENTS.md](./AGENTS.md)。
