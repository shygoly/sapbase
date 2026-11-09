import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { IdentityProvider } from './identity-provider.entity'

export interface CreateIdentityProviderInput {
  key: string
  name: string
  type: 'cas' | 'oauth2' | 'oidc' | 'saml'
  config?: Record<string, unknown> | null
  secretRef?: string | null
  defaultRoleName?: string | null
}

export interface UpdateIdentityProviderInput {
  name?: string
  config?: Record<string, unknown> | null
  secretRef?: string | null
  defaultRoleName?: string | null
  status?: 'active' | 'inactive'
}

const KEY_PATTERN = /^[a-z][a-z0-9-]*$/

/**
 * 身份提供方管理：secret 只存 secretRef，不落明文。
 * SSO adapter 按 type 在 identity 模块外注册；这里只做配置与生命周期。
 */
@Injectable()
export class IdentityProvidersService {
  constructor(
    @InjectRepository(IdentityProvider)
    private readonly repository: Repository<IdentityProvider>,
  ) {}

  async list(organizationId: string): Promise<IdentityProvider[]> {
    return this.repository.find({
      where: { organizationId },
      order: { createdAt: 'ASC' },
    })
  }

  async findOne(organizationId: string, id: string): Promise<IdentityProvider> {
    const row = await this.repository.findOne({ where: { id, organizationId } })
    if (!row) throw new NotFoundException('Identity provider not found')
    return row
  }

  async findByKey(organizationId: string, key: string): Promise<IdentityProvider | null> {
    return this.repository.findOne({ where: { organizationId, key } })
  }

  async create(
    organizationId: string,
    input: CreateIdentityProviderInput,
  ): Promise<IdentityProvider> {
    if (!KEY_PATTERN.test(input.key)) {
      throw new BadRequestException('provider key 只允许小写字母开头、含 a-z0-9-')
    }
    const exists = await this.findByKey(organizationId, input.key)
    if (exists) throw new BadRequestException(`provider key 已存在：${input.key}`)
    const row = this.repository.create({
      organizationId,
      key: input.key,
      name: input.name,
      type: input.type,
      config: input.config ?? null,
      secretRef: input.secretRef ?? null,
      defaultRoleName: input.defaultRoleName ?? null,
      status: 'active',
    })
    return this.repository.save(row)
  }

  async update(
    organizationId: string,
    id: string,
    input: UpdateIdentityProviderInput,
  ): Promise<IdentityProvider> {
    const row = await this.findOne(organizationId, id)
    if (input.name !== undefined) row.name = input.name
    if (input.config !== undefined) row.config = input.config
    if (input.secretRef !== undefined) row.secretRef = input.secretRef
    if (input.defaultRoleName !== undefined) row.defaultRoleName = input.defaultRoleName
    if (input.status !== undefined) row.status = input.status
    return this.repository.save(row)
  }

  async remove(organizationId: string, id: string): Promise<void> {
    const row = await this.findOne(organizationId, id)
    await this.repository.remove(row)
  }

  /** 只返回可公开字段；secretRef 仍可见（它是引用不是密钥），但 config 里的密钥字段由 adapter 自行脱敏。 */
  toPublic(row: IdentityProvider): Omit<IdentityProvider, never> {
    return row
  }
}
