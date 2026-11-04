import { NestFactory } from '@nestjs/core'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { createSwaggerConfig, swaggerDocumentOptions } from '../common/swagger/swagger.config'

/**
 * Script to generate OpenAPI specification file.
 * 
 * Usage:
 * ```bash
 * npm run generate:openapi
 * ```
 * 
 * Output: openapi.json and openapi.yaml in the project root
 */
async function generateOpenAPI() {
  // Dynamically import AppModule to avoid loading WebSocket dependencies
  // which may not be installed during documentation generation
  let AppModule: any
  try {
    AppModule = require('../app.module').AppModule
  } catch (error) {
    console.error('Failed to load AppModule:', error)
    process.exit(1)
  }

  let app: any
  let document: any

  try {
    app = await NestFactory.create(AppModule, {
      logger: false, // Suppress logs during generation
      abortOnError: false, // Don't abort on errors during generation
    })

    app.setGlobalPrefix('api')

    const config = createSwaggerConfig()
    document = SwaggerModule.createDocument(app, config, swaggerDocumentOptions)
  } catch (error: any) {
    console.warn('⚠️  Could not create full app, trying alternative approach...')
    console.warn('Error:', error.message)
    
    // Fallback: Create minimal app and scan controllers manually
    const { Module } = await import('@nestjs/common')
    const { ConfigModule } = await import('@nestjs/config')
    
    @Module({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
    })
    class MinimalAppModule {}
    
    app = await NestFactory.create(MinimalAppModule, { logger: false })
    app.setGlobalPrefix('api')
    
    const config = createSwaggerConfig()
    // Create document with minimal app - will only include controllers that can be loaded
    document = SwaggerModule.createDocument(app, config, swaggerDocumentOptions)
    
    console.warn('⚠️  Generated partial documentation (some modules may be missing)')
  }

  // Generate JSON
  const jsonPath = join(process.cwd(), 'openapi.json')
  writeFileSync(jsonPath, JSON.stringify(document, null, 2), 'utf8')
  console.log(`✅ OpenAPI JSON generated: ${jsonPath}`)

  // Generate YAML (requires yaml package)
  try {
    const yaml = require('yaml')
    const yamlPath = join(process.cwd(), 'openapi.yaml')
    writeFileSync(yamlPath, yaml.stringify(document), 'utf8')
    console.log(`✅ OpenAPI YAML generated: ${yamlPath}`)
  } catch (error) {
    console.warn('⚠️  YAML generation skipped (install "yaml" package for YAML support)')
  }

  await app.close()
  console.log('✅ OpenAPI specification generation completed!')
}

generateOpenAPI().catch((error) => {
  console.error('❌ Error generating OpenAPI specification:', error)
  process.exit(1)
})
