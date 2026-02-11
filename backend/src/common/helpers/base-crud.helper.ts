import { Repository, FindManyOptions, FindOptionsWhere, ObjectLiteral } from 'typeorm'
import { NotFoundException } from '@nestjs/common'
import { PaginatedResult } from '../interfaces/paginated-result.interface'
import { BaseQueryDto } from '../dto/base-query.dto'

/**
 * Base CRUD helper class
 * Provides common CRUD operations for all services
 */
export class BaseCrudHelper {
  /**
   * Find entity by ID or throw NotFoundException
   * @param repository - TypeORM repository
   * @param id - Entity ID
   * @param entityName - Entity name for error message
   * @returns Entity instance
   */
  static async findOneOrFail<T extends ObjectLiteral>(
    repository: Repository<T>,
    id: string,
    entityName: string,
  ): Promise<T> {
    const entity = await repository.findOne({
      where: { id } as any,
    })

    if (!entity) {
      throw new NotFoundException(`${entityName} with ID ${id} not found`)
    }

    return entity
  }

  /**
   * Paginate query results
   * @param repository - TypeORM repository
   * @param query - Base query DTO with pagination parameters
   * @param options - Additional find options
   * @returns Paginated result
   */
  static async paginate<T extends ObjectLiteral>(
    repository: Repository<T>,
    query: BaseQueryDto,
    options?: FindManyOptions<T>,
  ): Promise<PaginatedResult<T>> {
    const { page = 1, pageSize = 10, sortBy, sortOrder = 'ASC' } = query
    const skip = (page - 1) * pageSize

    // Merge options with pagination
    const findOptions: FindManyOptions<T> = {
      ...options,
      skip,
      take: pageSize,
    }

    // Add sorting if specified
    if (sortBy) {
      findOptions.order = {
        [sortBy]: sortOrder,
      } as any
    }

    const [data, total] = await repository.findAndCount(findOptions)

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }
  }

  /**
   * Update entity by ID
   * @param repository - TypeORM repository
   * @param id - Entity ID
   * @param updateDto - Update DTO
   * @param entityName - Entity name for error message
   * @returns Updated entity
   */
  static async updateById<T extends ObjectLiteral>(
    repository: Repository<T>,
    id: string,
    updateDto: Partial<T>,
    entityName: string,
  ): Promise<T> {
    await this.findOneOrFail(repository, id, entityName)
    await repository.update(id as any, updateDto as any)
    return this.findOneOrFail(repository, id, entityName)
  }

  /**
   * Remove entity by ID
   * @param repository - TypeORM repository
   * @param id - Entity ID
   * @param entityName - Entity name for error message
   */
  static async removeById<T extends ObjectLiteral>(
    repository: Repository<T>,
    id: string,
    entityName: string,
  ): Promise<void> {
    const entity = await this.findOneOrFail(repository, id, entityName)
    await repository.remove(entity)
  }
}
