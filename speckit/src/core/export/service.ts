'use client'

export interface ExportOptions {
  filename?: string
  format?: 'csv' | 'json'
}

export class ExportService {
  exportToCSV<T extends Record<string, any>>(
    data: T[],
    columns: (keyof T)[],
    options: ExportOptions = {}
  ): void {
    const { filename = 'export', format = 'csv' } = options

    if (format === 'json') {
      this.exportToJSON(data, filename)
    } else {
      this.exportToCSVFormat(data, columns, filename)
    }
  }

  private exportToCSVFormat<T extends Record<string, any>>(
    data: T[],
    columns: (keyof T)[],
    filename: string
  ): void {
    // Create CSV header
    const header = columns.join(',')

    // Create CSV rows
    const rows = data.map(row =>
      columns
        .map(col => {
          const value = row[col]
          // Escape quotes and wrap in quotes if contains comma
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`
          }
          return value
        })
        .join(',')
    )

    const csv = [header, ...rows].join('\n')
    this.downloadFile(csv, `${filename}.csv`, 'text/csv')
  }

  private exportToJSON<T extends Record<string, any>>(
    data: T[],
    filename: string
  ): void {
    const json = JSON.stringify(data, null, 2)
    this.downloadFile(json, `${filename}.json`, 'application/json')
  }

  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }
}

export const exportService = new ExportService()
