# sapbase 元语系统（参考版 v1）— 已并入，保留作历史

> 状态：**已并入真源**（2026-10-30）。
> 本目录不再作为入口，不参与校验；`reference.zip` 仅作历史归档。
> 当前真源：
>
> - `docs/META_LANGUAGE.md`
> - `openspec/project.md`
> - `docs/ARCHITECTURE.md`
> - `docs/protocols/release.md`
> - `docs/protocols/piagent.md`
> - `docs/protocols/agent-evolution.md`
> - `DOMAIN.md` / `FLOWS.md` / `DECISIONS.md` / `AGENT-TOOLS.md`

## 合并映射

| 参考包 | 并入位置 |
|---|---|
| `01-meta-model.md` 术语/不变量 | `docs/META_LANGUAGE.md` |
| `02-architecture.md` | `docs/ARCHITECTURE.md` |
| `03-contracts.md` | 根四契约附录 |
| `04-versioning-release.md` | `docs/protocols/release.md` |
| `05-piagent.md` | `docs/protocols/piagent.md` |
| `06-evolution-loop.md` | `docs/protocols/agent-evolution.md` |
| `07-adoption-and-checks.md` | `CONTRIBUTING.md` + CI |
| `templates/` | 根四契约初始版本 |
| `scripts/` | `scripts/meta/` |

## 维护规则

不要在本目录新增并行契约文本；需要修改规则时改真源，并同步对应 checker。
