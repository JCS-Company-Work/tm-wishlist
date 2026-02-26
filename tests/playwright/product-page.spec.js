import { test, expect } from '@playwright/test';

test('User with only one wishlist visits the wishlist page: shows empty message', async ({ page }) => {

    // Go to the wishlist page
    await page.goto('https://tm-store-jan-26.local/wishlist');

    // Clear local storage to ensure the user has no existing wishlist data
    await page.evaluate(() => localStorage.clear());

    // Text to match on page for empty wishlist message
    const emptyMessage = page.locator('text=Your wishlist is empty. To start, view our products pages.');
    
    // Wait for text to be visible on the page
    await expect(emptyMessage).toBeVisible();

});

test('User adds an item to their only wishlist from fresh, no user token or share token present', async ({ page }) => {

    // Go to a product page
    await page.goto('https://tm-store-jan-26.local/product/tavolo-mezzaluna-colonna/?colour=Laurent%20Golden&base=Yamuna&veneer=Brushed%20Inox');

    // Clear local storage to ensure the user has no existing wishlist data
    await page.evaluate(() => localStorage.clear());

    // Click the "Add to wishlist" button
    const addButton = page.getByRole('button', { name: 'Add to wishlist' });

    // Wait for and click the add to wishlist button
    await addButton.waitFor({ state: 'visible' });
    await addButton.click();

    // Wait for and assert the new button state
    const removeButton = page.getByRole('button', { name: 'Remove from wishlist' });

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