import type { PageSchema } from './types'

export class PageRegistry {
  private pages: Map<string, PageSchema> = new Map()

  register(page: PageSchema): void {
    this.pages.set(page.path, page)
  }

  get(path: string): PageSchema | undefined {
    return this.pages.get(path)
  }

  getAll(): PageSchema[] {
    return Array.from(this.pages.values())
  }

  unregister(path: string): void {
    this.pages.delete(path)
  }

  clear(): void {
    this.pages.clear()
  }
}

export const pageRegistry = new PageRegistry()
