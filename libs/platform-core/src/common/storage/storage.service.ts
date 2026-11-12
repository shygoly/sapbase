import { BadRequestException, Inject, Injectable, Optional } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AssetsService } from '../../assets/assets.service'
import { OBJECT_STORAGE, type ObjectStorage } from '../../assets/object-storage'
import * as fs from 'fs'
import * as path from 'path'
import { v4 as uuidv4 } from 'uuid'

export interface UploadedFile {
  filename: string
  originalName: string
  mimetype: string
  size: number
  path: string
  url: string
}

@Injectable()
export class StorageService {
  private readonly uploadDir: string
  private readonly publicUrl: string

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly assets?: AssetsService,
    @Optional() @Inject(OBJECT_STORAGE) private readonly objectStorage?: ObjectStorage,
  ) {
    // Get upload directory from config or use default
    this.uploadDir = this.configService.get<string>(
      'UPLOAD_DIR',
      path.join(process.cwd(), 'uploads'),
    )
    this.publicUrl =
      this.configService.get<string>('PUBLIC_URL') ||
      this.configService.get<string>('APP_URL', 'http://localhost:3001') ||
      'http://localhost:3001'

    // Ensure upload directory exists
    this.ensureDirectoryExists(this.uploadDir)
    this.ensureDirectoryExists(path.join(this.uploadDir, 'brand'))
  }

  /**
   * Upload a file to the storage
   */
  async uploadFile(
    file: Express.Multer.File,
    subfolder: string = 'brand',
    organizationId?: string,
  ): Promise<UploadedFile & { assetId?: string }> {
    if (!file) {
      throw new BadRequestException('No file provided')
    }

    // Validate file type
    const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon']
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed types: ${allowedMimes.join(', ')}`,
      )
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds 5MB limit')
    }

    // Generate unique filename
    const fileExtension = path.extname(file.originalname)
    const filename = `${uuidv4()}${fileExtension}`
    const uploadPath = path.join(this.uploadDir, subfolder, filename)

    // Save file
    await fs.promises.writeFile(uploadPath, file.buffer)

    // Generate public URL
    const url = `${this.publicUrl}/uploads/${subfolder}/${filename}`
    let assetId: string | undefined
    if (organizationId && this.assets && this.objectStorage) {
      try {
        const objectKey = `org/${organizationId}/legacy-uploads/${subfolder}/${filename}`
        await this.objectStorage.put(objectKey, file.buffer, { contentType: file.mimetype })
        const asset = await this.assets.create(organizationId, {
          objectKey,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          kind: 'image',
          status: 'ready',
          scanStatus: 'skipped',
          isPublic: true,
          metadata: { legacyUrl: url, source: 'brand' },
          createdBy: null,
        })
        assetId = asset.id
      } catch {
        // 资产登记失败不破坏旧品牌上传；旧 URL 仍可用。
      }
    }

    return {
      filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      path: uploadPath,
      url,
      assetId,
    }
  }

  /**
   * Delete a file from storage
   */
  async deleteFile(fileUrl: string): Promise<void> {
    try {
      // Extract filename from URL
      const urlParts = fileUrl.split('/uploads/')
      if (urlParts.length !== 2) {
        return // Not a local file URL, skip deletion
      }

      const filePath = path.join(this.uploadDir, urlParts[1])
      
      // Check if file exists
      if (await fs.promises.access(filePath).then(() => true).catch(() => false)) {
        await fs.promises.unlink(filePath)
      }
    } catch (error) {
      // Log error but don't throw (file might not exist)
      console.error('Error deleting file:', error)
    }
  }

  /**
   * Get file URL from filename
   */
  getFileUrl(filename: string, subfolder: string = 'brand'): string {
    return `${this.publicUrl}/uploads/${subfolder}/${filename}`
  }

  /**
   * Ensure directory exists
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.promises.access(dirPath)
    } catch {
      await fs.promises.mkdir(dirPath, { recursive: true })
    }
  }
}
