import { Module, forwardRef } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { AppWebSocketGateway } from './websocket.gateway'
import { NotificationService } from './services/notification.service'
import { CollaborationService } from './services/collaboration.service'
import { UsersModule } from '../users/users.module'
import { OrganizationsModule } from '../organizations/organizations.module'

/**
 * WebSocket module for real-time features:
 * - Real-time notifications
 * - Collaborative editing
 * - Live updates
 */
@Module({
  imports: [
    JwtModule.register({}),
    UsersModule,
    OrganizationsModule,
  ],
  providers: [AppWebSocketGateway, NotificationService, CollaborationService],
  exports: [AppWebSocketGateway, NotificationService, CollaborationService],
})
export class WebSocketModule {}
