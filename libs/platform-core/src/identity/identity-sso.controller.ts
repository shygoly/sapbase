import { BadRequestException, Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { IdentitySsoService } from './identity-sso.service'

@ApiTags('Identity SSO')
@Controller('identity/sso')
export class IdentitySsoController {
  constructor(private readonly sso: IdentitySsoService) {}

  @Get('providers')
  @ApiOperation({ summary: '登录页可用的 SSO 提供方（公开；只返回 key/name/type）' })
  async listProviders(@Query('organizationId') organizationId: string) {
    if (!organizationId) {
      throw new BadRequestException('organizationId 必填')
    }
    const providers = await this.sso.listActiveProviders(organizationId)
    return { providers }
  }

  @Get(':providerKey/authorize')
  @ApiOperation({ summary: 'SSO 授权 URL（公开；组织来自查询/头，不回显 secret）' })
  authorize(
    @Param('providerKey') providerKey: string,
    @Query('organizationId') organizationId: string,
    @Query('state') state?: string,
    @Query('nonce') nonce?: string,
    @Query('codeChallenge') codeChallenge?: string,
  ) {
    return this.sso
      .authorizationUrl(organizationId, providerKey, { state, nonce, codeChallenge })
      .then((url) => ({ url }))
  }

  @Post(':providerKey/callback')
  @ApiOperation({ summary: 'SSO 回调：CAS ticket / OIDC code → identity link（JIT 只给默认角色）' })
  callback(
    @Param('providerKey') providerKey: string,
    @Body()
    body: {
      organizationId: string
      ticket?: string
      samlResponse?: string
      code?: string
      codeVerifier?: string
      state?: string
      nonce?: string
    },
  ) {
    return this.sso.authenticate(body.organizationId, providerKey, {
      ticket: body.ticket,
      samlResponse: body.samlResponse,
      code: body.code,
      codeVerifier: body.codeVerifier,
      state: body.state,
      nonce: body.nonce,
    })
  }
}
