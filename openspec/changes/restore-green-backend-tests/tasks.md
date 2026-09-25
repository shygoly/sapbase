# Implementation Tasks

## 验收门

```bash
cd backend && npx jest --config jest.config.js --runInBand
# 期望：Test Suites: 53 passed, 53 total；Tests: 全部通过（0 failed）
```

分域推进，每修完一个域跑一次上面这条命令并附结果。

### 执行约定

1. **先判定谁错了**：spec 与实现不一致时，默认按"实现是当前意图"处理，但逐处确认；
   若某行为是被**静默删除**的，单列出来（那是实现的问题，不是 spec 的）。
2. **不靠删测试凑绿**：允许删除"被测行为已不存在"的用例，但必须在下表逐条登记。
3. **不用模糊匹配掩盖导入错误**（`moduleNameMapper` 之类）。
4. 每个域完成后附证据：命令 + 输出行。

## 进度

| # | 域 | 套件 | 状态 |
| --- | --- | --- | --- |
| 0 | 路径与工具模块（`test/utils` 相对深度） | 跨域 8 文件 | ✅ 2026-09-25（20 → 19 套件失败） |
| 1 | `organization-context` | 9 | ⏳ |
| 2 | `auth-context` + `auth` | 5 | ⏳ |
| 3 | `common/events` | 1 | ⏳ |
| 4 | `ai-modules` | 1（4 个断言失败） | ⏳ |
| 5 | `ai-module-context` | 1 | ⏳ |
| 6 | CI 门禁诚实化（`.github/workflows/ci.yml` 的证据/范围说明） | — | ⏳ |

## 被测行为已删除的用例（逐条登记）

> 目前为空。删任何用例都要在这里写清：文件、用例名、为什么该行为已不存在、由谁覆盖。

## 里程碑 0：路径与工具模块（已完成）

- [x] 修 spec 里 `test/utils` 的相对路径深度（8 文件 / 12 处）
- [x] 证据：`npx jest --config jest.config.js --runInBand` → 套件失败 20 → **19**，
      用例数 398 → **400**（两个套件此前连用例都没收集到）

## 里程碑：历史 e2e 的事实记录（不修，只写清）

- [ ] 记录：`test/auth|roles|departments|users|plugins|ai-module-lifecycle.e2e-spec.ts`
      需要真实库与完整 AppModule，当前整目录跑会挂住（早先实测 10 分钟不返回）；
      本仓库长期只跑 `atomic-runtime` / `blueprint-pipeline` / `atomic-gates` 三个 e2e。
      建议单独立变更决定它们的去留（修/删/标注 skip），不要装作它们不存在。
