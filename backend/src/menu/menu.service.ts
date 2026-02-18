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

  async findAll(organizationId: string): Promise<MenuItem[]> {
    const items = await this.menuRepository.find({
      where: { parent: IsNull(), organizationId },
      relations: ['children'],
      order: { order: 'ASC' },
    })
    return this.filterDisabled(items)
  }

  private filterDisabled(items: MenuItem[]): MenuItem[] {
    return items
      .filter(item => !item.disabled)
      .map(item => ({
        ...item,
        children: item.children ? this.filterDisabled(item.children) : [],
      }))
  }

  async findOne(id: string, organizationId: string): Promise<MenuItem | null> {
    return this.menuRepository.findOne({
      where: { id, organizationId },
      relations: ['children', 'parent'],
    })
  }

  async findByPermissions(permissions: string[], organizationId: string): Promise<MenuItem[]> {
    const allItems = await this.menuRepository.find({
      where: { organizationId },
      relations: ['children'],
    })

    const rootItems = allItems.filter((item) => !item.parent)
    const filteredByDisabled = this.filterDisabled(rootItems)
    return this.filterByPermissions(filteredByDisabled, permissions)
  }

  private filterByPermissions(items: MenuItem[], permissions: string[]): MenuItem[] {
    return items
      .filter((item) => {
        // If no permissions required, show item
        if (!item.permissions || item.permissions.length === 0) return true
        // Check if user has any of the required permissions
        return item.permissions.some((p) => permissions.includes(p))
      })
      .map((item) => ({
        ...item,
        children: item.children ? this.filterByPermissions(item.children, permissions) : [],
      }))
      // Keep parent items even if they have no children (they might be expandable)
      .filter((item) => {
        // Keep if has children (after filtering) OR has no permission requirements
        return item.children.length > 0 || !item.permissions || item.permissions.length === 0
      })
  }

  async create(menuItem: Partial<MenuItem>, organizationId: string): Promise<MenuItem> {
    let parent: MenuItem | null = null

    if (menuItem.parent?.id) {
      parent = await this.menuRepository.findOne({
        where: { id: menuItem.parent.id, organizationId },
      })
      if (!parent) {
        throw new Error(`Parent menu item with id ${menuItem.parent.id} not found`)
      }
    }

    const { parent: _parent, ...rest } = menuItem
    const item = this.menuRepository.create({
      ...rest,
      organizationId,
      parent: parent ?? undefined,
    })
    return this.menuRepository.save(item) as Promise<MenuItem>
  }

  async update(id: string, menuItem: Partial<MenuItem>, organizationId: string): Promise<MenuItem | null> {
    let parent: MenuItem | null | undefined = undefined

    if (menuItem.parent?.id) {
      parent = await this.menuRepository.findOne({
        where: { id: menuItem.parent.id, organizationId },
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

    await this.menuRepository.update({ id, organizationId }, updateData)
    return this.menuRepository.findOne({
      where: { id, organizationId },
      relations: ['children', 'parent'],
    })
  }

  async remove(id: string, organizationId: string): Promise<void> {
    // Soft delete: set parent to null for children
    await this.menuRepository.update(
      { parent: { id }, organizationId },
      { parent: null } as unknown as Partial<MenuItem>,
    )
    await this.menuRepository.delete({ id, organizationId })
  }

  async reorder(items: { id: string; order: number }[], organizationId: string): Promise<MenuItem[]> {
    for (const item of items) {
      await this.menuRepository.update({ id: item.id, organizationId }, { order: item.order })
    }
    return this.findAll(organizationId)
  }

  async delete(id: string, organizationId: string): Promise<void> {
    await this.menuRepository.delete({ id, organizationId })
  }
}

