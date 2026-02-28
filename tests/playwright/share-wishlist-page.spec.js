import { test, expect } from '@playwright/test';
import { addProductToWishlist } from './helpers/product/add-product-to-wishlist.js';
import { assertRemoveFromWishlistVisible } from './helpers/buttons/assert-remove-from-wishlist-visible.js';
import { getShareTokenFromStorage } from './helpers/storage/get-share-token-from-storage.js';
import { clickButton } from './helpers/buttons/click-button.js';
import { captureApiResponse } from './helpers/api/capture-api-response.js';

test('User creates new wish list from wishlist/share page', async ({ page, baseURL }) => {

    // Go to the product page
    await page.goto(`${baseURL}/product/tavolo-mezzaluna-colonna/`);

    // Use the helper to add a product to the wishlist and generate a share token
    await addProductToWishlist(page, { baseURL });

    // Wait for and assert the new button state
    await assertRemoveFromWishlistVisible(page);

    // Wait for the share token to appear in localStorage (timeout after 2s)
    const shareToken = await getShareTokenFromStorage(page);
    console.log('Share token from local storage:', shareToken);
    if (!shareToken) {
        console.log('No share token found in local storage');
        return;
    }

    // Go to the wishlist page for this share token
    await page.goto(`${baseURL}/wishlist/share/${shareToken}`);

    // Extract list name from page
    const listName = await page.locator('.tm-compare-list-name').innerText();

    // If list name begins with "My Wishlist" (the default name for new wishlists) extract the number after tha hash key
    let wishlistNumber = null;
    if (listName.startsWith('My Wishlist')) {
        const match = listName.match(/#(\d+)/);
        if (match) {
            wishlistNumber = parseInt(match[1], 10);
        }
    }

    // Find and click the "Create new wishlist" button
    const createButton = page.getByRole('button', { name: 'Create new list' });

    // Wait for and click the create new wishlist button
    await createButton.waitFor({ state: 'visible' });
    await createButton.click();

    // Wait for page redirect to /wishlist
    await page.waitForURL('https://tm-store-jan-26.local/wishlist/');

    // Assert that the URL is now the wishlist page
    expect(page.url()).toBe('https://tm-store-jan-26.local/wishlist/');

    // Assert that the new wishlist has been created with the correct incremented number in the name
    // new list is always at the top of the list, so get the first list name on the page
    const newListName = await page.locator('.tm-compare-list-name').first().innerText();
    if (wishlistNumber !== null) {
        expect(newListName).toBe(`My Wishlist #${wishlistNumber + 1}`);
    } else {
        // If we couldn't extract a number from the original list name, just check that a new list with the default name has been created
        expect(newListName).toBe('My Wishlist');
    }

});


test('User deletes only wish list from wishlist/share page', async ({ page, baseURL }) => {

    // Add a product to the wishlist and generate a share token
    await addProductToWishlist(page, { baseURL });

    // Wait for and assert the new button state
    await assertRemoveFromWishlistVisible(page);

    // Assert the share token is set in localStorage
    const shareToken = await getShareTokenFromStorage(page);
    expect(shareToken).not.toBeNull();

    // Navigate to the wishlist page for this share token
    await page.goto(`${baseURL}/wishlist/share/${shareToken}`);

    // Delete the wishlist by clicking the delete list (all) button
    await clickButton(page, 'Delete List (ALL)');

    // Listen for the delete API response, capture and assert the response body
    const responseBody = await captureApiResponse(page, '/wp-json/tm-wishlist/v1/lists/', 'DELETE');

    // Check that data is null in the response which indicates the list was deleted
    expect(responseBody.data).toBeNull();

    // Wait for the compare list wrapper to be removed from the page
    await expect(page.locator('.tm-compare-list-wrapper')).toHaveCount(0);

    // Check entry content, should only contain "Your wishlist is empty. To start, view our products pages."
    const emptyMessage = await page.locator('.entry-content').innerText();
    expect(emptyMessage).toBe('Your wishlist is empty. To start, view our products pages.');

});