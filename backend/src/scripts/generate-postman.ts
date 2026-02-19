import { NestFactory } from '@nestjs/core'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { AppModule } from '../app.module'
import { createSwaggerConfig, swaggerDocumentOptions } from '../common/swagger/swagger.config'

interface PostmanCollection {
  info: {
    name: string
    description: string
    schema: string
    version: string
  }
  auth?: {
    type: string
    bearer?: Array<{ key: string; value: string; type: string }>
  }
  item: PostmanItem[]
  variable?: Array<{ key: string; value: string; type: string }>
}

interface PostmanItem {
  name: string
  request: {
    method: string
    header: Array<{ key: string; value: string; type?: string }>
    url: {
      raw: string
      host: string[]
      path: string[]
      query?: Array<{ key: string; value: string; disabled?: boolean }>
    }
    body?: {
      mode: string
      raw?: string
      formdata?: any[]
      urlencoded?: any[]
    }
    auth?: {
      type: string
      bearer?: Array<{ key: string; value: string; type: string }>
    }
    description?: string
  }
  response?: any[]
  item?: PostmanItem[]
}

/**
 * Convert OpenAPI spec to Postman collection format.
 */
function convertToPostmanCollection(openApiDoc: any, baseUrl: string): PostmanCollection {
  const collection: PostmanCollection = {
    info: {
      name: openApiDoc.info.title || 'Speckit API',
      description: openApiDoc.info.description || '',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      version: openApiDoc.info.version || '1.0.0',
    },
    auth: {
      type: 'bearer',
      bearer: [
        {
          key: 'token',
          value: '{{access_token}}',
          type: 'string',
        },
      ],
    },
    item: [],
    variable: [
      {
        key: 'base_url',
        value: baseUrl,
        type: 'string',
      },
      {
        key: 'access_token',
        value: '',
        type: 'string',
      },
    ],
  }

  // Group by tags
  const tagsMap = new Map<string, PostmanItem[]>()

  if (openApiDoc.paths) {
    Object.entries(openApiDoc.paths).forEach(([path, methods]: [string, any]) => {
      Object.entries(methods).forEach(([method, operation]: [string, any]) => {
        if (method === 'parameters') return

        const tags = operation.tags || ['Default']
        const tag = tags[0]

        if (!tagsMap.has(tag)) {
          tagsMap.set(tag, [])
        }

        const item: PostmanItem = {
          name: operation.summary || `${method.toUpperCase()} ${path}`,
          request: {
            method: method.toUpperCase(),
            header: [
              {
                key: 'Content-Type',
                value: 'application/json',
              },
            ],
            url: {
              raw: `{{base_url}}${path}`,
              host: ['{{base_url}}'],
              path: path.split('/').filter((p: string) => p),
            },
            description: operation.description || '',
          },
        }

        // Add query parameters
        if (operation.parameters) {
          const queryParams = operation.parameters.filter(
            (p: any) => p.in === 'query',
          )
          if (queryParams.length > 0) {
            item.request.url.query = queryParams.map((p: any) => ({
              key: p.name,
              value: p.example || '',
              disabled: !p.required,
            }))
          }
        }

        // Add request body
        if (operation.requestBody) {
          const content = operation.requestBody.content
          if (content && content['application/json']) {
            const schema = content['application/json'].schema
            item.request.body = {
              mode: 'raw',
              raw: JSON.stringify(generateExampleFromSchema(schema), null, 2),
            }
            item.request.header.push({
              key: 'Content-Type',
              value: 'application/json',
            })
          }
        }

        // Add authentication if required
        if (operation.security && operation.security.length > 0) {
          item.request.auth = {
            type: 'bearer',
            bearer: [
              {
                key: 'token',
                value: '{{access_token}}',
                type: 'string',
              },
            ],
          }
        }

        tagsMap.get(tag)!.push(item)
      })
    })
  }

  // Convert tags map to collection items
  tagsMap.forEach((items, tag) => {
    collection.item.push({
      name: tag,
      item: items,
      request: {
        method: 'GET',
        header: [],
        url: {
          raw: '',
          host: [],
          path: [],
        },
      },
    })
  })

  return collection
}

/**
 * Generate example from JSON schema.
 */
function generateExampleFromSchema(schema: any): any {
  if (!schema) return {}

  if (schema.example) {
    return schema.example
  }

  if (schema.type === 'object' && schema.properties) {
    const example: any = {}
    Object.entries(schema.properties).forEach(([key, prop]: [string, any]) => {
      example[key] = generateExampleFromSchema(prop)
    })
    return example
  }

  if (schema.type === 'array' && schema.items) {
    return [generateExampleFromSchema(schema.items)]
  }

  // Default values based on type
  switch (schema.type) {
    case 'string':
      return schema.format === 'email' ? 'user@example.com' : 'string'
    case 'number':
    case 'integer':
      return 0
    case 'boolean':
      return false
    case 'array':
      return []
    default:
      return null
  }
}

/**
 * Script to generate Postman collection from OpenAPI specification.
 * 
 * Usage:
 * ```bash
 * npm run generate:postman
 * ```
 * 
 * Output: postman-collection.json in the project root
 */
async function generatePostmanCollection() {
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3051/api'
  let document: any

  // Try to load from existing openapi.json first
  const openApiPath = join(process.cwd(), 'openapi.json')
  try {
    const fs = require('fs')
    if (fs.existsSync(openApiPath)) {
      console.log('📄 Loading OpenAPI spec from existing file...')
      document = JSON.parse(fs.readFileSync(openApiPath, 'utf8'))
    } else {
      throw new Error('openapi.json not found')
    }
  } catch (error) {
    console.log('🔄 Generating OpenAPI spec from app...')
    // Fallback: generate from app
    let app: any
    try {
      const AppModule = require('../app.module').AppModule
      app = await NestFactory.create(AppModule, {
        logger: false,
        abortOnError: false,
      })
      app.setGlobalPrefix('api')
      const config = createSwaggerConfig()
      document = SwaggerModule.createDocument(app, config, swaggerDocumentOptions)
      await app.close()
    } catch (error: any) {
      console.error('❌ Failed to generate OpenAPI spec:', error.message)
      process.exit(1)
    }
  }

  const collection = convertToPostmanCollection(document, baseUrl)

  const outputPath = join(process.cwd(), 'postman-collection.json')
  writeFileSync(outputPath, JSON.stringify(collection, null, 2), 'utf8')

  console.log(`✅ Postman collection generated: ${outputPath}`)
  console.log(`📦 Import this file into Postman to get started!`)
}

generatePostmanCollection().catch((error) => {
  console.error('❌ Error generating Postman collection:', error)
  process.exit(1)
})
