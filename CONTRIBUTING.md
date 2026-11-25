# Contributing to InkLoom

先阅读 [README.md](./README.md) 和 [AGENTS.md](./AGENTS.md)，再以
[DEVELOP_PLAN.md](./DEVELOP_PLAN.md) 中已确认的任务卡作为唯一工作范围。

## Before a Pull Request

安装、启动和质量命令以 [README.md](./README.md) 的 Quick Start 为准；提交、
测试和验证规则以 [AGENTS.md](./AGENTS.md#流程要求) 为准。UI 与编辑器改动还要
遵守 [UX 与编辑器规范](./docs/agents/ux-and-editor-spec.md)。

## Review-Sensitive Areas

- Markdown 解析/序列化往返与未知语法保留。
- 路径校验、原子写入、revision 冲突和删除竞态。
- HTML/SVG 清洗、Mermaid 安全级别、认证限流和 CORS。
- 编辑器键盘、触控、响应式及 reduced-motion 行为。
- 新增依赖的体积、许可证、安全影响和产物边界。
