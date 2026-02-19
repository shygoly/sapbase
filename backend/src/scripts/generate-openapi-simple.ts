import { NestFactory } from '@nestjs/core'
import { SwaggerModule } from '@nestjs/swagger'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { createSwaggerConfig, swaggerDocumentOptions } from '../common/swagger/swagger.config'

/**
 * Simplified script to generate OpenAPI specification.
 * This version skips problematic modules to focus on API documentation.
 */
async function generateOpenAPI() {
  console.log('🚀 Starting OpenAPI generation...')

  // Create a minimal app module for documentation generation
  const { Module } = await import('@nestjs/common')
  const { ConfigModule } = await import('@nestjs/config')

  @Module({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        envFilePath: '.env',
      }),
      // Import only modules needed for Swagger generation
      // Skip WebSocket and EventBus modules that have dependency issues
    ],
  })
  class DocsAppModule {}

  try {
    const app = await NestFactory.create(DocsAppModule, {
      logger: false,
    })

    app.setGlobalPrefix('api')

    const config = createSwaggerConfig()
    
    // Try to get the full app module for complete documentation
    let document: any
    try {
      const { AppModule } = await import('../app.module')
      const fullApp = await NestFactory.create(AppModule, {
        logger: false,
        abortOnError: false,
      })
      fullApp.setGlobalPrefix('api')
      document = SwaggerModule.createDocument(fullApp, config, swaggerDocumentOptions)
      await fullApp.close()
    } catch (error) {
      console.warn('⚠️  Could not load full AppModule, using minimal module')
      document = SwaggerModule.createDocument(app, config, swaggerDocumentOptions)
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
  } catch (error) {
    console.error('❌ Error generating OpenAPI specification:', error)
    process.exit(1)
  }
}

generateOpenAPI()
