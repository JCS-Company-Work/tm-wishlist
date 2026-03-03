// helpers/storage/wait-for-configs-in-storage.js
// Playwright helper for waiting for configs in localStorage

export async function waitForConfigsInStorage(page) {

    await page.waitForFunction(() => localStorage.getItem('tm_wishlist_configs') !== null);

}