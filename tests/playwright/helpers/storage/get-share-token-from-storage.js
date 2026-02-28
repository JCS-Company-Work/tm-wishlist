// helpers/get-share-token-from-storage.js
// Playwright helper for retrieving the share token from local storage

/**
 * Retrieves the share token from local storage.
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<string|null>} - The share token or null if not found
 */
export async function getShareTokenFromStorage(page) {

    return await page.waitForFunction(() => localStorage.getItem('tm_wishlist_share_token'), null, { timeout: 2000 }).then(fn => fn.jsonValue());

}