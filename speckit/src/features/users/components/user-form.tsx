'use client'

import { useState } from 'react'
import { userApi, type User, type CreateUserInput } from '../api'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'

interface UserFormProps {
  user?: User
  onSuccess?: () => void
}

export function UserForm({ user, onSuccess }: UserFormProps) {
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    role: user?.role || 'user',
    department: user?.department || '',
  })
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setIsLoading(true)
      if (user) {
        await userApi.updateUser(user.id, formData)
      } else {
        await userApi.createUser(formData as CreateUserInput)
      }
      onSuccess?.()
    } catch (error) {
      console.error('Failed to save user:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-md">
      <div>
        <Label htmlFor="name" className="text-base font-medium">Name</Label>
        <input
          id="name"
          type="text"
          value={formData.name}
          onChange={e => setFormData({ ...formData, name: e.target.value })}
          className="w-full border rounded px-3 py-2 mt-2"
          required
        />
      </div>
      <div>
        <Label htmlFor="email" className="text-base font-medium">Email</Label>
        <input
          id="email"
          type="email"
          value={formData.email}
          onChange={e => setFormData({ ...formData, email: e.target.value })}
          className="w-full border rounded px-3 py-2 mt-2"
          required
        />
      </div>
      <div className="space-y-3">
        <Label className="text-base font-medium">Role</Label>
        <RadioGroup value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="user" id="user" />
            <Label htmlFor="user" className="font-normal cursor-pointer">User</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="admin" id="admin" />
            <Label htmlFor="admin" className="font-normal cursor-pointer">Admin</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="super_admin" id="super_admin" />
            <Label htmlFor="super_admin" className="font-normal cursor-pointer">Super Admin</Label>
          </div>
        </RadioGroup>
      </div>
      <Button type="submit" disabled={isLoading}>
        {isLoading ? 'Saving...' : user ? 'Update' : 'Create'}
      </Button>
    </form>
  )
}
