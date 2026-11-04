import { Injectable, BadRequestException, Logger } from '@nestjs/common'
import * as fs from 'fs/promises'
import * as path from 'path'
import AdmZip from 'adm-zip'
import type { PluginManifest } from '../../domain/entities/plugin.entity'

export interface SecurityValidationResult {
  isValid: boolean
  /** 判决项：结构事实（包过大、声明的入口不在包里…）—— 命中即拒。 */
  errors: string[]
  /** 兼容字段：与 signals 同源（旧调用方读 warnings）。 */
  warnings: string[]
  /**
   * **信号**：源码文本扫描的命中。
   *
   * 它们不参与判决（`isValid` 不看它们），原因是这类检查**可绕也会误报**：
   * 拼接出来的模块名绕得过去，注释里的例子又会命中。能绕过的检查不该有阻断权 ——
   * 真正的边界是 `plugin-host-process` 的 `node --permission` 子进程。
   * 见 docs/protocols/plugin-sandbox.md §3。
   */
  signals: string[]
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
    const signals: string[] = []

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
          this.scanCodeContent(entry.entryName, content, signals)
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
        warnings: [...warnings, ...signals],
        signals,
      }
    } catch (error) {
      this.logger.error('Security validation failed:', error)
      errors.push(`Security validation error: ${(error as Error).message}`)
      return {
        isValid: false,
        errors,
        warnings,
        signals,
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
    signals: string[],
  ): void {
    for (const check of this.DANGEROUS_PATTERNS) {
      if (content.match(check.pattern)) {
        // 只写信号：命中不等于"这个插件会作恶"（注释与字符串都会命中），
        // 也不等于"没命中就安全"（拼接能绕）。它有用，但没有阻断权。
        signals.push(`[signal] ${check.description} found in ${fileName}`)
      }
    }
  }
}
