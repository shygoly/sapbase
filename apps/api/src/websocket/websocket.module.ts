import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { AppWebSocketGateway } from './websocket.gateway'
import { CollaborationService } from './services/collaboration.service'
import { UsersModule } from '../users/users.module'
import { OrganizationsModule } from '../organizations/organizations.module'
import { NotificationsModule } from '../notifications/notifications.module'

/**
 * WebSocket module for real-time features:
 * - Real-time notifications
 * - Collaborative editing
 * - Live updates
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || 'your-secret-key',
      }),
    }),
    UsersModule,
    OrganizationsModule,
    NotificationsModule,
  ],
  providers: [AppWebSocketGateway, CollaborationService],
  exports: [AppWebSocketGateway, CollaborationService, NotificationsModule],
})
export class WebSocketModule {}
