/**
 * Test Login Flow and Menu Loading
 * Run with: node test-login-flow.js
 */

const http = require('http');

const API_BASE = 'http://localhost:3051';
const FRONTEND_BASE = 'http://localhost:3050';

// Test users
const TEST_USERS = [
  { email: 'admin@example.com', password: '123456', name: 'Admin User' },
  { email: 'sales@example.com', password: '123456', name: 'Sales User' },
  { email: 'manager@example.com', password: '123456', name: 'Manager User' },
  { email: 'accountant@example.com', password: '123456', name: 'Accountant User' },
];

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = http.request({
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

async function testLogin(email, password) {
  console.log(`\n🔐 Testing login for: ${email}`);
  try {
    const response = await makeRequest(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { email, password },
    });
    
    if ((response.status === 200 || response.status === 201) && response.data && response.data.code === 200) {
      const loginData = response.data.data || response.data;
      if (loginData.access_token) {
        console.log(`✅ Login successful!`);
        console.log(`   User: ${loginData.user.name}`);
        console.log(`   Role: ${loginData.user.role}`);
        console.log(`   Permissions: ${loginData.user.permissions.length} permissions`);
        return loginData.access_token;
      }
    }
    console.log(`❌ Login failed: Status ${response.status}, Response: ${JSON.stringify(response.data).substring(0, 200)}`);
    return null;
  } catch (error) {
    console.log(`❌ Login error: ${error.message}`);
    return null;
  }
}

async function testMenu(token) {
  console.log(`\n📋 Testing menu loading...`);
  try {
    const response = await makeRequest(`${API_BASE}/api/menu`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    if (response.status === 200 && response.data.data) {
      const menuItems = response.data.data;
      console.log(`✅ Menu loaded successfully!`);
      console.log(`   Total menu items: ${menuItems.length}`);
      
      // Check for CRM menu
      const crmMenu = menuItems.find(item => item.label === 'CRM Management');
      if (crmMenu) {
        console.log(`   ✅ CRM Management menu found`);
        console.log(`      Children: ${crmMenu.children?.length || 0}`);
        if (crmMenu.children) {
          crmMenu.children.forEach(child => {
            console.log(`         - ${child.label} (${child.path})`);
          });
        }
      } else {
        console.log(`   ❌ CRM Management menu not found`);
      }
      
      // Check for Dashboard
      const dashboard = menuItems.find(item => item.label === 'Dashboard');
      if (dashboard) {
        console.log(`   ✅ Dashboard menu found`);
      }
      
      return true;
    } else {
      console.log(`❌ Menu loading failed: ${JSON.stringify(response.data)}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Menu loading error: ${error.message}`);
    return false;
  }
}

async function testFrontend() {
  console.log(`\n🌐 Testing frontend accessibility...`);
  try {
    const response = await makeRequest(`${FRONTEND_BASE}/login`);
    if (response.status === 200) {
      console.log(`✅ Frontend is accessible`);
      return true;
    } else {
      console.log(`❌ Frontend returned status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Frontend error: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting Login Flow Tests\n');
  console.log('='.repeat(50));
  
  // Test frontend
  await testFrontend();
  
  // Test login for each user
  let successCount = 0;
  for (const user of TEST_USERS) {
    const token = await testLogin(user.email, user.password);
    if (token) {
      successCount++;
      await testMenu(token);
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`\n📊 Test Summary:`);
  console.log(`   Successful logins: ${successCount}/${TEST_USERS.length}`);
  console.log(`   Failed logins: ${TEST_USERS.length - successCount}/${TEST_USERS.length}`);
  
  if (successCount === TEST_USERS.length) {
    console.log(`\n✅ All tests passed!`);
    process.exit(0);
  } else {
    console.log(`\n❌ Some tests failed`);
    process.exit(1);
  }
}

runTests().catch(console.error);
