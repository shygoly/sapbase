/**
 * Script to delete all menu items that appear after Profile in the menu list
 * Profile has order=7, so we delete all items with order > 7
 * Or we can find Profile and delete all items created after it
 */
import { DataSource } from 'typeorm'
import { MenuItem } from '../src/menu/menu.entity'
import * as dotenv from 'dotenv'

dotenv.config()

async function deleteMenuItemsAfterProfile() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'speckit',
    entities: [MenuItem],
    synchronize: false,
  })

  try {
    await dataSource.initialize()
    console.log('Database connected')

    const menuRepository = dataSource.getRepository(MenuItem)

    // Find Profile menu item
    const profileItem = await menuRepository.findOne({
      where: { label: 'Profile', path: '/profile' },
    })

    if (!profileItem) {
      console.log('Profile menu item not found')
      await dataSource.destroy()
      return
    }

    console.log(`Found Profile menu item: ${profileItem.id}, order: ${profileItem.order}`)

    // Delete all menu items with order > Profile's order
    const itemsToDelete = await menuRepository.find({
      where: {},
    })

    const itemsAfterProfile = itemsToDelete.filter(
      (item) => item.order > profileItem.order || (item.order === profileItem.order && item.id !== profileItem.id && item.createdAt > profileItem.createdAt)
    )

    if (itemsAfterProfile.length === 0) {
      console.log('No menu items found after Profile')
      await dataSource.destroy()
      return
    }

    console.log(`Found ${itemsAfterProfile.length} menu items to delete:`)
    itemsAfterProfile.forEach((item) => {
      console.log(`  - ${item.label} (order: ${item.order}, path: ${item.path})`)
    })

    // Delete the items
    for (const item of itemsAfterProfile) {
      // First, set parent to null for any children
      await menuRepository.update({ parent: { id: item.id } }, { parent: null } as any)
      // Then delete the item
      await menuRepository.delete(item.id)
      console.log(`Deleted: ${item.label}`)
    }

    console.log(`Successfully deleted ${itemsAfterProfile.length} menu items`)
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await dataSource.destroy()
  }
}

deleteMenuItemsAfterProfile()
