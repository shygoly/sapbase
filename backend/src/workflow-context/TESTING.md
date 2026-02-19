# WorkflowContext DDD Testing Strategy

## 测试隔离优势

DDD架构通过清晰的分层实现了优秀的测试隔离：

### 1. Domain Layer（域层）- 纯单元测试

**特点**：
- ✅ **零依赖**：纯业务逻辑，无外部依赖
- ✅ **无需Mock**：测试速度快，可靠性高
- ✅ **测试业务规则**：验证核心业务逻辑

**示例**：
```typescript
// workflow-definition.entity.spec.ts
describe('WorkflowDefinition (Domain Entity)', () => {
  it('should throw error if no initial state', () => {
    expect(() =>
      WorkflowDefinition.create(/* ... */)
    ).toThrow(DomainError)
  })
})
```

**测试文件**：
- `domain/entities/workflow-definition.entity.spec.ts` ✅ 13 tests
- `domain/entities/workflow-instance.entity.spec.ts` ✅ 11 tests
- `domain/domain-services/transition-validator.service.spec.ts` ✅ 10 tests

### 2. Application Layer（应用层）- Mock所有依赖

**特点**：
- ✅ **Mock Repository接口**：不依赖真实数据库
- ✅ **Mock外部服务**：AI服务、事件发布器等
- ✅ **测试业务流程编排**：验证应用服务如何协调领域对象

**示例**：
```typescript
// start-workflow-instance.service.spec.ts
const mockWorkflowDefinitionRepo = {
  findById: jest.fn(),
  save: jest.fn(),
}

// Mock所有依赖，只测试业务逻辑编排
```

**测试文件**：
- `application/services/start-workflow-instance.service.spec.ts` ✅ 3 tests
- `application/services/execute-transition.service.spec.ts` ✅ 5 tests

### 3. Infrastructure Layer（基础设施层）- 集成测试

**特点**：
- ✅ **测试真实映射**：验证Domain实体与TypeORM实体的映射
- ✅ **可选数据库测试**：可以测试真实的数据库交互
- ✅ **测试适配器**：验证基础设施适配器正确实现接口

**示例**：
```typescript
// workflow-definition.repository.spec.ts
// 测试Repository如何将TypeORM实体映射到Domain实体
```

## 测试运行

```bash
# Domain层测试（最快，无需依赖）
npm test -- workflow-definition.entity.spec.ts workflow-instance.entity.spec.ts transition-validator.service.spec.ts

# Application层测试（Mock依赖）
npm test -- start-workflow-instance.service.spec.ts execute-transition.service.spec.ts

# 所有测试
npm test -- workflow-context
```

## 测试覆盖率目标

- **Domain Layer**: 100% 覆盖率（纯业务逻辑，必须全面测试）
- **Application Layer**: >80% 覆盖率（业务流程编排）
- **Infrastructure Layer**: >70% 覆盖率（映射和适配器）

## 测试隔离的好处

1. **快速反馈**：Domain层测试运行极快（毫秒级）
2. **独立测试**：每层可以独立测试，不依赖其他层
3. **易于维护**：业务规则变更只需更新Domain层测试
4. **清晰职责**：每层测试关注点明确
5. **Mock简单**：Application层只需Mock接口，不需要复杂的数据库设置

## 下一步

- [ ] 添加更多Application层测试（GetSuggestedTransitionsService等）
- [ ] 添加Infrastructure层集成测试（真实数据库）
- [ ] 添加E2E测试（完整API流程）
- [ ] 配置测试覆盖率报告
