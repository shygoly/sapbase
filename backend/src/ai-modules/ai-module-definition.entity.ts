import { Entity, Column, ManyToOne } from 'typeorm'
import { BaseEntity } from '../common/entities/base.entity'
import { AIModule } from './ai-module.entity'

/**
 * Stores the original 6-step definition for an AI Module.
 * This preserves the definition data before it's converted to Patch DSL,
 * allowing recovery and re-generation if needed.
 */
@Entity('ai_module_definitions')
export class AIModuleDefinition extends BaseEntity {
  @ManyToOne(() => AIModule, { nullable: false, onDelete: 'CASCADE' })
  aiModule: AIModule

  @Column({ nullable: false })
  aiModuleId: string

  /**
   * Step 1: Object Model definition
   * Contains entities and their fields
   */
  @Column({ type: 'jsonb', nullable: true })
  step1_objectModel: Record<string, any>

  /**
   * Step 2: Relationships definition
   * Contains entity relationships
   */
  @Column({ type: 'jsonb', nullable: true })
  step2_relationships: Record<string, any>

  /**
   * Step 3: State Flow definition
   * Contains state machines and transitions
   */
  @Column({ type: 'jsonb', nullable: true })
  step3_stateFlow: Record<string, any>

  /**
   * Step 4: Pages definition
   * Contains page configurations
   */
  @Column({ type: 'jsonb', nullable: true })
  step4_pages: Record<string, any>

  /**
   * Step 5: Permissions definition
   * Contains permission rules
   */
  @Column({ type: 'jsonb', nullable: true })
  step5_permissions: Record<string, any>

  /**
   * Step 6: Reports definition
   * Contains report configurations
   */
  @Column({ type: 'jsonb', nullable: true })
  step6_reports: Record<string, any>

  /**
   * Merged definition from all 6 steps
   * This is the payload used for generate-from-definition
   */
  @Column({ type: 'jsonb', nullable: true })
  mergedDefinition: Record<string, any>
}
