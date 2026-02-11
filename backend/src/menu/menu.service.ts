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

  async findOne(id: string): Promise<MenuItem | null> {
    return this.menuRepository.findOne({
      where: { id },
      relations: ['children', 'parent'],
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
    let parent: MenuItem | null = null

    if (menuItem.parent?.id) {
      parent = await this.menuRepository.findOne({
        where: { id: menuItem.parent.id },
      })
      if (!parent) {
        throw new Error(`Parent menu item with id ${menuItem.parent.id} not found`)
      }
    }

    const { parent: _parent, ...rest } = menuItem
    const item = this.menuRepository.create({
      ...rest,
      parent: parent ?? undefined,
    })
    return this.menuRepository.save(item) as Promise<MenuItem>
  }

  async update(id: string, menuItem: Partial<MenuItem>): Promise<MenuItem | null> {
    let parent: MenuItem | null | undefined = undefined

    if (menuItem.parent?.id) {
      parent = await this.menuRepository.findOne({
        where: { id: menuItem.parent.id },
      })
      if (!parent) {
        throw new Error(`Parent menu item with id ${menuItem.parent.id} not found`)
      }
    }

    const { parent: _parent, ...rest } = menuItem
    const updateData: Partial<MenuItem> = { ...rest }
    if (parent !== undefined) {
      updateData.parent = parent ?? undefined
    }

    await this.menuRepository.update(id, updateData)
    return this.menuRepository.findOne({
      where: { id },
      relations: ['children', 'parent'],
    })
  }

  async remove(id: string): Promise<void> {
    // Soft delete: set parent to null for children
    await this.menuRepository.update(
      { parent: { id } },
      { parent: null } as unknown as Partial<MenuItem>,
    )
    await this.menuRepository.delete(id)
  }

  async reorder(items: { id: string; order: number }[]): Promise<MenuItem[]> {
    for (const item of items) {
      await this.menuRepository.update(item.id, { order: item.order })
    }
    return this.findAll()
  }

  async delete(id: string): Promise<void> {
    await this.menuRepository.delete(id)
  }
}

