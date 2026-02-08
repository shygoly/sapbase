import { test, expect } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'
const API_URL = 'http://localhost:3001/api'

// Helper function to login
async function loginAs(page, email: string, password: string = 'password123') {
  await page.goto(`${BASE_URL}/login`)
  await page.fill('[name="email"]', email)
  await page.fill('[name="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL(`${BASE_URL}/dashboard`)
}

test.describe('Authentication Flow', () => {
  test('should login with valid credentials', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)
    await page.fill('[name="email"]', 'admin@test.com')
    await page.fill('[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(`${BASE_URL}/dashboard`)
  })

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)
    await page.fill('[name="email"]', 'admin@test.com')
    await page.fill('[name="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')
    await expect(page.locator('.error-message, [role="alert"]')).toBeVisible()
  })

  test('should logout successfully', async ({ page }) => {
    await loginAs(page, 'admin@test.com')
    await page.click('[data-testid="logout-button"], button:has-text("Logout")')
    await expect(page).toHaveURL(`${BASE_URL}/login`)
  })

  test('should redirect to login when accessing protected page', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/users`)
    await expect(page).toHaveURL(`${BASE_URL}/login`)
  })

  test('should persist session after page reload', async ({ page }) => {
    await loginAs(page, 'admin@test.com')
    const currentUrl = page.url()
    await page.reload()
    await expect(page).not.toHaveURL(`${BASE_URL}/login`)
  })

  test('should validate email format', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)
    await page.fill('[name="email"]', 'invalid-email')
    await page.fill('[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    // Should show validation error or prevent submission
    await expect(page).toHaveURL(`${BASE_URL}/login`)
  })

  test('should validate required fields', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)
    await page.click('button[type="submit"]')
    // Should show validation errors
    await expect(page.locator('[role="alert"], .error-message')).toBeVisible()
  })

  test('should disable submit button during loading', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)
    await page.fill('[name="email"]', 'admin@test.com')
    await page.fill('[name="password"]', 'password123')

    // Intercept the request to delay it
    await page.route(`${API_URL}/auth/login`, route => {
      setTimeout(() => route.continue(), 1000)
    })

    const submitButton = page.locator('button[type="submit"]')
    await submitButton.click()
    await expect(submitButton).toBeDisabled()
  })
})

test.describe('Permission Enforcement', () => {
  test('super_admin should see all admin pages', async ({ page }) => {
    await loginAs(page, 'super@test.com')
    await page.goto(`${BASE_URL}/admin`)

    await expect(page.locator('[href*="/admin/users"]')).toBeVisible()
    await expect(page.locator('[href*="/admin/departments"]')).toBeVisible()
    await expect(page.locator('[href*="/admin/roles"]')).toBeVisible()
  })

  test('user without permissions should not see admin menu', async ({ page }) => {
    await loginAs(page, 'user@test.com')
    await page.goto(`${BASE_URL}/dashboard`)

    // Admin menu items should not be visible
    const adminLinks = page.locator('[href*="/admin"]')
    const count = await adminLinks.count()
    expect(count).toBe(0)
  })

  test('should hide create button without create permission', async ({ page }) => {
    await loginAs(page, 'viewer@test.com')
    await page.goto(`${BASE_URL}/admin/users`)

    const createButton = page.locator('button:has-text("Create User"), button:has-text("Create")')
    await expect(createButton).not.toBeVisible()
  })

  test('should hide edit/delete buttons without permissions', async ({ page }) => {
    await loginAs(page, 'viewer@test.com')
    await page.goto(`${BASE_URL}/admin/users`)

    await expect(page.locator('[data-action="edit"]')).not.toBeVisible()
    await expect(page.locator('[data-action="delete"]')).not.toBeVisible()
  })

  test('should show create button with create permission', async ({ page }) => {
    await loginAs(page, 'admin@test.com')
    await page.goto(`${BASE_URL}/admin/users`)

    const createButton = page.locator('button:has-text("Create User"), button:has-text("Create")')
    await expect(createButton).toBeVisible()
  })
})

test.describe('Data Scope Enforcement', () => {
  test('organization scope should only show org users', async ({ page }) => {
    await loginAs(page, 'org-admin@test.com')
    await page.goto(`${BASE_URL}/admin/users`)

    // Get all visible user rows
    const userRows = page.locator('[data-testid="user-row"]')
    const count = await userRows.count()

    // Verify users are from same organization
    for (let i = 0; i < count; i++) {
      const row = userRows.nth(i)
      const orgCell = row.locator('[data-field="organization"]')
      await expect(orgCell).toContainText('Test Organization')
    }
  })

  test('department scope should only show dept users', async ({ page }) => {
    await loginAs(page, 'dept-manager@test.com')
    await page.goto(`${BASE_URL}/admin/users`)

    const userRows = page.locator('[data-testid="user-row"]')
    const count = await userRows.count()

    for (let i = 0; i < count; i++) {
      const row = userRows.nth(i)
      const deptCell = row.locator('[data-field="department"]')
      await expect(deptCell).toContainText('Engineering')
    }
  })

  test('self scope should only show own profile', async ({ page }) => {
    await loginAs(page, 'user@test.com')
    await page.goto(`${BASE_URL}/admin/users`)

    const userRows = page.locator('[data-testid="user-row"]')
    const count = await userRows.count()
    expect(count).toBe(1)

    const emailCell = userRows.first().locator('[data-field="email"]')
    await expect(emailCell).toContainText('user@test.com')
  })
})

test.describe('Complete Admin Workflow', () => {
  test('should create department, role, and user', async ({ page }) => {
    await loginAs(page, 'super@test.com')

    // Create department
    await page.goto(`${BASE_URL}/admin/departments`)
    await page.click('button:has-text("Create Department")')
    await page.fill('[name="name"]', 'Engineering')
    await page.fill('[name="description"]', 'Engineering Department')
    await page.click('button[type="submit"]')
    await expect(page.locator('text=Engineering')).toBeVisible()

    // Create role
    await page.goto(`${BASE_URL}/admin/roles`)
    await page.click('button:has-text("Create Role")')
    await page.fill('[name="name"]', 'Developer')
    await page.fill('[name="description"]', 'Developer Role')
    await page.check('[name="permissions"][value="users.view"]')
    await page.check('[name="permissions"][value="users.create"]')
    await page.click('button[type="submit"]')
    await expect(page.locator('text=Developer')).toBeVisible()

    // Create user
    await page.goto(`${BASE_URL}/admin/users`)
    await page.click('button:has-text("Create User")')
    await page.fill('[name="name"]', 'John Doe')
    await page.fill('[name="email"]', 'john@test.com')
    await page.selectOption('[name="role"]', 'Developer')
    await page.selectOption('[name="department"]', 'Engineering')
    await page.click('button[type="submit"]')
    await expect(page.locator('text=John Doe')).toBeVisible()
  })

  test('should edit user and verify changes', async ({ page }) => {
    await loginAs(page, 'super@test.com')
    await page.goto(`${BASE_URL}/admin/users`)

    // Find and click edit button for John Doe
    const row = page.locator('[data-testid="user-row"]:has-text("John Doe")')
    await row.locator('[data-action="edit"]').click()

    await page.fill('[name="name"]', 'John Smith')
    await page.click('button[type="submit"]')

    await expect(page.locator('text=John Smith')).toBeVisible()
  })

  test('should delete user with confirmation', async ({ page }) => {
    await loginAs(page, 'super@test.com')
    await page.goto(`${BASE_URL}/admin/users`)

    // Find and click delete button for John Smith
    const row = page.locator('[data-testid="user-row"]:has-text("John Smith")')
    await row.locator('[data-action="delete"]').click()

    // Confirm deletion
    await page.click('button:has-text("Confirm"), button:has-text("Delete")')

    await expect(page.locator('text=John Smith')).not.toBeVisible()
  })
})
