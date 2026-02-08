'use client'

import { useState, useEffect } from 'react'
import { settingsApi, type SystemSettings } from '../api'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'

export function SystemSettingsForm() {
  const [settings, setSettings] = useState<SystemSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setIsLoading(true)
      const data = await settingsApi.getSettings()
      setSettings(data)
    } catch (error) {
      console.error('Failed to load settings:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!settings) return
    try {
      await settingsApi.updateSettings(settings)
      alert('Settings saved successfully')
    } catch (error) {
      console.error('Failed to save settings:', error)
    }
  }

  if (isLoading) return <div>Loading...</div>
  if (!settings) return <div>Failed to load settings</div>

  return (
    <div className="space-y-6 max-w-md">
      <div className="space-y-3">
        <Label className="text-base font-medium">Theme</Label>
        <RadioGroup value={settings.theme} onValueChange={(value) => setSettings({ ...settings, theme: value as 'light' | 'dark' })}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="light" id="light" />
            <Label htmlFor="light" className="font-normal cursor-pointer">Light Mode</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="dark" id="dark" />
            <Label htmlFor="dark" className="font-normal cursor-pointer">Dark Mode</Label>
          </div>
        </RadioGroup>
      </div>

      <div className="space-y-3">
        <Label className="text-base font-medium">Language</Label>
        <RadioGroup value={settings.language} onValueChange={(value) => setSettings({ ...settings, language: value })}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="en" id="en" />
            <Label htmlFor="en" className="font-normal cursor-pointer">English</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="zh" id="zh" />
            <Label htmlFor="zh" className="font-normal cursor-pointer">Chinese</Label>
          </div>
        </RadioGroup>
      </div>

      <div>
        <Label htmlFor="timezone" className="text-base font-medium">Timezone</Label>
        <input
          id="timezone"
          type="text"
          value={settings.timezone}
          onChange={e => setSettings({ ...settings, timezone: e.target.value })}
          className="w-full border rounded px-3 py-2 mt-2"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-base font-medium">Font Size</Label>
          <span className="text-sm text-muted-foreground">{settings.fontSize || 14}px</span>
        </div>
        <Slider
          value={[settings.fontSize || 14]}
          onValueChange={(value) => setSettings({ ...settings, fontSize: value[0] })}
          min={12}
          max={20}
          step={1}
          className="w-full"
        />
      </div>

      <Button onClick={handleSave}>Save Settings</Button>
    </div>
  )
}
