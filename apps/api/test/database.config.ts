import { TypeOrmModuleOptions } from '@nestjs/typeorm'

export const testDatabaseConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  username: process.env.DATABASE_USER || 'test_user',
  password: process.env.DATABASE_PASSWORD || 'test_password',
  database: process.env.DATABASE_NAME || 'sapbasic_test',
  entities: ['src/**/*.entity.ts'],
  synchronize: true,
  dropSchema: true,
  logging: false,
}
