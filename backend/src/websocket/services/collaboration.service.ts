import { Injectable, Logger } from '@nestjs/common'

interface Collaborator {
  id: string
  email?: string
  joinedAt: string
  lastSeen: string
}

interface CollaborationRoom {
  resourceType: string
  resourceId: string
  collaborators: Map<string, Collaborator>
}

/**
 * Service for managing collaborative editing sessions.
 */
@Injectable()
export class CollaborationService {
  private readonly logger = new Logger(CollaborationService.name)
  private readonly rooms = new Map<string, CollaborationRoom>()

  /**
   * Add a collaborator to a resource
   */
  addCollaborator(
    resourceType: string,
    resourceId: string,
    userId: string,
    user: Omit<Collaborator, 'lastSeen'>,
  ): void {
    const roomKey = this.getRoomKey(resourceType, resourceId)
    let room = this.rooms.get(roomKey)

    if (!room) {
      room = {
        resourceType,
        resourceId,
        collaborators: new Map(),
      }
      this.rooms.set(roomKey, room)
    }

    room.collaborators.set(userId, {
      ...user,
      lastSeen: new Date().toISOString(),
    })

    this.logger.log(
      `User ${userId} joined collaboration: ${resourceType}:${resourceId}`,
    )
  }

  /**
   * Remove a collaborator from a resource
   */
  removeCollaborator(
    resourceType: string,
    resourceId: string,
    userId: string,
  ): void {
    const roomKey = this.getRoomKey(resourceType, resourceId)
    const room = this.rooms.get(roomKey)

    if (room) {
      room.collaborators.delete(userId)

      // Clean up empty rooms
      if (room.collaborators.size === 0) {
        this.rooms.delete(roomKey)
      }

      this.logger.log(
        `User ${userId} left collaboration: ${resourceType}:${resourceId}`,
      )
    }
  }

  /**
   * Update collaborator's last seen timestamp
   */
  updateLastSeen(
    resourceType: string,
    resourceId: string,
    userId: string,
  ): void {
    const roomKey = this.getRoomKey(resourceType, resourceId)
    const room = this.rooms.get(roomKey)

    if (room) {
      const collaborator = room.collaborators.get(userId)
      if (collaborator) {
        collaborator.lastSeen = new Date().toISOString()
      }
    }
  }

  /**
   * Get all collaborators for a resource
   */
  getCollaborators(resourceType: string, resourceId: string): Collaborator[] {
    const roomKey = this.getRoomKey(resourceType, resourceId)
    const room = this.rooms.get(roomKey)

    if (!room) {
      return []
    }

    return Array.from(room.collaborators.values())
  }

  /**
   * Handle user disconnect - remove from all collaboration rooms
   */
  handleUserDisconnect(userId: string): void {
    for (const [roomKey, room] of this.rooms.entries()) {
      if (room.collaborators.has(userId)) {
        room.collaborators.delete(userId)

        // Clean up empty rooms
        if (room.collaborators.size === 0) {
          this.rooms.delete(roomKey)
        }
      }
    }

    this.logger.log(`User ${userId} removed from all collaboration rooms`)
  }

  /**
   * Get room key
   */
  private getRoomKey(resourceType: string, resourceId: string): string {
    return `${resourceType}:${resourceId}`
  }
}
