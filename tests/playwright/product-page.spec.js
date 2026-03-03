import { test, expect } from '@playwright/test';
import { clearTestState } from './helpers/test/clear-state.js';
import { clickButton } from './helpers/buttons/click-button.js';
import { assertRemoveFromWishlistVisible } from './helpers/buttons/assert-remove-from-wishlist-visible.js';
import { waitForConfigsInStorage } from './helpers/storage/wait-for-configs-in-storage.js';

test('User with only one wishlist visits the wishlist page: shows empty message', async ({ page }) => {

    // Go to the wishlist page
    await page.goto('https://tm-store-jan-26.local/wishlist');

    // Clear test state before starting
    await clearTestState(page);

    // Text to match on page for empty wishlist message
    const emptyMessage = page.locator('text=Your wishlist is empty. To start, view our products pages.');
    
    // Wait for text to be visible on the page
    await expect(emptyMessage).toBeVisible();

});

test('Check add/remove button state change on click from product page', async ({ page }) => {

    // Go to a product page
    await page.goto('https://tm-store-jan-26.local/product/tavolo-mezzaluna-colonna/?colour=Laurent%20Golden&base=Yamuna&veneer=Brushed%20Inox');
    
    // Clear test state before starting
    await clearTestState(page);

    // Clear local storage to ensure the user has no existing wishlist data
    await page.evaluate(() => localStorage.clear());

    // Click the "Add to wishlist" button
    const addButton = await clickButton(page, 'Add to wishlist');

    // Wait until wishlist configs are properly saved in local storage
    await waitForConfigsInStorage(page);

    // Wait for and assert the new button state
    const removeButton = await assertRemoveFromWishlistVisible(page);

    // Wait for button
    await removeButton.waitFor({ state: 'visible' });

    // Click the "Remove from wishlist" button
    await removeButton.click();

    // Wait for and assert the button state has changed back to "Add to wishlist"
    await addButton.waitFor({ state: 'visible' });
    await expect(addButton).toHaveText('Add to wishlist');

});

test('Check add/remove button state on page load with existing wishlist item', async ({ page }) => {

    // Go to a product page
    await page.goto('https://tm-store-jan-26.local/product/tavolo-mezzaluna-colonna/?colour=Laurent%20Golden&base=Yamuna&veneer=Brushed%20Inox');

    // Clear test state before starting
    await clearTestState(page);

    // Click the "Add to wishlist" button
    await clickButton(page, 'Add to wishlist');

    // Wait until wishlist configs are properly saved in local storage
    await waitForConfigsInStorage(page);

    // Wait for and assert the new button state
    await assertRemoveFromWishlistVisible(page);

    // Reload the page
    await page.reload();

    // Assert that the "Remove from wishlist" button is still visible after page reload
    await assertRemoveFromWishlistVisible(page);

});

test('User adds an item to their only wishlist from fresh, no user token or share token present', async ({ page }) => {

    // Go to a product page
    await page.goto('https://tm-store-jan-26.local/product/tavolo-mezzaluna-colonna/?colour=Laurent%20Golden&base=Yamuna&veneer=Brushed%20Inox');

    // Clear test state before starting
    await clearTestState(page);

    // Click the "Add to wishlist" button
    await clickButton(page, 'Add to wishlist');

    // Wait until wishlist configs are properly saved in local storage
    await waitForConfigsInStorage(page);

    // Wait for and assert the new button state
    const removeButton = await assertRemoveFromWishlistVisible(page);

    // Wait for button
    await removeButton.waitFor({ state: 'visible' });

    // Assert the button text has updated to "Remove from wishlist"
    await expect(removeButton).toHaveText('Remove from wishlist');

    // Wait for the user token cookie to be set
    await page.waitForFunction(() => document.cookie.includes('tm_wishlist_user_token'));

    // Get the user token from cookies
    const userToken = await page.evaluate(() => document.cookie.includes('tm_wishlist_user_token'));

    // Assert that the user token is present
    expect(userToken).toBe(true);

    // Wait for the share token to be set in local storage
    await page.waitForFunction(() => localStorage.getItem('tm_wishlist_share_token') !== null);

    // Get the share token from local storage
    const shareToken = await page.evaluate(() => localStorage.getItem('tm_wishlist_share_token'));

    // Assert that the share token is present
    expect(shareToken).not.toBeNull();
    
    // Verify that the wishlist configuration is stored in local storage
    const configs = await page.evaluate(() => localStorage.getItem('tm_wishlist_configs'));

    // Assert that the configs are present in local storage
    expect(configs).not.toBeNull();

});

test ('Test token recovery if cookies/share token missing', async ({ page }) => {
    
    // Helper to log user token
    async function logUserToken(step) {
        const userToken = await page.evaluate(() => {
            const match = document.cookie.match(/tm_wishlist_user_token=([^;]+)/);
            return match ? match[1] : null;
        });
        //console.log(`${step} user token:`, userToken);
    }

    // Go to a product page
    await page.goto('https://tm-store-jan-26.local/product/tavolo-mezzaluna-colonna/?colour=Laurent%20Golden&base=Yamuna&veneer=Brushed%20Inox');

    // Clear test state before starting
    await clearTestState(page);

    // Click the "Add to wishlist" button
    await clickButton(page, 'Add to wishlist');

    // Wait for configs to be present before asserting button
    await waitForConfigsInStorage(page);

    // Log the user token after adding to wishlist
    await logUserToken('Initial');

    // Wait for and assert the new button state
    const removeButton = await assertRemoveFromWishlistVisible(page);
    await removeButton.waitFor({ state: 'visible' });
    await expect(removeButton).toHaveText('Remove from wishlist');

    await logUserToken('After add to wishlist');

    // Remove only the user token cookie (simulate missing user token, but keep configs and share token)
    await page.evaluate(() => {
        document.cookie = 'tm_wishlist_user_token=;expires=' + new Date(0).toUTCString() + ';path=/';
    });
    await page.reload();

    await logUserToken('After removing cookie');

    // Assert that the "Remove from wishlist" button is still visible (recovered from configs)
    await assertRemoveFromWishlistVisible(page);

    // Check that user token is regenerated
    let userToken = await page.evaluate(() => {
        const match = document.cookie.match(/tm_wishlist_user_token=([^;]+)/);
        return match ? match[1] : null;
    });
    expect(userToken).not.toBeNull();

    await logUserToken('After recovery from configs');

    // Now remove user token cookie and wishlist configs (simulate missing user token and configs, but share token remains)
    await page.evaluate(() => {
            document.cookie = 'tm_wishlist_user_token=;expires=' + new Date(0).toUTCString() + ';path=/';
            localStorage.removeItem('tm_wishlist_configs');
    });
    await page.reload();

    await logUserToken('After removing cookie and configs');

    // Assert that the "Remove from wishlist" button is still visible (recovered from share token)
    await assertRemoveFromWishlistVisible(page);
    // Check that user token is regenerated
    userToken = await page.evaluate(() => {
        const match = document.cookie.match(/tm_wishlist_user_token=([^;]+)/);
        return match ? match[1] : null;
    });
    expect(userToken).not.toBeNull();

    await logUserToken('After recovery from share token');

    // Now remove user token cookie, configs, and share token (simulate all missing)
    await page.evaluate(() => {
            document.cookie = 'tm_wishlist_user_token=;expires=' + new Date(0).toUTCString() + ';path=/';
            localStorage.removeItem('tm_wishlist_configs');
            localStorage.removeItem('tm_wishlist_share_token');
    });
    await page.reload();

    await logUserToken('After removing everything');

    // Assert that the "Add to wishlist" button is visible again (no recovery possible)
    const addButton = page.getByRole('button', { name: 'Add to wishlist' });
    await addButton.waitFor({ state: 'visible' });
    await expect(addButton).toHaveText('Add to wishlist');
    // Check that user token is not regenerated
    userToken = await page.evaluate(() => {
        const match = document.cookie.match(/tm_wishlist_user_token=([^;]+)/);
        return match ? match[1] : null;
    });
    expect(userToken).toBeNull();

});