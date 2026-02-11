export class SettingResponseDto {
  id: string
  userId: string
  theme: 'light' | 'dark'
  language: string
  timezone: string
  dateFormat: string
  timeFormat: string
  pageSize: number
  fontSize: number
  enableNotifications: boolean
  createdAt: Date
  updatedAt: Date
}
