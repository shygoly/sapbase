import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { AppModule } from './app.module'
import { AllExceptionsFilter } from './common/filters/http-exception.filter'
import { ResponseInterceptor } from './common/interceptors/response.interceptor'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // Enable CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
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

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Speckit ERP Backend API')
    .setDescription('Speckit ERP Backend API Documentation')
    .setVersion('1.0.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .addTag('Auth', 'Authentication endpoints')
    .addTag('Users', 'User management endpoints')
    .addTag('Roles', 'Role management endpoints')
    .addTag('Departments', 'Department management endpoints')
    .addTag('Permissions', 'Permission management endpoints')
    .addTag('Menu', 'Menu management endpoints')
    .addTag('Audit Logs', 'Audit log endpoints')
    .addTag('Settings', 'Settings endpoints')
    .build()

  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  })

  const port = process.env.PORT || 3001
  await app.listen(port)
  console.log(`Application is running on: http://localhost:${port}`)
  console.log(`API Documentation: http://localhost:${port}/api/docs`)
}

bootstrap()
