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
  async login(@Body() loginDto: { email: string; password: string; organizationId?: string }) {
    try {
      return await this.loginService.execute({
        email: loginDto.email,
        password: loginDto.password,
        organizationId: loginDto.organizationId,
      })
    } catch (err) {
      if (err instanceof AuthenticationError) {
        throw new HttpException(err.message, HttpStatus.UNAUTHORIZED)
      }
      this.logger.error('Login failed', err instanceof Error ? err.stack : String(err))
      throw err
    }
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
    // Token invalidation would be handled by client-side removal
    return { message: 'Logged out successfully' }
  }

  @UseGuards(JwtAuthGuard)
  @Post('profile')
  async getProfile(@Request() req: any) {
    try {
      return await this.getProfileService.getProfile(req.user.id)
    } catch (err) {
      if (err instanceof AuthenticationError) {
        throw new BadRequestException(err.message)
      }
      throw err
    }
  }
}
