import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Organization, SubscriptionStatus } from './organization.entity'
import { OrganizationMember, OrganizationRole } from './organization-member.entity'
import { User } from '../users/user.entity'
import { CacheService } from '../cache/cache.service'

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
    @InjectRepository(OrganizationMember)
    private memberRepository: Repository<OrganizationMember>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private cacheService: CacheService,
  ) {}

  async create(name: string, userId: string): Promise<Organization> {
    // Generate slug from name
    const slug = this.generateSlug(name)

    // Check if slug already exists
    const existing = await this.organizationRepository.findOne({ where: { slug } })
    if (existing) {
      throw new BadRequestException(`Organization with slug "${slug}" already exists`)
    }

    const organization = this.organizationRepository.create({
      name,
      slug,
      subscriptionStatus: SubscriptionStatus.INCOMPLETE,
    })

    const savedOrg = await this.organizationRepository.save(organization)

    // Add creator as Owner
    await this.addMember(savedOrg.id, userId, OrganizationRole.OWNER)

    // Invalidate user's organization list cache
    const userOrgsCacheKey = this.cacheService.generateKey('organizations', 'user', userId)
    await this.cacheService.del(userOrgsCacheKey)

    return savedOrg
  }

  async findAll(userId: string): Promise<Organization[]> {
    const cacheKey = this.cacheService.generateKey('organizations', 'user', userId)
    
    // Try to get from cache
    const cached = await this.cacheService.get<Organization[]>(cacheKey)
    if (cached) {
      return cached
    }

    const memberships = await this.memberRepository.find({
      where: { userId },
      relations: ['organization'],
    })
    const organizations = memberships.map((m) => m.organization)
    
    // Cache for 5 minutes
    await this.cacheService.set(cacheKey, organizations, 300)
    
    return organizations
  }

  async findOne(id: string, userId: string): Promise<Organization> {
    const cacheKey = this.cacheService.generateKey('organization', id, userId)
    
    // Try to get from cache
    const cached = await this.cacheService.get<Organization>(cacheKey)
    if (cached) {
      return cached
    }

    // Verify user has access to this organization
    const membership = await this.memberRepository.findOne({
      where: { organizationId: id, userId },
      relations: ['organization'],
    })

    if (!membership) {
      throw new NotFoundException('Organization not found or access denied')
    }

    // Cache for 5 minutes
    await this.cacheService.set(cacheKey, membership.organization, 300)
    
    return membership.organization
  }

  async update(id: string, updates: Partial<Organization>, userId: string): Promise<Organization> {
    const org = await this.findOne(id, userId)

    // Verify user is Owner
    const membership = await this.memberRepository.findOne({
      where: { organizationId: id, userId },
    })

    if (membership?.role !== OrganizationRole.OWNER) {
      throw new BadRequestException('Only organization owners can update organization settings')
    }

    if (updates.name && updates.name !== org.name) {
      updates.slug = this.generateSlug(updates.name)
    }

    Object.assign(org, updates)
    const updatedOrg = await this.organizationRepository.save(org)

    // Invalidate caches
    const orgCacheKey = this.cacheService.generateKey('organization', id, userId)
    const userOrgsCacheKey = this.cacheService.generateKey('organizations', 'user', userId)
    await this.cacheService.del(orgCacheKey)
    await this.cacheService.del(userOrgsCacheKey)

    return updatedOrg
  }

  async addMember(organizationId: string, userId: string, role: OrganizationRole): Promise<OrganizationMember> {
    // Check if member already exists
    const existing = await this.memberRepository.findOne({
      where: { organizationId, userId },
    })

    if (existing) {
      throw new BadRequestException('User is already a member of this organization')
    }

    const member = this.memberRepository.create({
      organizationId,
      userId,
      role,
      invitedById: userId, // Self-join for initial owner
    })

    return this.memberRepository.save(member)
  }

  async removeMember(organizationId: string, userId: string, removerId: string): Promise<void> {
    // Verify remover is Owner
    const removerMembership = await this.memberRepository.findOne({
      where: { organizationId, userId: removerId },
    })

    if (removerMembership?.role !== OrganizationRole.OWNER) {
      throw new BadRequestException('Only organization owners can remove members')
    }

    // Prevent removing last owner
    const owners = await this.memberRepository.count({
      where: { organizationId, role: OrganizationRole.OWNER },
    })

    const targetMembership = await this.memberRepository.findOne({
      where: { organizationId, userId },
    })

    if (targetMembership?.role === OrganizationRole.OWNER && owners === 1) {
      throw new BadRequestException('Cannot remove the last owner of an organization')
    }

    await this.memberRepository.delete({ organizationId, userId })
  }

  async updateMemberRole(
    organizationId: string,
    userId: string,
    newRole: OrganizationRole,
    updaterId: string,
  ): Promise<OrganizationMember> {
    // Verify updater is Owner
    const updaterMembership = await this.memberRepository.findOne({
      where: { organizationId, userId: updaterId },
    })

    if (updaterMembership?.role !== OrganizationRole.OWNER) {
      throw new BadRequestException('Only organization owners can update member roles')
    }

    const member = await this.memberRepository.findOne({
      where: { organizationId, userId },
    })

    if (!member) {
      throw new NotFoundException('Member not found')
    }

    // Prevent removing last owner
    if (member.role === OrganizationRole.OWNER && newRole !== OrganizationRole.OWNER) {
      const owners = await this.memberRepository.count({
        where: { organizationId, role: OrganizationRole.OWNER },
      })
      if (owners === 1) {
        throw new BadRequestException('Cannot change role of the last owner')
      }
    }

    member.role = newRole
    return this.memberRepository.save(member)
  }

  async getMembers(organizationId: string, userId: string): Promise<OrganizationMember[]> {
    // Verify user has access
    await this.findOne(organizationId, userId)

    return this.memberRepository.find({
      where: { organizationId },
      relations: ['user', 'invitedBy'],
    })
  }

  async getUserRole(organizationId: string, userId: string): Promise<OrganizationRole | null> {
    const membership = await this.memberRepository.findOne({
      where: { organizationId, userId },
    })
    return membership?.role || null
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }
}
