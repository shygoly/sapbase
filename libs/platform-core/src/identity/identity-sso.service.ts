import { Inject, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { randomBytes } from 'node:crypto'
import { UsersService } from '../users/users.service'
import { RolesService } from '../roles/roles.service'
import { IdentityLink } from './identity-link.entity'
import { IdentityProvider } from './identity-provider.entity'
import { createSsoAdapter, SSO_ADAPTER_FACTORY } from './sso/adapter-factory'
import { SsoError, type SsoAdapter, type SsoCallbackInput } from './sso/sso-adapter'

export interface SsoLoginResult {
  provider: IdentityProvider
  link: IdentityLink
  user: { id: string; email: string; name: string }
  created: boolean
}

/**
 * SSO 回调编排：provider → adapter → identity link → JIT 建号。
 *
 * - 外部 subject 只用于 identity_links，不直接当平台 userId
 * - JIT 只给 provider.defaultRoleName（或系统默认角色），高权限必须另行授予
 * - 默认角色不存在 / provider 停用 / adapter 失败 → fail-closed
 */
@Injectable()
export class IdentitySsoService {
  constructor(
    @InjectRepository(IdentityProvider)
    private readonly providers: Repository<IdentityProvider>,
    @InjectRepository(IdentityLink)
    private readonly links: Repository<IdentityLink>,
    private readonly users: UsersService,
    private readonly roles: RolesService,
    @Inject(SSO_ADAPTER_FACTORY)
    private readonly adapterFactory: (provider: IdentityProvider) => SsoAdapter = createSsoAdapter,
  ) {}

  /** 登录页公开可见的 provider 列表：只返回 key/name/type，不返回 config/secretRef。 */
  async listActiveProviders(
    organizationId: string,
  ): Promise<Array<{ key: string; name: string; type: IdentityProvider['type'] }>> {
    const rows = await this.providers.find({
      where: { organizationId, status: 'active' },
      order: { createdAt: 'ASC' },
    })
    return rows.map((row) => ({ key: row.key, name: row.name, type: row.type }))
  }

  async authorizationUrl(
    organizationId: string,
    providerKey: string,
    input: { state?: string; nonce?: string; codeChallenge?: string } = {},
  ): Promise<string> {
    const provider = await this.providers.findOne({
      where: { organizationId, key: providerKey, status: 'active' },
    })
    if (!provider) {
      throw new SsoError(`身份提供方不存在或已停用：${providerKey}`, 'not-configured')
    }
    return this.adapterFactory(provider).authorizationUrl(input)
  }

  async authenticate(
    organizationId: string,
    providerKey: string,
    callback: SsoCallbackInput,
  ): Promise<SsoLoginResult> {
    const provider = await this.providers.findOne({
      where: { organizationId, key: providerKey, status: 'active' },
    })
    if (!provider) {
      throw new SsoError(`身份提供方不存在或已停用：${providerKey}`, 'not-configured')
    }
    const adapter = this.adapterFactory(provider)
    const identity = await adapter.authenticate(callback)

    const existingLink = await this.links.findOne({
      where: {
        organizationId,
        providerId: provider.id,
        externalId: identity.externalId,
      },
    })
    if (existingLink) {
      existingLink.attributes = identity.attributes
      existingLink.lastLoginAt = new Date()
      await this.links.save(existingLink)
      const user = await this.users.findOne(existingLink.userId)
      return {
        provider,
        link: existingLink,
        user: { id: user.id, email: user.email, name: user.name },
        created: false,
      }
    }

    const email = pickEmail(identity.attributes)
    let user = email ? await this.users.findByEmail(email) : null
    let created = false
    if (!user) {
      if (!email) {
        throw new SsoError('SSO 身份缺少 email，无法 JIT 建号', 'invalid-response')
      }
      const roleId = await this.resolveDefaultRole(organizationId, provider)
      // JIT 用户没有可用密码：随机摘要占位，禁止密码登录直到管理员设置密码。
      user = await this.users.create(
        {
          name: pickName(identity.attributes, email),
          email,
          password: randomBytes(32).toString('hex'),
          roleId,
        },
        organizationId,
      )
      created = true
    }

    const link = this.links.create({
      organizationId,
      providerId: provider.id,
      externalId: identity.externalId,
      userId: user.id,
      attributes: identity.attributes,
      lastLoginAt: new Date(),
    })
    const savedLink = await this.links.save(link)
    return {
      provider,
      link: savedLink,
      user: { id: user.id, email: user.email, name: user.name },
      created,
    }
  }

  private async resolveDefaultRole(
    organizationId: string,
    provider: IdentityProvider,
  ): Promise<string | undefined> {
    if (!provider.defaultRoleName) return undefined
    const role = await this.roles.findByName(provider.defaultRoleName, organizationId)
    if (!role) {
      throw new SsoError(
        `provider ${provider.key} 的默认角色不存在或已停用：${provider.defaultRoleName}`,
        'not-configured',
      )
    }
    return role.id
  }
}

function pickEmail(attributes: Record<string, unknown>): string | null {
  for (const key of ['email', 'mail', 'preferred_username']) {
    const value = attributes[key]
    if (typeof value === 'string' && value.includes('@')) return value
  }
  return null
}

function pickName(attributes: Record<string, unknown>, email: string): string {
  for (const key of ['name', 'displayName', 'cn']) {
    const value = attributes[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return email.split('@')[0]
}
