# Backend Developer Guide

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 12+
- npm or yarn

### Installation

```bash
cd backend
npm install
```

### Environment Setup

```bash
cp .env.example .env
# Edit .env with your database credentials
```

### Running the Application

```bash
# Development mode with hot reload
npm run start:dev

# Production mode
npm run build
npm run start:prod

# Debug mode
npm run start:debug
```

### Running Tests

```bash
# Run all tests
npm run test

# Watch mode
npm run test:watch

# Coverage report
npm run test:cov

# E2E tests
npm run test:e2e
```

## Code Style & Conventions

### TypeScript

- Use strict mode: `"strict": true` in tsconfig.json
- Always use explicit return types for functions
- Use interfaces for object shapes, types for unions/primitives
- Prefer `const` over `let`, avoid `var`

### Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Classes | PascalCase | `UserService`, `CreateUserDto` |
| Functions | camelCase | `findUserById`, `validateEmail` |
| Constants | UPPER_SNAKE_CASE | `MAX_PAGE_SIZE`, `DEFAULT_TIMEOUT` |
| Files | kebab-case | `user.service.ts`, `create-user.dto.ts` |
| Interfaces | PascalCase with `I` prefix (optional) | `IUserRepository`, `PaginatedResult` |
| Enums | PascalCase | `UserRole`, `SortOrder` |

### File Organization

```
src/
├── common/
│   ├── decorators/
│   ├── dto/
│   ├── entities/
│   ├── filters/
│   ├── guards/
│   ├── helpers/
│   ├── interfaces/
│   ├── interceptors/
│   ├── middleware/
│   └── index.ts
├── auth/
├── users/
├── roles/
├── departments/
├── permissions/
├── menu/
├── settings/
├── audit-logs/
├── health/
├── migrations/
├── seeds/
├── app.module.ts
└── main.ts
```

## Creating New Entities

### Step 1: Create Entity Class

```typescript
// src/products/product.entity.ts
import { Entity, Column, ManyToOne } from 'typeorm'
import { BaseEntity } from '../common/entities/base.entity'
import { Department } from '../departments/department.entity'

@Entity('products')
export class Product extends BaseEntity {
  @Column()
  name: string

  @Column({ nullable: true })
  description: string

  @Column('decimal', { precision: 10, scale: 2 })
  price: number

  @ManyToOne(() => Department)
  department: Department
}
```

### Step 2: Create DTOs

```typescript
// src/products/dto/create-product.dto.ts
import { IsString, IsNumber, IsOptional } from 'class-validator'

export class CreateProductDto {
  @IsString()
  name: string

  @IsOptional()
  @IsString()
  description?: string

  @IsNumber()
  price: number
}

// src/products/dto/update-product.dto.ts
import { PartialType } from '@nestjs/mapped-types'
import { CreateProductDto } from './create-product.dto'

export class UpdateProductDto extends PartialType(CreateProductDto) {}

// src/products/dto/find-products-query.dto.ts
import { BaseQueryDto } from '../common/dto/base-query.dto'
import { IsOptional, IsString } from 'class-validator'

export class FindProductsQueryDto extends BaseQueryDto {
  @IsOptional()
  @IsString()
  department?: string
}
```

### Step 3: Create Service

```typescript
// src/products/products.service.ts
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Product } from './product.entity'
import { CreateProductDto } from './dto/create-product.dto'
import { UpdateProductDto } from './dto/update-product.dto'
import { FindProductsQueryDto } from './dto/find-products-query.dto'
import { BaseCrudHelper, PaginatedResult } from '../common'

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
  ) {}

  async create(createProductDto: CreateProductDto): Promise<Product> {
    const product = this.productsRepository.create(createProductDto)
    return this.productsRepository.save(product)
  }

  async findAll(query: FindProductsQueryDto): Promise<PaginatedResult<Product>> {
    return BaseCrudHelper.paginate(this.productsRepository, query)
  }

  async findOne(id: string): Promise<Product> {
    return BaseCrudHelper.findOneOrFail(
      this.productsRepository,
      id,
      'Product'
    )
  }

  async update(id: string, updateProductDto: UpdateProductDto): Promise<Product> {
    return BaseCrudHelper.updateById(
      this.productsRepository,
      id,
      updateProductDto,
      'Product'
    )
  }

  async remove(id: string): Promise<void> {
    return BaseCrudHelper.removeById(
      this.productsRepository,
      id,
      'Product'
    )
  }
}
```

### Step 4: Create Controller

```typescript
// src/products/products.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { ProductsService } from './products.service'
import { CreateProductDto } from './dto/create-product.dto'
import { UpdateProductDto } from './dto/update-product.dto'
import { FindProductsQueryDto } from './dto/find-products-query.dto'
import { Auth } from '../common/decorators/auth.decorator'
import { Product } from './product.entity'

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Auth('admin')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createProductDto: CreateProductDto): Promise<Product> {
    return this.productsService.create(createProductDto)
  }

  @Get()
  @Auth()
  async findAll(@Query() query: FindProductsQueryDto) {
    return this.productsService.findAll(query)
  }

  @Get(':id')
  @Auth()
  async findOne(@Param('id') id: string): Promise<Product> {
    return this.productsService.findOne(id)
  }

  @Put(':id')
  @Auth('admin')
  async update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
  ): Promise<Product> {
    return this.productsService.update(id, updateProductDto)
  }

  @Delete(':id')
  @Auth('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    return this.productsService.remove(id)
  }
}
```

### Step 5: Register Module

```typescript
// src/products/products.module.ts
import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ProductsService } from './products.service'
import { ProductsController } from './products.controller'
import { Product } from './product.entity'

@Module({
  imports: [TypeOrmModule.forFeature([Product])],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
```

### Step 6: Add to App Module

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common'
import { ProductsModule } from './products/products.module'
// ... other imports

@Module({
  imports: [
    // ... other modules
    ProductsModule,
  ],
})
export class AppModule {}
```

## Using Base Classes and Helpers

### BaseCrudHelper Methods

#### Finding Entities

```typescript
// Find by ID or throw NotFoundException
const user = await BaseCrudHelper.findOneOrFail(
  this.usersRepository,
  userId,
  'User'
)
```

#### Pagination

```typescript
// Paginate with custom options
const result = await BaseCrudHelper.paginate(
  this.usersRepository,
  query,
  {
    relations: ['role', 'department'],
    where: { status: 'active' },
  }
)
```

#### Updating Entities

```typescript
// Update by ID
const updated = await BaseCrudHelper.updateById(
  this.usersRepository,
  userId,
  updateDto,
  'User'
)
```

#### Removing Entities

```typescript
// Remove by ID
await BaseCrudHelper.removeById(
  this.usersRepository,
  userId,
  'User'
)
```

## Authentication & Authorization

### Using @Auth Decorator

```typescript
// No role restriction (authenticated users only)
@Get()
@Auth()
async findAll() {}

// Single role
@Post()
@Auth('admin')
async create(@Body() createDto: CreateUserDto) {}

// Multiple roles
@Put(':id')
@Auth('admin', 'manager')
async update(@Param('id') id: string, @Body() updateDto: UpdateUserDto) {}
```

### Getting Current User

```typescript
import { CurrentUser } from '../auth/current-user.decorator'
import { User } from '../users/user.entity'

@Get('profile')
@Auth()
async getProfile(@CurrentUser() user: User) {
  return user
}
```

## Database Migrations

### Generate Migration

```bash
npm run migration:generate -- src/migrations/CreateUsersTable
```

### Run Migrations

```bash
npm run migration:run
```

### Revert Migration

```bash
npm run migration:revert
```

## Seeding Data

### Run Seeds

```bash
# Run all seeds
npm run seed

# Run test data
npm run seed:test

# Run mock data
npm run seed:mock
```

## Code Quality

### Linting

```bash
npm run lint
```

### Formatting

```bash
npm run format
```

### Type Checking

```bash
npx tsc --noEmit
```

## Common Patterns

### Error Handling

```typescript
import { BadRequestException, NotFoundException } from '@nestjs/common'

// Throw specific exceptions
if (!user) {
  throw new NotFoundException('User not found')
}

if (email.includes('@')) {
  throw new BadRequestException('Invalid email format')
}
```

### Validation

```typescript
import { IsEmail, IsString, MinLength } from 'class-validator'

export class CreateUserDto {
  @IsEmail()
  email: string

  @IsString()
  @MinLength(8)
  password: string
}
```

### Transactions

```typescript
import { DataSource } from 'typeorm'

async createUserWithRole(
  createUserDto: CreateUserDto,
  roleId: string,
): Promise<User> {
  const queryRunner = this.dataSource.createQueryRunner()
  await queryRunner.connect()
  await queryRunner.startTransaction()

  try {
    const user = await queryRunner.manager.save(User, createUserDto)
    await queryRunner.manager.update(User, user.id, { roleId })
    await queryRunner.commitTransaction()
    return user
  } catch (error) {
    await queryRunner.rollbackTransaction()
    throw error
  } finally {
    await queryRunner.release()
  }
}
```

## Troubleshooting

### Build Errors

```bash
# Clear build cache
npm run prebuild

# Rebuild
npm run build
```

### Database Connection Issues

```bash
# Check .env file
cat .env

# Verify PostgreSQL is running
psql -U postgres -d your_database
```

### Port Already in Use

```bash
# Change port in .env
PORT=3001

# Or kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

## Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [TypeORM Documentation](https://typeorm.io/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Passport.js Documentation](http://www.passportjs.org/)
