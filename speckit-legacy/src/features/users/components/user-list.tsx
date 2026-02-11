'use client'

import { useState, useEffect } from 'react'
import { userApi, type User } from '../api'
import { Button } from '@/components/ui/button'

interface UserListProps {
  onEdit?: (user: User) => void
  onDelete?: (user: User) => void
}

export function UserList({ onEdit, onDelete }: UserListProps) {
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setIsLoading(true)
      const data = await userApi.getUsers()
      setUsers(data)
    } catch (error) {
      return
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) return <div>Loading...</div>

  return (
    <div className="space-y-4">
      <table className="w-full border-collapse border">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2 text-left">Name</th>
            <th className="border p-2 text-left">Email</th>
            <th className="border p-2 text-left">Role</th>
            <th className="border p-2 text-left">Status</th>
            <th className="border p-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr key={user.id}>
              <td className="border p-2">{user.name}</td>
              <td className="border p-2">{user.email}</td>
              <td className="border p-2">{user.role}</td>
              <td className="border p-2">{user.status}</td>
              <td className="border p-2 space-x-2">
                {onEdit && (
                  <Button onClick={() => onEdit(user)} size="sm" variant="outline">
                    Edit
                  </Button>
                )}
                {onDelete && (
                  <Button onClick={() => onDelete(user)} size="sm" variant="destructive">
                    Delete
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
