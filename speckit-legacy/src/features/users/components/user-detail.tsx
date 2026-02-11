'use client'

import { useState, useEffect } from 'react'
import { userApi, type User } from '../api'

interface UserDetailProps {
  userId: string
}

export function UserDetail({ userId }: UserDetailProps) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadUser()
  }, [userId])

  const loadUser = async () => {
    try {
      setIsLoading(true)
      const data = await userApi.getUser(userId)
      setUser(data)
    } catch (error) {
      return
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) return <div>Loading...</div>
  if (!user) return <div>User not found</div>

  return (
    <div className="space-y-4 p-4 border rounded">
      <div>
        <label className="text-sm font-medium">Name</label>
        <p>{user.name}</p>
      </div>
      <div>
        <label className="text-sm font-medium">Email</label>
        <p>{user.email}</p>
      </div>
      <div>
        <label className="text-sm font-medium">Role</label>
        <p>{user.role}</p>
      </div>
      <div>
        <label className="text-sm font-medium">Status</label>
        <p>{user.status}</p>
      </div>
      <div>
        <label className="text-sm font-medium">Created</label>
        <p>{new Date(user.createdAt).toLocaleString()}</p>
      </div>
    </div>
  )
}
