/**
 * Test script for deployed nutrition coaching platform
 */

const { chromium } = require('playwright');

const BASE_URL = 'https://nutrition-coaching-platform.vercel.app';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testLogin(email, password, type, description) {
  console.log(`\n[${description}] Testing login with ${email}...`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const results = { success: false, error: null, url: null };
  
  try {
    // Capture console messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`  [Console Error]: ${msg.text()}`);
      }
    });
    
    // Navigate to main page
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(2000);
    
    console.log(`  URL: ${page.url()}`);
    
    // Click the appropriate login mode
    if (type === 'trainer') {
      console.log(`  Selecting Trainer Login...`);
      await page.locator('button:has-text("Trainer Login")').click();
      await sleep(500);
    } else {
      console.log(`  Selecting Client Login...`);
      await page.locator('button:has-text("Client Login")').click();
      await sleep(500);
    }
    
    // Fill the form using Playwright's fill which properly triggers React
    console.log(`  Filling email: ${email}`);
    await page.locator('#email').fill(email);
    
    console.log(`  Filling password...`);
    await page.locator('#password').fill(password);
    
    await sleep(500);
    
    // Submit by pressing Enter
    console.log(`  Submitting form...`);
    await page.locator('#password').press('Enter');
    
    // Wait for navigation
    await sleep(5000);
    
    const finalUrl = page.url();
    console.log(`  Final URL: ${finalUrl}`);
    results.url = finalUrl;
    
    // Check if we navigated away from the login page
    if (finalUrl !== BASE_URL + '/' && !finalUrl.includes('?login=')) {
      console.log(`  ✅ Login successful! Navigated to: ${finalUrl}`);
      results.success = true;
    } else {
      // Check for error messages on the page
      const errorLocator = page.locator('text=/error|failed|invalid|wrong/i');
      const hasError = await errorLocator.count() > 0;
      
      if (hasError) {
        const errorText = await errorLocator.first().textContent();
        console.log(`  ❌ Login failed with error: ${errorText}`);
        results.error = errorText;
      } else {
        console.log(`  ❌ Login failed - still on login page`);
        results.error = 'Still on login page after submission';
      }
    }
    
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    results.error = error.message;
  } finally {
    await browser.close();
  }
  
  return results;
}

async function main() {
  console.log('========================================');
  console.log('NUTRITION COACHING PLATFORM');
  console.log('Vercel Deployment Test');
  console.log('========================================');
  console.log(`URL: ${BASE_URL}`);
  console.log(`Time: ${new Date().toISOString()}`);

  const tests = [
    { email: 'test1@test1.com', password: 'TestPassword123!', type: 'client', description: 'Client Login (test1@test1.com)' },
    { email: 'allen@amarsbody.com', password: 'TestPassword123!', type: 'trainer', description: 'Trainer Login (allen@amarsbody.com)' },
  ];
  
  const results = [];
  
  for (const test of tests) {
    const result = await testLogin(test.email, test.password, test.type, test.description);
    results.push({ ...test, ...result });
  }
  
  console.log('\n========================================');
  console.log('RESULTS SUMMARY');
  console.log('========================================');
  
  for (const r of results) {
    console.log(`\n${r.description}:`);
    console.log(`  Email: ${r.email}`);
    console.log(`  Result: ${r.success ? '✅ PASS' : '❌ FAIL'}`);
    if (r.error) console.log(`  Error: ${r.error}`);
    if (r.url) console.log(`  URL: ${r.url}`);
  }
  
  const passedCount = results.filter(r => r.success).length;
  console.log(`\nTotal: ${passedCount}/${results.length} passed`);
  
  return results;
}

main()
  .then(results => {
    process.exit(0);
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
