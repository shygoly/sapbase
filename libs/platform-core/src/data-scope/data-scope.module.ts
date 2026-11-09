import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DataPolicy } from './entities/data-policy.entity'
import { ScopeBinding } from './entities/scope-binding.entity'
import { ScopeDimension } from './entities/scope-dimension.entity'
import { ScopeMembership } from './entities/scope-membership.entity'
import { ScopeNode } from './entities/scope-node.entity'
import { ScopeVersion } from './entities/scope-version.entity'
import { ScopeEvaluator } from './scope-evaluator'

/**
 * 数据范围基座。
 *
 * v1 先暴露纯解析器 + 实体；管理 API / 执行适配器在后续任务里接入，
 * 这样下游模块可以先依赖 ScopeEvaluator 的稳定接口。
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ScopeDimension,
      ScopeNode,
      ScopeMembership,
      ScopeBinding,
      DataPolicy,
      ScopeVersion,
    ]),
  ],
  providers: [ScopeEvaluator],
  exports: [ScopeEvaluator, TypeOrmModule],
})
export class DataScopeModule {}
