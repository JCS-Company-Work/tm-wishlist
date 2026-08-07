import { test, expect } from '@playwright/test';
import { addProductToWishlist } from './helpers/product/add-product-to-wishlist.js';
import { assertRemoveFromWishlistVisible } from './helpers/buttons/assert-remove-from-wishlist-visible.js';
import { waitForConfigsInStorage } from './helpers/storage/wait-for-configs-in-storage.js';
import { getShareTokenFromStorage } from './helpers/storage/get-share-token-from-storage.js';
import { getProductConfigsFromStorage } from './helpers/storage/get-product-configs-from-storage.js';
import { clickButton } from './helpers/buttons/click-button.js';
import { captureApiResponse } from './helpers/api/capture-api-response.js';

async function dismissCookieBannerIfPresent(page) {
    await page.evaluate(() => {
        const banner = document.getElementById('cookie-consent-banner');
        if (banner) {
            banner.remove();
        }
    });

    const banner = page.locator('#cookie-consent-banner');
    if (await banner.isVisible().catch(() => false)) {
        const acceptAllButton = page.locator('#btn-accept-all-toggle');
        if (await acceptAllButton.isVisible().catch(() => false)) {
            await acceptAllButton.click();
        } else {
            const dismissButton = banner.locator('button').first();
            if (await dismissButton.isVisible().catch(() => false)) {
                await dismissButton.click();
            }
        }

        await banner.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
    }
}

test ('Product appears in correct list after addition', async ({ page, baseURL }) => {

    // Add a product to the wishlist and generate a share token
    await addProductToWishlist(page, { baseURL, productUrl: '/product/tavolo-mezzaluna-colonna/?colour=Laurent%20Golden&base=Yamuna&veneer=Brushed%20Inox' });

    // Wait for configs to be present before asserting button
    await waitForConfigsInStorage(page);

    // Wait for and assert the new button state
    await assertRemoveFromWishlistVisible(page);

    // Assert the share token is set in localStorage
    const shareToken = await getShareTokenFromStorage(page);
    expect(shareToken).not.toBeNull();

    // Check local storage to ensure product added to list under correct share token key
    const productConfigs = await getProductConfigsFromStorage(page);

    // Get user token from cookie to determine expected key for product configs in storage
    const userToken = await page.evaluate(() => {
        const match = document.cookie.match(new RegExp('(^| )tm_wishlist_user_token=([^;]+)'));
        return match ? match[2] : null;
    });
    expect(userToken).not.toBeNull();

    // Assert that the product configs in storage contain the expected product under the correct share token
    const expectedList = productConfigs[userToken][shareToken];

    // Find the product in the expected list that matches the attributes of the product we added
    const product = expectedList.find(
    item =>
        item.productName === 'Tavolo Mezzaluna Colonna' &&
        item.colour === 'Laurent Golden' &&
        item.base === 'Yamuna' &&
        item.veneer === 'Brushed Inox'
    );
    
    // Assert that the product was found in the expected list
    expect(product).toBeTruthy();
    
});

test('Removed product is removed from correct list', async ({ page, baseURL }) => {

    // Add a product to the wishlist and generate a share token
    await addProductToWishlist(page, { baseURL, productUrl: '/product/tavolo-mezzaluna-colonna/?colour=Laurent%20Golden&base=Yamuna&veneer=Brushed%20Inox' });

    // Wait for configs to be present before asserting button
    await waitForConfigsInStorage(page);

    // Wait for and assert the new button state
    await assertRemoveFromWishlistVisible(page);

    // Assert the share token is set in localStorage
    const shareToken = await getShareTokenFromStorage(page);
    expect(shareToken).not.toBeNull();

    // Check local storage to ensure product added to list under correct share token key
    let productConfigs = await getProductConfigsFromStorage(page);

    // Get user token from cookie to determine expected key for product configs in storage
    const userToken = await page.evaluate(() => {
        const match = document.cookie.match(new RegExp('(^| )tm_wishlist_user_token=([^;]+)'));
        return match ? match[2] : null;
    });
    expect(userToken).not.toBeNull();

    // Assert that the product configs in storage contain the expected product under the correct share token
    let expectedList = productConfigs[userToken][shareToken];

    // Find the product in the expected list that matches the attributes of the product we added
    let product = expectedList.find(
    item =>
        item.productName === 'Tavolo Mezzaluna Colonna' &&
        item.colour === 'Laurent Golden' &&
        item.base === 'Yamuna' &&
        item.veneer === 'Brushed Inox'
    );
    
    // Assert that the product was found in the expected list
    expect(product).toBeTruthy();

    // Click the "Remove from wishlist" button to remove the product from the wishlist
    await clickButton(page, 'Remove from wishlist');

    // Wait for the product configs in storage to update after removal
    await page.waitForFunction(
        (userToken, shareToken) => {
            const configs = JSON.parse(localStorage.getItem('tm_wishlist_configs'));
            return !configs[userToken][shareToken] || configs[userToken][shareToken].length === 0;
        },
        userToken,
        shareToken
    );

    // Get the updated product configs from storage
    productConfigs = await getProductConfigsFromStorage(page);

    // Get the expected list from the updated product configs
    expectedList = productConfigs[userToken][shareToken];

    // Assert that the expected list is empty or does not exist after removal
    expect(expectedList).toEqual([]) || expect(expectedList.length).toBe(0);
    
});

test('Same product with different colours can both be added @critical', async ({ page, baseURL }) => {

    // Add first configuration for the same product.
    await page.goto(`${baseURL}/product/tavolo-mezzaluna-colonna/?colour=Laurent%20Golden&base=Yamuna&veneer=Brushed%20Inox`);
    await dismissCookieBannerIfPresent(page);
    const firstAddButton = page.locator('.tm-add-to-compare').first();
    await firstAddButton.waitFor({ state: 'visible' });
    await firstAddButton.click();

    await waitForConfigsInStorage(page);
    await assertRemoveFromWishlistVisible(page);

    // Load same product with a different colour and add it as a second config.
    await page.goto(`${baseURL}/product/tavolo-mezzaluna-colonna/?colour=Laguna%20Blanca&base=Yamuna&veneer=Brushed%20Inox`);
    await dismissCookieBannerIfPresent(page);
    const secondAddButton = page.locator('.tm-add-to-compare').first();
    await secondAddButton.waitFor({ state: 'visible' });
    await secondAddButton.click();

    await page.waitForFunction(() => {
        const raw = localStorage.getItem('tm_wishlist_configs');
        if (!raw) return false;

        const userToken = document.cookie.match(new RegExp('(^| )tm_wishlist_user_token=([^;]+)'))?.[2];
        const shareToken = localStorage.getItem('tm_wishlist_share_token');
        if (!userToken || !shareToken) return false;

        const parsed = JSON.parse(raw);
        return Array.isArray(parsed?.[userToken]?.[shareToken]) && parsed[userToken][shareToken].length >= 2;
    });

    const shareToken = await getShareTokenFromStorage(page);
    expect(shareToken).not.toBeNull();

    const productConfigs = await getProductConfigsFromStorage(page);
    const userToken = await page.evaluate(() => {
        const match = document.cookie.match(new RegExp('(^| )tm_wishlist_user_token=([^;]+)'));
        return match ? match[2] : null;
    });
    expect(userToken).not.toBeNull();

    const expectedList = productConfigs[userToken][shareToken];
    expect(expectedList.length).toBeGreaterThanOrEqual(2);

    const firstVariant = expectedList.find(item => item.productName === 'Tavolo Mezzaluna Colonna' && item.colour === 'Laurent Golden');
    const secondVariant = expectedList.find(item => item.productName === 'Tavolo Mezzaluna Colonna' && item.colour === 'Laguna Blanca');

    expect(firstVariant).toBeTruthy();
    expect(secondVariant).toBeTruthy();

});

// test ('Max list items cannot exceed limit of 6', async ({ page, baseURL }) => {

//     // List of product URLs for 6 distinct configs
//     const productUrls = [
//         '/product/tavolo-mezzaluna-colonna/',
//         '/product/tavolo-mezzaluna-alveo/',
//         '/product/tavolo-piazza-alveo-solido-12/',
//         '/product/tavolo-piazza-romano-solido-20/',
//         '/product/tavolo-mezzaluna-romano-solido-12',
//         '/product/tavolo-contorno-romano-obelisco-20/',
//     ];

//     // Navigate to a product page to initialize local storage and cookies
//     await page.goto(`${baseURL}`);
    
//     // Clear localStorage before starting
//     await page.evaluate(() => localStorage.clear());

//     // Manually add 6 items via UI clicks
//     for (const url of productUrls) {
//         await page.goto(`${baseURL}${url}`);
//         await page.waitForTimeout(300); // Wait for DOM to update
//         const addButton = page.getByRole('button', { name: 'Add to wishlist' });
//         await addButton.waitFor({ state: 'visible', timeout: 5000 });
//         // Capture API response for wishlist add
//         const [response] = await Promise.all([
//             page.waitForResponse(resp => resp.url().includes('/wp-json/tm-wishlist/v1/lists') && resp.request().method() === 'POST'),
//             addButton.click()
//         ]);
//         const apiBody = await response.json();
//         // Wait for configs in storage to update after add
//         await page.waitForFunction(() => {
//             const configs = localStorage.getItem('tm_wishlist_configs');
//             return configs && configs.length > 0;
//         }, null, { timeout: 5000 });
//         // eslint-disable-next-line no-console
//         console.log('API response after add:', apiBody);

//         // Log localStorage wishlist configs after each add
//         const wishlistConfigs = await page.evaluate(() => {
//             return localStorage.getItem('tm_wishlist_configs');
//         });
//         // eslint-disable-next-line no-console
//         console.log('LocalStorage after add:', wishlistConfigs);
//     }

//     // Assert that the product configs in storage contain 6 items under the correct share token key
//     const shareToken = await getShareTokenFromStorage(page);

//     const productConfigs = await getProductConfigsFromStorage(page);

//     const userToken = await page.evaluate(() => {
//         const match = document.cookie.match(new RegExp('(^| )tm_wishlist_user_token=([^;]+)'));
//         return match ? match[2] : null;
//     });
//     expect(userToken).not.toBeNull();
    
//     // Get the expected list from the product configs
//     const expectedList = productConfigs[userToken][shareToken];
//     console.log(expectedList);
//     expect(expectedList.length).toBe(6);

//     // Attempt to add a 7th item
//     await page.goto(`${baseURL}/product/tavolo-luna-colonna-solido-12`);
//     const addButton = page.getByRole('button', { name: 'Add to wishlist' });
//     await addButton.waitFor({ state: 'visible' });
//     await addButton.click();

//     // Assert that an error message is displayed indicating the max item limit has been reached
//     await expect(errorMessage).toBeVisible();
//     await expect(errorMessage).toHaveText('You can only compare up to 6 products.');
    
// });
