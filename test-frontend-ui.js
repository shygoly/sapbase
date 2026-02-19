/**
 * Frontend UI Test using Playwright
 * Tests login page user selector and form auto-fill
 */

const { chromium } = require('playwright');

async function testFrontendUI() {
  console.log('🚀 Starting Frontend UI Tests\n');
  console.log('='.repeat(50));
  
  let browser;
  try {
    // Launch browser
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Navigate to login page
    console.log('\n📄 Navigating to login page...');
    await page.goto('http://localhost:3050/login');
    await page.waitForLoadState('networkidle');
    
    // Check if page loaded
    const title = await page.title();
    console.log(`✅ Page loaded: ${title}`);
    
    // Check for user selector
    console.log('\n🔍 Checking user selector...');
    const userSelector = await page.locator('#user-select').isVisible();
    if (userSelector) {
      console.log('✅ User selector found');
    } else {
      console.log('❌ User selector not found');
    }
    
    // Check default values
    console.log('\n🔍 Checking default form values...');
    const emailValue = await page.locator('#email').inputValue();
    const passwordValue = await page.locator('#password').inputValue();
    console.log(`   Email: ${emailValue}`);
    console.log(`   Password: ${passwordValue ? '***' : '(empty)'}`);
    
    if (emailValue === 'admin@example.com' && passwordValue === '123456') {
      console.log('✅ Default values are correct');
    } else {
      console.log('❌ Default values are incorrect');
    }
    
    // Test user selection
    console.log('\n🔍 Testing user selection...');
    await page.click('#user-select');
    await page.waitForTimeout(500);
    
    // Select sales user
    const salesOption = page.locator('text=Sales User');
    if (await salesOption.isVisible()) {
      await salesOption.click();
      await page.waitForTimeout(500);
      
      const newEmail = await page.locator('#email').inputValue();
      const newPassword = await page.locator('#password').inputValue();
      console.log(`   After selecting Sales User:`);
      console.log(`   Email: ${newEmail}`);
      console.log(`   Password: ${newPassword ? '***' : '(empty)'}`);
      
      if (newEmail === 'sales@example.com' && newPassword === '123456') {
        console.log('✅ User selection auto-fill works correctly');
      } else {
        console.log('❌ User selection auto-fill failed');
      }
    } else {
      console.log('❌ Sales User option not found');
    }
    
    // Test login
    console.log('\n🔍 Testing login...');
    // Select admin user again
    await page.click('#user-select');
    await page.waitForTimeout(500);
    await page.locator('text=Admin User').click();
    await page.waitForTimeout(500);
    
    // Click login button
    const loginButton = page.locator('button[type="submit"]');
    await loginButton.click();
    
    // Wait for navigation or error
    try {
      await page.waitForURL('**/admin/users', { timeout: 5000 });
      console.log('✅ Login successful, redirected to /admin/users');
    } catch (e) {
      // Check for error message
      const errorMsg = await page.locator('text=/error|failed/i').first().isVisible({ timeout: 2000 }).catch(() => false);
      if (errorMsg) {
        console.log('❌ Login failed with error');
      } else {
        console.log('⚠️  Login status unclear (check manually)');
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('\n✅ Frontend UI tests completed');
    
  } catch (error) {
    console.error('\n❌ Test error:', error.message);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

testFrontendUI().catch(console.error);
