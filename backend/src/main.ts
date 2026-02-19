import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { SwaggerModule } from '@nestjs/swagger'
import { NestExpressApplication } from '@nestjs/platform-express'
import { join } from 'path'
import { AppModule } from './app.module'
import { AllExceptionsFilter } from './common/filters/http-exception.filter'
import { ResponseInterceptor } from './common/interceptors/response.interceptor'
import { createSwaggerConfig, swaggerDocumentOptions } from './common/swagger/swagger.config'
import { PluginsModule } from './plugins/plugins.module'
import { PluginApiRouterService } from './plugins/infrastructure/runtime/plugin-api-router.service'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true, // Enable raw body for Stripe webhooks
  })

  // Get plugin API router service
  let pluginApiRouter: PluginApiRouterService | null = null
  try {
    pluginApiRouter = app.get(PluginApiRouterService, { strict: false })
  } catch {
    // Plugin module might not be available
  }

  // Serve static files from uploads directory
  const uploadsPath = join(process.cwd(), 'uploads')
  app.useStaticAssets(uploadsPath, {
    prefix: '/uploads',
  })

  // Serve plugin static files
  const pluginsPath = join(process.cwd(), 'plugins')
  app.useStaticAssets(pluginsPath, {
    prefix: '/plugins',
  })

  // Enable CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3050',
    credentials: true,
  })

  // Global error filter
  app.useGlobalFilters(new AllExceptionsFilter())

  // Global response interceptor
  app.useGlobalInterceptors(new ResponseInterceptor())

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  )

  // API prefix
  app.setGlobalPrefix('api')

  // Enhanced Swagger configuration
  const config = createSwaggerConfig()
  const document = SwaggerModule.createDocument(app, config, swaggerDocumentOptions)
  
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      docExpansion: 'list',
      filter: true,
      showRequestDuration: true,
    },
    customSiteTitle: 'Speckit API Documentation',
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info { margin: 20px 0 }
    `,
  })

  // Setup plugin API routes
  if (pluginApiRouter) {
    app.use('/api/plugins', pluginApiRouter.getRouter())
  }

  // Setup plugin API routes
  if (pluginApiRouter) {
    app.use('/api/plugins', pluginApiRouter.getRouter())
  }

  const port = process.env.PORT || 3051
  await app.listen(port)
  console.log(`Application is running on: http://localhost:${port}`)
  console.log(`API Documentation: http://localhost:${port}/api/docs`)
  console.log(`WebSocket Gateway: ws://localhost:${port}`)
}

bootstrap()
