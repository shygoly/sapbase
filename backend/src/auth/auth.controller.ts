import { Controller, Post, Body, UseGuards, Request, HttpException, HttpStatus } from '@nestjs/common'
import { AuthService } from './auth.service'
import { JwtAuthGuard } from './jwt-auth.guard'
import { OrganizationsService } from '../organizations/organizations.service'

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private organizationsService: OrganizationsService,
  ) {}

  @Post('login')
  async login(@Body() loginDto: { email: string; password: string; organizationId?: string }) {
    const user = await this.authService.validateUser(loginDto.email, loginDto.password)
    if (!user) {
      throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED)
    }
    return this.authService.login(user, loginDto.organizationId)
  }

  @UseGuards(JwtAuthGuard)
  @Post('switch-organization')
  async switchOrganization(@Request() req: any, @Body() body: { organizationId: string }) {
    const newToken = await this.authService.switchOrganization(req.user.id, body.organizationId)
    return newToken
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
    const organizations = await this.organizationsService.findAll(req.user.id)
    return {
      ...req.user,
      organizations,
    }
  }
}
