import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { UsersModule } from './users/users.module'
import { AuthModule } from './auth/auth.module'
import { DepartmentsModule } from './departments/departments.module'
import { RolesModule } from './roles/roles.module'
import { User } from './users/user.entity'
import { Department } from './departments/department.entity'
import { Role } from './roles/role.entity'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || 'mac',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'sapbasic',
      entities: [User, Department, Role],
      synchronize: true,
      logging: process.env.NODE_ENV === 'development',
    }),
    UsersModule,
    AuthModule,
    DepartmentsModule,
    RolesModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
