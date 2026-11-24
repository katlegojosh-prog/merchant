import { test, expect } from '@playwright/test'

test('home page loads', async ({ page }) => {
  await page.goto('http://localhost:3000')
  await page.wait_for_load_state('networkidle')
  await expect(page).toHaveTitle(/THE MERCHANT/)
  
  // Check for login form or main content
  const formCount = page.locator('form').count()
  const mainContent = page.locator('.app-shell').count()
  
  console.log('Form count:', formCount)
  console.log('Main content count:', mainContent)
  
  // Take screenshot
  await page.screenshot({ path: 'playwright-test-results.png', full_page: true })
})

test('login form exists', async ({ page }) => {
  await page.goto('http://localhost:3000')
  await page.wait_for_load_state('networkidle')
  
  // Look for login form
  const loginForm = page.locator('form')
  await expect(loginForm).toBeVisible()
  
  // Check email input
  await expect(page.locator('input[type="email"]')).toBeVisible()
  await expect(page.locator('input[type="password"]')).toBeVisible()
  
  await page.screenshot({ path: 'login-form.png', full_page: true })
})
