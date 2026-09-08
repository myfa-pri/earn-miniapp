from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.goto("http://localhost:3000/setting.html?userId=test_123")
    page.wait_for_timeout(2000)

    # Go to create tab
    page.evaluate("switchTab('create')")
    page.wait_for_timeout(1000)

    # Fill format
    page.select_option("#v2Format", "banner")
    page.wait_for_timeout(500)

    # Fill inputs
    page.fill("#v2MediaUrl", "https://example.com/banner.jpg")
    page.fill("#v2Headline", "My Cool Banner")
    page.fill("#v2Desc", "This is an automated test banner.")
    page.fill("#v2Cta", "Play Now")
    page.fill("#v2TotalBudget", "500")
    page.fill("#v2DailyBudget", "50")
    page.wait_for_timeout(1000)

    page.screenshot(path="/home/jules/verification/screenshots/verification_setting.png")

    page.click("#btnCreateV2")
    page.wait_for_timeout(2000)

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos"
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
