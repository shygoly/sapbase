describe('shipping migration data source', () => {
  it('registers only shipping migrations', async () => {
    const module = await import('./shipping-data-source')
    const migrationPaths = (module.default.options.migrations ?? []) as string[]

    expect(migrationPaths.length).toBeGreaterThan(0)
    expect(migrationPaths.every((migrationPath) => migrationPath.includes('176280000'))).toBe(true)
    expect(migrationPaths.some((migrationPath) => migrationPath.includes('1762800004000'))).toBe(true)
    expect(migrationPaths.some((migrationPath) => migrationPath.includes('1762800005000'))).toBe(true)
  })
})
