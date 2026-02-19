import { v4 as uuidv4 } from 'uuid'
import { Organization } from '../../src/organization-context/domain/entities/organization.entity'
import { OrganizationMember, OrganizationRole } from '../../src/organization-context/domain/entities/organization-member.entity'
import { Invitation } from '../../src/organization-context/domain/entities/invitation.entity'
import { WorkflowDefinition } from '../../src/workflow-context/domain/entities/workflow-definition.entity'
import { WorkflowInstance } from '../../src/workflow-context/domain/entities/workflow-instance.entity'
import { OrganizationSlug } from '../../src/organization-context/domain/value-objects/organization-slug.vo'

/**
 * Domain entity builders for tests.
 */

export class OrganizationBuilder {
  private id: string = `org-${uuidv4()}`
  private name: string = 'Test Organization'
  private slug: OrganizationSlug = OrganizationSlug.create('test-org')
  private createdAt: Date = new Date()
  private updatedAt: Date = new Date()

  withId(id: string): this {
    this.id = id
    return this
  }

  withName(name: string): this {
    this.name = name
    return this
  }

  withSlug(slug: string): this {
    this.slug = OrganizationSlug.create(slug)
    return this
  }

  build(): Organization {
    return Organization.create(this.id, this.name, this.slug)
  }
}

export class OrganizationMemberBuilder {
  private id: string = `member-${uuidv4()}`
  private organizationId: string = `org-${uuidv4()}`
  private userId: string = `user-${uuidv4()}`
  private role: OrganizationRole = OrganizationRole.MEMBER
  private createdAt: Date = new Date()
  private updatedAt: Date = new Date()

  withId(id: string): this {
    this.id = id
    return this
  }

  withOrganizationId(organizationId: string): this {
    this.organizationId = organizationId
    return this
  }

  withUserId(userId: string): this {
    this.userId = userId
    return this
  }

  withRole(role: OrganizationRole): this {
    this.role = role
    return this
  }

  build(): OrganizationMember {
    return OrganizationMember.create(
      this.id,
      this.organizationId,
      this.userId,
      this.role,
    )
  }
}

export class InvitationBuilder {
  private id: string = `invitation-${uuidv4()}`
  private organizationId: string = `org-${uuidv4()}`
  private email: string = `test-${uuidv4().substring(0, 8)}@example.com`
  private invitedBy: string = `user-${uuidv4()}`
  private role: OrganizationRole = OrganizationRole.MEMBER
  private token: string = `token-${uuidv4()}`
  private expiresAt: Date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  private acceptedAt: Date | null = null
  private createdAt: Date = new Date()

  withId(id: string): this {
    this.id = id
    return this
  }

  withOrganizationId(organizationId: string): this {
    this.organizationId = organizationId
    return this
  }

  withEmail(email: string): this {
    this.email = email
    return this
  }

  withToken(token: string): this {
    this.token = token
    return this
  }

  withExpiresAt(expiresAt: Date): this {
    this.expiresAt = expiresAt
    return this
  }

  expired(): this {
    this.expiresAt = new Date(Date.now() - 1000)
    return this
  }

  accepted(): this {
    this.acceptedAt = new Date()
    return this
  }

  build(): Invitation {
    return Invitation.create(
      this.id,
      this.organizationId,
      this.email,
      this.invitedBy,
      this.role,
      this.token,
      this.expiresAt,
    )
  }
}

export class WorkflowDefinitionBuilder {
  private id: string = `wf-${uuidv4()}`
  private organizationId: string = `org-${uuidv4()}`
  private name: string = 'Test Workflow'
  private entityType: string = 'order'
  private states: Array<{ name: string; initial: boolean; final: boolean }> = [
    { name: 'draft', initial: true, final: false },
  ]
  private transitions: Array<{
    from: string
    to: string
    guard?: string
  }> = []
  private status: 'draft' | 'active' | 'archived' = 'draft'

  withId(id: string): this {
    this.id = id
    return this
  }

  withOrganizationId(organizationId: string): this {
    this.organizationId = organizationId
    return this
  }

  withName(name: string): this {
    this.name = name
    return this
  }

  withEntityType(entityType: string): this {
    this.entityType = entityType
    return this
  }

  withStates(
    states: Array<{ name: string; initial: boolean; final: boolean }>,
  ): this {
    this.states = states
    return this
  }

  withTransitions(
    transitions: Array<{ from: string; to: string; guard?: string }>,
  ): this {
    this.transitions = transitions
    return this
  }

  active(): this {
    this.status = 'active'
    return this
  }

  build(): WorkflowDefinition {
    const workflow = WorkflowDefinition.create(
      this.id,
      this.organizationId,
      this.name,
      this.entityType,
      this.states,
      this.transitions,
    )

    if (this.status === 'active') {
      workflow.activate()
    }

    return workflow
  }
}

export class WorkflowInstanceBuilder {
  private id: string = `instance-${uuidv4()}`
  private workflowDefinitionId: string = `wf-${uuidv4()}`
  private organizationId: string = `org-${uuidv4()}`
  private entityType: string = 'order'
  private entityId: string = `entity-${uuidv4()}`
  private currentState: string = 'draft'
  private status: 'running' | 'completed' | 'cancelled' = 'running'
  private context: Record<string, any> = {}
  private createdAt: Date = new Date()
  private updatedAt: Date = new Date()

  withId(id: string): this {
    this.id = id
    return this
  }

  withWorkflowDefinitionId(workflowDefinitionId: string): this {
    this.workflowDefinitionId = workflowDefinitionId
    return this
  }

  withOrganizationId(organizationId: string): this {
    this.organizationId = organizationId
    return this
  }

  withEntityId(entityId: string): this {
    this.entityId = entityId
    return this
  }

  withCurrentState(currentState: string): this {
    this.currentState = currentState
    return this
  }

  withStatus(status: 'running' | 'completed' | 'cancelled'): this {
    this.status = status
    return this
  }

  withContext(context: Record<string, any>): this {
    this.context = context
    return this
  }

  completed(): this {
    this.status = 'completed'
    return this
  }

  cancelled(): this {
    this.status = 'cancelled'
    return this
  }

  build(): WorkflowInstance {
    return WorkflowInstance.create(
      this.id,
      this.workflowDefinitionId,
      this.organizationId,
      this.entityType,
      this.entityId,
      this.currentState,
      this.context,
    )
  }
}
