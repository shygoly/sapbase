'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useWebSocket } from './use-websocket'
import type { Collaborator, CollaborationUpdate } from '@/lib/websocket/websocket-client'

interface UseCollaborationOptions {
  resourceType: string
  resourceId: string
  autoJoin?: boolean
  onUpdate?: (update: CollaborationUpdate) => void
  onUserJoined?: (user: Collaborator) => void
  onUserLeft?: (userId: string) => void
}

/**
 * React hook for collaborative editing.
 * 
 * Usage:
 * ```tsx
 * const { collaborators, sendUpdate, sendCursorUpdate } = useCollaboration({
 *   resourceType: 'workflow',
 *   resourceId: workflowId,
 *   onUpdate: (update) => {
 *     // Apply changes to local state
 *   }
 * })
 * ```
 */
export function useCollaboration(options: UseCollaborationOptions) {
  const {
    resourceType,
    resourceId,
    autoJoin = true,
    onUpdate,
    onUserJoined,
    onUserLeft,
  } = options

  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [joined, setJoined] = useState(false)
  const updateHandlerRef = useRef(onUpdate)
  const joinedHandlerRef = useRef(onUserJoined)
  const leftHandlerRef = useRef(onUserLeft)

  // Update refs when callbacks change
  useEffect(() => {
    updateHandlerRef.current = onUpdate
    joinedHandlerRef.current = onUserJoined
    leftHandlerRef.current = onUserLeft
  }, [onUpdate, onUserJoined, onUserLeft])

  const { client, connected } = useWebSocket({
    autoConnect: true,
  })

  const join = useCallback(async () => {
    if (!client || !connected) {
      return
    }

    try {
      await client.joinCollaboration(resourceType, resourceId)
      setJoined(true)

      // Set up event handlers
      client.onCollaborationUpdate((update) => {
        if (
          update.resourceType === resourceType &&
          update.resourceId === resourceId
        ) {
          updateHandlerRef.current?.(update)
        }
      })

      client.onUserJoined((data) => {
        if (
          data.resourceType === resourceType &&
          data.resourceId === resourceId
        ) {
          setCollaborators((prev) => {
            if (!prev.find((u) => u.id === data.user.id)) {
              return [...prev, data.user]
            }
            return prev
          })
          joinedHandlerRef.current?.(data.user)
        }
      })

      client.onUserLeft((data) => {
        if (
          data.resourceType === resourceType &&
          data.resourceId === resourceId
        ) {
          setCollaborators((prev) => prev.filter((u) => u.id !== data.userId))
          leftHandlerRef.current?.(data.userId)
        }
      })

      client.onCurrentUsers((data) => {
        if (
          data.resourceType === resourceType &&
          data.resourceId === resourceId
        ) {
          setCollaborators(data.users)
        }
      })
    } catch (error) {
      // Join failed, state already reset
    }
  }, [client, connected, resourceType, resourceId])

  const leave = useCallback(() => {
    if (client && joined) {
      client.leaveCollaboration(resourceType, resourceId)
      setJoined(false)
      setCollaborators([])
    }
  }, [client, joined, resourceType, resourceId])

  const sendUpdate = useCallback(
    (changes: any, cursor?: { line: number; column: number }) => {
      if (client && joined) {
        client.sendCollaborationUpdate(resourceType, resourceId, changes, cursor)
      }
    },
    [client, joined, resourceType, resourceId],
  )

  const sendCursorUpdate = useCallback(
    (cursor: { line: number; column: number }) => {
      if (client && joined) {
        client.sendCursorUpdate(resourceType, resourceId, cursor)
      }
    },
    [client, joined, resourceType, resourceId],
  )

  useEffect(() => {
    if (autoJoin && connected) {
      join()
    }

    return () => {
      if (joined) {
        leave()
      }
    }
  }, [autoJoin, connected, join, leave, joined])

  return {
    collaborators,
    joined,
    connected,
    join,
    leave,
    sendUpdate,
    sendCursorUpdate,
  }
}
