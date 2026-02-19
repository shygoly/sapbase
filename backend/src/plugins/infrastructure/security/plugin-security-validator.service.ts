import { Injectable, BadRequestException, Logger } from '@nestjs/common'
import * as fs from 'fs/promises'
import * as path from 'path'
import AdmZip from 'adm-zip'
import type { PluginManifest } from '../../domain/entities/plugin.entity'

export interface SecurityValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Plugin Security Validator Service
 * Performs security validation on plugin packages including manifest validation and code scanning
 */
@Injectable()
export class PluginSecurityValidatorService {
  private readonly logger = new Logger(PluginSecurityValidatorService.name)

  // Maximum file size limits (in bytes)
  private readonly MAX_ZIP_SIZE = 50 * 1024 * 1024 // 50MB
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB per file
  private readonly MAX_TOTAL_FILES = 1000

  // Dangerous patterns to scan for in code
  private readonly DANGEROUS_PATTERNS = [
    {
      pattern: /eval\s*\(/gi,
      description: 'Use of eval() function',
      severity: 'error',
    },
    {
      pattern: /Function\s*\(/gi,
      description: 'Use of Function constructor',
      severity: 'error',
    },
    {
      pattern: /require\s*\(\s*['"]child_process['"]/gi,
      description: 'Attempt to require child_process module',
      severity: 'error',
    },
    {
      pattern: /require\s*\(\s*['"]fs['"]/gi,
      description: 'Direct use of fs module (should use plugin context)',
      severity: 'warning',
    },
    {
      pattern: /process\.exit/gi,
      description: 'Attempt to exit process',
      severity: 'error',
    },
    {
      pattern: /\.\.\/\.\.\/\.\./g,
      description: 'Path traversal attempt',
      severity: 'error',
    },
  ]

  // Allowed file extensions
  private readonly ALLOWED_EXTENSIONS = [
    '.js',
    '.ts',
    '.json',
    '.md',
    '.txt',
    '.css',
    '.scss',
    '.html',
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.svg',
    '.woff',
    '.woff2',
    '.ttf',
    '.eot',
  ]

  /**
   * Validate plugin ZIP file for security issues
   */
  async validatePluginPackage(
    zipPath: string,
    manifest: PluginManifest,
  ): Promise<SecurityValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []

    try {
      // Check ZIP file size
      const stats = await fs.stat(zipPath)
      if (stats.size > this.MAX_ZIP_SIZE) {
        errors.push(
          `Plugin package exceeds maximum size limit of ${this.MAX_ZIP_SIZE / 1024 / 1024}MB`,
        )
      }

      // Validate manifest permissions are reasonable
      this.validateManifestPermissions(manifest, errors, warnings)

      // Scan ZIP contents
      const zip = new AdmZip(zipPath)
      const zipEntries = zip.getEntries()

      if (zipEntries.length > this.MAX_TOTAL_FILES) {
        errors.push(
          `Plugin contains too many files (${zipEntries.length} > ${this.MAX_TOTAL_FILES})`,
        )
      }

      // Scan files for security issues
      for (const entry of zipEntries) {
        if (entry.isDirectory) {
          continue
        }

        // Check file size
        if (entry.header.size > this.MAX_FILE_SIZE) {
          errors.push(
            `File ${entry.entryName} exceeds maximum size limit of ${this.MAX_FILE_SIZE / 1024 / 1024}MB`,
          )
        }

        // Check file extension
        const ext = path.extname(entry.entryName).toLowerCase()
        if (
          !this.ALLOWED_EXTENSIONS.includes(ext) &&
          !entry.entryName.endsWith('/')
        ) {
          warnings.push(
            `File ${entry.entryName} has disallowed extension: ${ext}`,
          )
        }

        // Scan code files for dangerous patterns
        if (this.isCodeFile(entry.entryName)) {
          const content = entry.getData().toString('utf-8')
          this.scanCodeContent(entry.entryName, content, errors, warnings)
        }
      }

      // Validate entry point exists
      if (manifest.entry?.backend) {
        const entryExists = zipEntries.some(
          (e: { entryName: string }) => e.entryName === manifest.entry!.backend,
        )
        if (!entryExists) {
          errors.push(
            `Declared entry point ${manifest.entry.backend} not found in package`,
          )
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
      }
    } catch (error) {
      this.logger.error('Security validation failed:', error)
      errors.push(`Security validation error: ${(error as Error).message}`)
      return {
        isValid: false,
        errors,
        warnings,
      }
    }
  }

  /**
   * Validate manifest permissions are reasonable
   */
  private validateManifestPermissions(
    manifest: PluginManifest,
    errors: string[],
    warnings: string[],
  ): void {
    const permissions = manifest.permissions || {}

    // Check for excessive API permissions
    if (permissions.api?.endpoints) {
      if (permissions.api.endpoints.length > 50) {
        warnings.push(
          `Plugin requests ${permissions.api.endpoints.length} API endpoints, which seems excessive`,
        )
      }

      // Check for wildcard endpoints
      if (permissions.api.endpoints.some((ep) => ep.includes('*'))) {
        warnings.push('Plugin requests wildcard API endpoints')
      }
    }

    // Check for excessive database permissions
    if (permissions.database?.tables) {
      if (permissions.database.tables.length > 20) {
        warnings.push(
          `Plugin requests access to ${permissions.database.tables.length} database tables, which seems excessive`,
        )
      }

      // Check for wildcard table access
      if (permissions.database.tables.some((t) => t.includes('*'))) {
        warnings.push('Plugin requests wildcard database table access')
      }
    }

    // Check for delete operations (more sensitive)
    if (
      permissions.database?.operations?.includes('delete') &&
      permissions.database.tables &&
      permissions.database.tables.length > 5
    ) {
      warnings.push(
        'Plugin requests delete operations on multiple tables - review carefully',
      )
    }
  }

  /**
   * Check if file is a code file that should be scanned
   */
  private isCodeFile(fileName: string): boolean {
    const ext = path.extname(fileName).toLowerCase()
    return ['.js', '.ts', '.jsx', '.tsx'].includes(ext)
  }

  /**
   * Scan code content for dangerous patterns
   */
  private scanCodeContent(
    fileName: string,
    content: string,
    errors: string[],
    warnings: string[],
  ): void {
    for (const check of this.DANGEROUS_PATTERNS) {
      const matches = content.match(check.pattern)
      if (matches) {
        const message = `${check.description} found in ${fileName}`
        if (check.severity === 'error') {
          errors.push(message)
        } else {
          warnings.push(message)
        }
      }
    }
  }
}
