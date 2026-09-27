import { Injectable } from '@nestjs/common'
import { promises as fs } from 'fs'
import { join } from 'path'

export interface StoredFile {
  fileName: string
  filePath: string
  fileUrl: string
}

@Injectable()
export class ReportFileStorageService {
  private get reportsDir(): string {
    return process.env.SHIPPING_REPORTS_DIR || join(process.cwd(), 'uploads', 'shipping-reports')
  }

  private get publicBaseUrl(): string {
    return process.env.APP_URL || process.env.PUBLIC_URL || 'http://localhost:3051'
  }

  buildFileName(reportType: string, year: number | undefined, shipName: string | undefined): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    return `${reportType}-${year || 'all'}-${shipName || 'fleet'}-${timestamp}.xlsx`
      .replace(/\s+/g, '-')
      .toLowerCase()
  }

  async write(fileName: string, buffer: Buffer): Promise<StoredFile> {
    await fs.mkdir(this.reportsDir, { recursive: true })
    const filePath = join(this.reportsDir, fileName)
    await fs.writeFile(filePath, buffer)
    const fileUrl = `${this.publicBaseUrl}/uploads/shipping-reports/${fileName}`
    return { fileName, filePath, fileUrl }
  }
}
