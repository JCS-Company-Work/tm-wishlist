// helpers/get-product-configs-from-storage.js
// Playwright helper for getting product configs from localStorage

import { expect } from '@playwright/test';

export async function getProductConfigsFromStorage(page) {

    // Wait for the product configs to appear in localStorage (timeout after 2s)
    const configs = await page.waitForFunction(() => localStorage.getItem('tm_wishlist_configs'), null, { timeout: 2000 }).then(fn => fn.jsonValue());

    // Assert that the configs were found and are valid JSON
    expect(configs).not.toBeNull();
    expect(() => JSON.parse(configs)).not.toThrow();

    return JSON.parse(configs);

}