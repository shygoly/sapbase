/**
 * Settings Management Page
 * Runtime-First architecture: Schema-first with PageRuntime wrapper
 */

'use client'

import React, { useState, useEffect } from 'react'
import { settingsApi } from '@/lib/api'
import { Setting } from '@/lib/api/types'
import { useNotification } from '@/core/ui/ui-hooks'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { PageRuntime, type PageModel } from '@/components/runtime'
import { FormRuntime, type FormModel } from '@/components/runtime'

// PageModel schema
const SettingsPageModel: PageModel = {
  id: 'settings-page',
  title: 'Settings',
  description: 'Manage your personal settings and preferences',
  permissions: ['settings:read'],
}

// FormModel schema
const SettingsFormModel: FormModel = {
  id: 'settings-form',
  name: 'Settings Form',
  permissions: ['settings:update'],
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, any>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const notification = useNotification()

  // Fetch settings
  const fetchSettings = async () => {
    setIsLoading(true)
    try {
      const result = await settingsApi.findByUserId()
      const settingsMap: Record<string, any> = {}
      result.forEach((setting) => {
        settingsMap[setting.key] = setting.value
      })
      setSettings(settingsMap)
    } catch (error) {
      notification.error('Failed to load settings')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  const handleSaveSettings = async () => {
    setIsSaving(true)
    try {
      // Save each setting
      for (const [key, value] of Object.entries(settings)) {
        await settingsApi.update({ key, value })
      }
      notification.success('Settings saved successfully')
    } catch (error) {
      notification.error('Failed to save settings')
      console.error(error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSettingChange = (key: string, value: any) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  return (
    <PageRuntime model={SettingsPageModel} isLoading={isLoading}>
      <div className="space-y-6">
        {/* Settings Form */}
        <FormRuntime model={SettingsFormModel}>
          <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-6">
            {/* Theme Setting */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-900">Theme</label>
          <select
            value={settings.theme || 'light'}
            onChange={(e) => handleSettingChange('theme', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="auto">Auto</option>
          </select>
          <p className="text-sm text-gray-500">Choose your preferred theme</p>
        </div>

        {/* Language Setting */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-900">Language</label>
          <select
            value={settings.language || 'en'}
            onChange={(e) => handleSettingChange('language', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="en">English</option>
            <option value="zh">中文</option>
            <option value="es">Español</option>
            <option value="fr">Français</option>
          </select>
          <p className="text-sm text-gray-500">Select your preferred language</p>
        </div>

        {/* Notifications Setting */}
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.notifications !== false}
              onChange={(e) => handleSettingChange('notifications', e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-sm font-medium text-gray-900">Enable Notifications</span>
          </label>
          <p className="text-sm text-gray-500">Receive notifications for important events</p>
        </div>

        {/* Email Notifications Setting */}
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.emailNotifications !== false}
              onChange={(e) => handleSettingChange('emailNotifications', e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-sm font-medium text-gray-900">Email Notifications</span>
          </label>
          <p className="text-sm text-gray-500">Receive email notifications</p>
        </div>

        {/* Items Per Page Setting */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-900">Items Per Page</label>
          <select
            value={settings.itemsPerPage || 10}
            onChange={(e) => handleSettingChange('itemsPerPage', parseInt(e.target.value))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <p className="text-sm text-gray-500">Default number of items to display per page</p>
        </div>

        {/* Save Button */}
        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <Button
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="flex-1"
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Settings
          </Button>
          </div>
        </div>
        </FormRuntime>
      </div>
    </PageRuntime>
  )
}
