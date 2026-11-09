# CI 流水线

> 仓库托管在 codeup.aliyun.com。流水线内容以 `scripts/ci/pipeline.sh` 为准。

## 步骤

```bash
npm ci
npm run check:all
npm run typecheck
npm run lint
npm run test --workspace @sap/api -- --runInBand --json --outputFile=test-results/jest.json
npm run ci:record-evidence
```

`npm run ci:record-evidence` 会：

- 计算 jest 输出摘要
- 生成 `test-results/test-evidence.json`
- 若配置 `SAPBASE_CI_TOKEN`，调用 `POST /api/builder/test-evidence` 登记 G4 证据

## Codeup 配置建议

- 触发分支：`weichen` 与 PR 到主分支
- 运行环境：Node 22.18+（当前仓库在 Node 22.13 下 `next build` 会因 magic-string ESM 失败）
- 门禁：以上步骤全部通过才允许合并
- 产物：上传 `test-results/`
