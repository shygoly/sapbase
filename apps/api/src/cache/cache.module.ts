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
        const ttl = configService.get<number>('CACHE_TTL', 300) * 1000 // ms
        const max = configService.get<number>('CACHE_MAX_ITEMS', 1000)
        const useRedis = configService.get<string>('CACHE_DRIVER', 'redis') === 'redis'

        if (useRedis) {
          try {
            const redisHost = configService.get<string>('REDIS_HOST', 'localhost')
            const redisPort = configService.get<number>('REDIS_PORT', 6379)
            const redisPassword = configService.get<string>('REDIS_PASSWORD') || undefined
            const store = await redisStore({
              socket: { host: redisHost, port: redisPort },
              password: redisPassword,
            })
            return { store: () => store, ttl, max }
          } catch {
            // Redis unavailable (e.g. not running locally): fall back to in-memory
          }
        }
        // In-memory cache (default when no store provided)
        return { ttl, max }
      },
      inject: [ConfigService],
    }),
  ],
  providers: [CacheService],
  exports: [NestCacheModule, CacheService],
})
export class CacheModule {}
