from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto('http://localhost:3000')
    page.wait_for_load_state('networkidle')
    
    # Check page title
    title = page.title()
    print(f"Page title: {title}")
    
    # Check for login form if not logged in
    if page.locator('form').count() > 0:
        print("Login form found")
    
    # Check for main content areas
    print(f"Page URL: {page.url}")
    print(f"Page content length: {len(page.content())}")
    
    # Take screenshot
    page.screenshot(path='/tmp/playwright-screenshot.png', full_page=True)
    print("Screenshot saved to /tmp/playwright-screenshot.png")
    
    # Check for key elements
    buttons = page.locator('button').all()
    print(f"Number of buttons: {len(buttons)}")
    
    inputs = page.locator('input').all()
    print(f"Number of inputs: {len(inputs)}")
    
    browser.close()
