import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common'
import { AuthService } from './auth.service'
import { JwtAuthGuard } from './jwt-auth.guard'

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() loginDto: { email: string; password: string }) {
    const user = await this.authService.validateUser(loginDto.email, loginDto.password)
    if (!user) {
      throw new Error('Invalid credentials')
    }
    return this.authService.login(user)
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
    return req.user
  }
}
