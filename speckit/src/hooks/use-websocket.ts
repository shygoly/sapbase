'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { WebSocketClient, Notification } from '@/lib/websocket/websocket-client'
import { apiClient } from '@/lib/api/client'

interface UseWebSocketOptions {
  autoConnect?: boolean
  onNotification?: (notification: Notification) => void
  onConnected?: () => void
  onDisconnected?: () => void
}

/**
 * React hook for WebSocket connection management.
 * 
 * Usage:
 * ```tsx
 * const { connected, connect, disconnect, sendNotification } = useWebSocket({
 *   onNotification: (notification) => {
 *     console.log('New notification:', notification)
 *   }
 * })
 * ```
 */
export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { autoConnect = true, onNotification, onConnected, onDisconnected } = options
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const clientRef = useRef<WebSocketClient | null>(null)

  const connect = useCallback(async () => {
    try {
      const token = apiClient.getAuthToken() || ''
      if (!token) {
        throw new Error('No authentication token found')
      }

      const serverUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3051'
      const client = new WebSocketClient(serverUrl, token)

      // Set up notification handler
      if (onNotification) {
        client.onNotification(onNotification)
      }

      // Set up connection handler
      client.onConnected(() => {
        setConnected(true)
        setError(null)
        onConnected?.()
      })

      await client.connect()
      clientRef.current = client
      setConnected(true)
      setError(null)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to connect')
      setError(error)
      setConnected(false)
      // Connection error handled via state
    }
  }, [onNotification, onConnected])

  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect()
      clientRef.current = null
      setConnected(false)
      onDisconnected?.()
    }
  }, [onDisconnected])

  useEffect(() => {
    if (autoConnect) {
      connect()
    }

    return () => {
      disconnect()
    }
  }, [autoConnect, connect, disconnect])

  return {
    connected,
    error,
    connect,
    disconnect,
    client: clientRef.current,
  }
}
