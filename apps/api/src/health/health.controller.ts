import { Controller, Get } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { ApiResponseDto } from '../common/dto/api-response.dto'

interface HealthStatus {
  status: 'ok' | 'error'
  timestamp: string
  uptime: number
  environment: string
}

@ApiTags('Health')
@Controller('health')
export class HealthController {
  private startTime = Date.now()

  @Get()
  @ApiOperation({ summary: 'Check application health' })
  @ApiResponse({
    status: 200,
    description: 'Application is healthy',
    type: ApiResponseDto,
  })
  checkHealth(): ApiResponseDto<HealthStatus> {
    const healthStatus: HealthStatus = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      environment: process.env.NODE_ENV || 'development',
    }

    return ApiResponseDto.success(healthStatus, 'Application is healthy')
  }
}
