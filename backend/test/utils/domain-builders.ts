import { v4 as uuidv4 } from 'uuid'
import { Organization, SubscriptionStatus } from '../../src/organization-context/domain/entities/organization.entity'
import { OrganizationMember, OrganizationRole } from '../../src/organization-context/domain/entities/organization-member.entity'
import { Invitation, InvitationStatus } from '../../src/organization-context/domain/entities/invitation.entity'
import { OrganizationSlug } from '../../src/organization-context/domain/value-objects/organization-slug.vo'

/**
 * Domain entity builders for tests.
 */

export class OrganizationBuilder {
  private id: string = `org-${uuidv4()}`
  private name: string = 'Test Organization'
  private slug: OrganizationSlug = OrganizationSlug.create('test-org')
  private members: OrganizationMember[] = []
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

  withMembers(...members: OrganizationMember[]): this {
    this.members = members
    return this
  }

  build(): Organization {
    // 当前模型：slug 由 name 推导、且不可变；需要特定 slug/成员/订阅状态时必须走 fromPersistence
    // （change: restore-green-backend-tests）
    return Organization.fromPersistence(
      this.id,
      this.name,
      this.slug.toString(),
      this.members,
      SubscriptionStatus.ACTIVE,
      null,
      null,
      null,
      null,
    )
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
    // create() 的签名是 (organizationId, userId, role, invitedById) 且 id 留空由仓储分配；
    // builder 要能指定 id，所以走 fromPersistence（change: restore-green-backend-tests）
    return OrganizationMember.fromPersistence(
      this.id,
      this.organizationId,
      this.userId,
      this.role,
      null,
      this.createdAt,
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
    // 当前模型：状态机 + 仓储分配 id + expiresAt。用 fromPersistence 精确构造，
    // 才能同时表达「已接受」与「已过期」两种测试前置（change: restore-green-backend-tests）
    return Invitation.fromPersistence(
      this.id,
      this.organizationId,
      this.email,
      this.role,
      this.invitedBy,
      this.acceptedAt ? InvitationStatus.ACCEPTED : InvitationStatus.PENDING,
      this.token,
      this.expiresAt,
      this.createdAt,
    )
  }
}
