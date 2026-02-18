import { Module, Global } from '@nestjs/common'
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { redisStore } from 'cache-manager-redis-store'
import { CacheService } from './cache.service'

@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const redisHost = configService.get<string>('REDIS_HOST', 'localhost')
        const redisPort = configService.get<number>('REDIS_PORT', 6379)
        const redisPassword = configService.get<string>('REDIS_PASSWORD') || undefined

        // Use cache-manager-redis-store for NestJS compatibility
        const store = await redisStore({
          socket: {
            host: redisHost,
            port: redisPort,
          },
          password: redisPassword,
        })

        return {
          store: () => store,
          ttl: configService.get<number>('CACHE_TTL', 300) * 1000, // Convert to milliseconds
          max: configService.get<number>('CACHE_MAX_ITEMS', 1000),
        }
      },
      inject: [ConfigService],
    }),
  ],
  providers: [CacheService],
  exports: [NestCacheModule, CacheService],
})
export class CacheModule {}
