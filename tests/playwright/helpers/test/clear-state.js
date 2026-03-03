// helpers/test/clear-state.js
// Playwright helper to clear localStorage and cookies for a clean test state

export async function clearTestState(page) {
    // Clear localStorage
    await page.evaluate(() => localStorage.clear());
    // Clear cookies
    await page.context().clearCookies();
}
