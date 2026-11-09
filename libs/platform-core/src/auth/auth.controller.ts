import { Controller, Post, Body, UseGuards, Request, HttpException, HttpStatus, BadRequestException, Logger } from '@nestjs/common'
import { AuthService } from './auth.service'
import { JwtAuthGuard } from './jwt-auth.guard'
import { OrganizationsService } from '../organizations/organizations.service'
import { LoginService } from '../auth-context/application/services/login.service'
import { SwitchOrganizationService } from '../auth-context/application/services/switch-organization.service'
import { GetProfileService } from '../auth-context/application/services/get-profile.service'
import { AuthenticationError } from '../auth-context/domain/errors'

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name)

  constructor(
    private authService: AuthService,
    private organizationsService: OrganizationsService,
    private readonly loginService: LoginService,
    private readonly switchOrganizationService: SwitchOrganizationService,
    private readonly getProfileService: GetProfileService,
  ) {}

  @Post('login')
  async login(
    @Body() loginDto: { email: string; password: string; organizationId?: string },
    @Request() req: any,
  ) {
    try {
      return await this.loginService.execute({
        email: loginDto.email,
        password: loginDto.password,
        organizationId: loginDto.organizationId,
        ip: req?.ip,
        userAgent: req?.headers?.['user-agent'],
      })
    } catch (err) {
      if (err instanceof AuthenticationError) {
        throw new HttpException(err.message, HttpStatus.UNAUTHORIZED)
      }
      this.logger.error('Login failed', err instanceof Error ? err.stack : String(err))
      throw err
    }
  }

  @Post('refresh')
  async refresh(@Body() body: { sid: string; refreshToken: string }) {
    if (!body?.sid || !body?.refreshToken) {
      throw new BadRequestException('sid 与 refreshToken 必填')
    }
    return this.authService.refresh(body.sid, body.refreshToken)
  }

  @UseGuards(JwtAuthGuard)
  @Post('switch-organization')
  async switchOrganization(@Request() req: any, @Body() body: { organizationId: string }) {
    try {
      return await this.switchOrganizationService.execute({
        userId: req.user.id,
        organizationId: body.organizationId,
        currentOrganizationId: req.user.organizationId,
      })
    } catch (err) {
      if (err instanceof AuthenticationError) {
        throw new BadRequestException(err.message)
      }
      throw err
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Request() req: any) {
    await this.authService.logout(req.user?.sid)
    return { message: 'Logged out successfully' }
  }

  @UseGuards(JwtAuthGuard)
  @Post('profile')
  async getProfile(@Request() req: any) {
    try {
      return await this.getProfileService.getProfile(req.user.id, req.user.organizationId)
    } catch (err) {
      if (err instanceof AuthenticationError) {
        throw new BadRequestException(err.message)
      }
      throw err
    }
  }
}
