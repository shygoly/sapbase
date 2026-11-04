import { httpClient } from './client'

export interface BrandTheme {
  primary: string
  secondary: string
  accent: string
  background: string
  foreground: string
}

export interface BrandConfig {
  id: string
  organizationId: string
  logoUrl: string | null
  faviconUrl: string | null
  theme: BrandTheme
  customCss: string | null
  appName: string | null
  supportEmail: string | null
  supportUrl: string | null
  updatedAt: string
}

export interface UpdateBrandConfigDto {
  logoUrl?: string | null
  faviconUrl?: string | null
  theme?: Partial<BrandTheme>
  customCss?: string | null
  appName?: string | null
  supportEmail?: string | null
  supportUrl?: string | null
}

export const brandConfigApi = {
  /**
   * Get brand configuration for current organization
   */
  async getBrandConfig(organizationId: string): Promise<BrandConfig> {
    const response = await httpClient.get<BrandConfig>(
      `/api/organizations/${organizationId}/brand-config`,
    )
    return response.data
  },

  /**
   * Update brand configuration for current organization
   */
  async updateBrandConfig(
    organizationId: string,
    data: UpdateBrandConfigDto,
  ): Promise<BrandConfig> {
    const response = await httpClient.put<BrandConfig>(
      `/api/organizations/${organizationId}/brand-config`,
      data,
    )
    return response.data
  },

  /**
   * Upload logo file
   */
  async uploadLogo(
    organizationId: string,
    file: File,
  ): Promise<{ url: string; config: BrandConfig }> {
    const formData = new FormData()
    formData.append('file', file)

    const response = await httpClient.post<{ url: string; config: BrandConfig }>(
      `/api/organizations/${organizationId}/brand-config/upload-logo`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
    )
    return response.data
  },

  /**
   * Upload favicon file
   */
  async uploadFavicon(
    organizationId: string,
    file: File,
  ): Promise<{ url: string; config: BrandConfig }> {
    const formData = new FormData()
    formData.append('file', file)

    const response = await httpClient.post<{ url: string; config: BrandConfig }>(
      `/api/organizations/${organizationId}/brand-config/upload-favicon`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
    )
    return response.data
  },
}
