# Cache Module

Redis缓存模块，提供统一的缓存管理功能。

## 功能特性

- ✅ Redis集成
- ✅ 组织级缓存隔离
- ✅ 自动缓存键生成
- ✅ TTL支持
- ✅ 缓存失效机制

## 使用方法

### 1. 在Service中注入CacheService

```typescript
import { CacheService } from '../cache/cache.service'

@Injectable()
export class YourService {
  constructor(private cacheService: CacheService) {}

  async getData(id: string, organizationId: string) {
    const cacheKey = this.cacheService.orgKey(organizationId, 'data', id)
    
    // 尝试从缓存获取
    const cached = await this.cacheService.get(cacheKey)
    if (cached) {
      return cached
    }

    // 从数据库获取
    const data = await this.repository.findOne({ where: { id } })
    
    // 缓存5分钟
    await this.cacheService.set(cacheKey, data, 300)
    
    return data
  }

  async updateData(id: string, updates: any, organizationId: string) {
    // 更新数据
    await this.repository.update(id, updates)
    
    // 失效缓存
    const cacheKey = this.cacheService.orgKey(organizationId, 'data', id)
    await this.cacheService.del(cacheKey)
  }
}
```

### 2. 使用装饰器（计划中）

```typescript
import { Cacheable } from '../cache/decorators/cache.decorator'

@Controller('organizations')
export class OrganizationsController {
  @Get(':id')
  @Cacheable('organization::id', 300) // 缓存5分钟
  async findOne(@Param('id') id: string) {
    // ...
  }
}
```

## 环境变量

在 `.env` 文件中配置：

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=  # 可选
CACHE_TTL=300    # 默认TTL（秒）
CACHE_MAX_ITEMS=1000
```

## 缓存键命名规范

- 组织级缓存: `org:{organizationId}:{prefix}:{...parts}`
- 用户级缓存: `user:{userId}:{prefix}:{...parts}`
- 全局缓存: `{prefix}:{...parts}`

## 最佳实践

1. **使用组织级缓存键**：多租户环境下，始终使用 `orgKey()` 方法
2. **设置合理的TTL**：根据数据更新频率设置缓存时间
3. **及时失效缓存**：数据更新时立即失效相关缓存
4. **避免缓存敏感数据**：不要缓存密码、token等敏感信息
