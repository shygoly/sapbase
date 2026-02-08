import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, IsNull } from 'typeorm'
import { MenuItem } from './menu.entity'

@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(MenuItem)
    private menuRepository: Repository<MenuItem>,
  ) {}

  async findAll(): Promise<MenuItem[]> {
    return this.menuRepository.find({
      where: { parent: IsNull() },
      relations: ['children'],
      order: { order: 'ASC' },
    })
  }

  async findByPermissions(permissions: string[]): Promise<MenuItem[]> {
    const allItems = await this.menuRepository.find({
      relations: ['children'],
    })

    return this.filterByPermissions(allItems.filter((item) => !item.parent), permissions)
  }

  private filterByPermissions(items: MenuItem[], permissions: string[]): MenuItem[] {
    return items
      .filter((item) => !item.permissions || item.permissions.some((p) => permissions.includes(p)))
      .map((item) => ({
        ...item,
        children: item.children ? this.filterByPermissions(item.children, permissions) : [],
      }))
      .filter((item) => item.children.length > 0 || !item.permissions)
  }

  async create(menuItem: Partial<MenuItem>): Promise<MenuItem> {
    const item = this.menuRepository.create(menuItem)
    return this.menuRepository.save(item)
  }

  async update(id: string, menuItem: Partial<MenuItem>): Promise<MenuItem | null> {
    await this.menuRepository.update(id, menuItem)
    return this.menuRepository.findOne({ where: { id } })
  }

  async delete(id: string): Promise<void> {
    await this.menuRepository.delete(id)
  }
}

