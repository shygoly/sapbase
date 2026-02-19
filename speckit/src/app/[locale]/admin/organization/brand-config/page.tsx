'use client'

import { useState } from 'react'
import { useBrandConfig } from '@/contexts/brand-config-context'
import { useOrganizationStore } from '@/core/store/organization.store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FileUpload } from '@/components/brand/file-upload'
import { useToast } from '@/hooks/use-toast'
import { brandConfigApi } from '@/lib/api/brand-config'
import type { UpdateBrandConfigDto } from '@/lib/api/brand-config'

export default function BrandConfigPage() {
  const { config, updateConfig, loading, refreshConfig } = useBrandConfig()
  const currentOrganization = useOrganizationStore((state) => state.currentOrganization)
  const { toast } = useToast()
  const [formData, setFormData] = useState<UpdateBrandConfigDto>({
    logoUrl: config?.logoUrl ?? null,
    faviconUrl: config?.faviconUrl ?? null,
    appName: config?.appName ?? null,
    supportEmail: config?.supportEmail ?? null,
    supportUrl: config?.supportUrl ?? null,
    customCss: config?.customCss ?? null,
    theme: config?.theme ?? {
      primary: '#000000',
      secondary: '#666666',
      accent: '#0066CC',
      background: '#FFFFFF',
      foreground: '#000000',
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await updateConfig(formData)
      toast({
        title: 'Success',
        description: 'Brand configuration updated successfully',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update brand configuration',
        variant: 'destructive',
      })
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Brand Configuration</h1>
        <p className="text-muted-foreground">
          Customize your organization&apos;s branding and appearance
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Logo & Favicon</CardTitle>
            <CardDescription>Upload your organization logo and favicon</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <FileUpload
                label="Logo"
                accept="image/*"
                maxSize={5}
                value={formData.logoUrl || null}
                onChange={(url) => setFormData({ ...formData, logoUrl: url })}
                onUpload={async (file) => {
                  if (!currentOrganization?.id) {
                    throw new Error('No organization selected')
                  }
                  const result = await brandConfigApi.uploadLogo(currentOrganization.id, file)
                  await refreshConfig()
                  return result.url
                }}
                preview
              />
            </div>
            <div className="space-y-4">
              <FileUpload
                label="Favicon"
                accept="image/x-icon,image/vnd.microsoft.icon,image/png"
                maxSize={1}
                value={formData.faviconUrl || null}
                onChange={(url) => setFormData({ ...formData, faviconUrl: url })}
                onUpload={async (file) => {
                  if (!currentOrganization?.id) {
                    throw new Error('No organization selected')
                  }
                  const result = await brandConfigApi.uploadFavicon(currentOrganization.id, file)
                  await refreshConfig()
                  return result.url
                }}
                preview
              />
            </div>
            <div className="border-t pt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="logoUrl">Or enter Logo URL</Label>
                <Input
                  id="logoUrl"
                  type="url"
                  value={formData.logoUrl || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, logoUrl: e.target.value || null })
                  }
                  placeholder="https://example.com/logo.png"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="faviconUrl">Or enter Favicon URL</Label>
                <Input
                  id="faviconUrl"
                  type="url"
                  value={formData.faviconUrl || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, faviconUrl: e.target.value || null })
                  }
                  placeholder="https://example.com/favicon.ico"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Theme Colors</CardTitle>
            <CardDescription>Customize your brand colors</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primary">Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="primary"
                    type="color"
                    value={formData.theme?.primary || '#000000'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        theme: { ...formData.theme, primary: e.target.value },
                      })
                    }
                    className="w-20"
                  />
                  <Input
                    type="text"
                    value={formData.theme?.primary || '#000000'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        theme: { ...formData.theme, primary: e.target.value },
                      })
                    }
                    placeholder="#000000"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="secondary">Secondary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="secondary"
                    type="color"
                    value={formData.theme?.secondary || '#666666'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        theme: { ...formData.theme, secondary: e.target.value },
                      })
                    }
                    className="w-20"
                  />
                  <Input
                    type="text"
                    value={formData.theme?.secondary || '#666666'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        theme: { ...formData.theme, secondary: e.target.value },
                      })
                    }
                    placeholder="#666666"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="accent">Accent Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="accent"
                    type="color"
                    value={formData.theme?.accent || '#0066CC'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        theme: { ...formData.theme, accent: e.target.value },
                      })
                    }
                    className="w-20"
                  />
                  <Input
                    type="text"
                    value={formData.theme?.accent || '#0066CC'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        theme: { ...formData.theme, accent: e.target.value },
                      })
                    }
                    placeholder="#0066CC"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="background">Background Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="background"
                    type="color"
                    value={formData.theme?.background || '#FFFFFF'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        theme: { ...formData.theme, background: e.target.value },
                      })
                    }
                    className="w-20"
                  />
                  <Input
                    type="text"
                    value={formData.theme?.background || '#FFFFFF'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        theme: { ...formData.theme, background: e.target.value },
                      })
                    }
                    placeholder="#FFFFFF"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="foreground">Foreground Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="foreground"
                    type="color"
                    value={formData.theme?.foreground || '#000000'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        theme: { ...formData.theme, foreground: e.target.value },
                      })
                    }
                    className="w-20"
                  />
                  <Input
                    type="text"
                    value={formData.theme?.foreground || '#000000'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        theme: { ...formData.theme, foreground: e.target.value },
                      })
                    }
                    placeholder="#000000"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>General Settings</CardTitle>
            <CardDescription>Configure general branding options</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="appName">App Name</Label>
              <Input
                id="appName"
                value={formData.appName || ''}
                onChange={(e) =>
                  setFormData({ ...formData, appName: e.target.value || null })
                }
                placeholder="My Custom App"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supportEmail">Support Email</Label>
              <Input
                id="supportEmail"
                type="email"
                value={formData.supportEmail || ''}
                onChange={(e) =>
                  setFormData({ ...formData, supportEmail: e.target.value || null })
                }
                placeholder="support@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supportUrl">Support URL</Label>
              <Input
                id="supportUrl"
                type="url"
                value={formData.supportUrl || ''}
                onChange={(e) =>
                  setFormData({ ...formData, supportUrl: e.target.value || null })
                }
                placeholder="https://support.example.com"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Custom CSS</CardTitle>
            <CardDescription>Add custom CSS to further customize the appearance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="customCss">CSS Code</Label>
              <Textarea
                id="customCss"
                value={formData.customCss || ''}
                onChange={(e) =>
                  setFormData({ ...formData, customCss: e.target.value || null })
                }
                placeholder=".custom-class { color: red; }"
                rows={10}
                className="font-mono"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={loading}>
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  )
}
