import { test, expect } from '@playwright/test';
import { addProductToWishlist } from './helpers/product/add-product-to-wishlist.js';
import { assertRemoveFromWishlistVisible } from './helpers/buttons/assert-remove-from-wishlist-visible.js';
import { getShareTokenFromStorage } from './helpers/storage/get-share-token-from-storage.js';
import { getProductConfigsFromStorage } from './helpers/storage/get-product-configs-from-storage.js';
import { clickButton } from './helpers/buttons/click-button.js';
import { captureApiResponse } from './helpers/api/capture-api-response.js';

test('User renames their only wishlist from the wishlist page', async ({ page, baseURL }) => {

    // Add a product to the wishlist and generate a share token
    await addProductToWishlist(page, { baseURL, productUrl: '/product/tavolo-mezzaluna-colonna/?colour=Laurent%20Golden&base=Yamuna&veneer=Brushed%20Inox' });

    // Wait for and assert the new button state
    await assertRemoveFromWishlistVisible(page);

    // Assert the wishlist configs are set in localStorage so that edit button is visible on the wishlist page
    await getProductConfigsFromStorage(page);

    // Go to the wishlist page
    await page.goto(`${baseURL}/wishlist/`);

    await clickButton(page, 'Edit list name');

    // Locate wishlist name input
    const nameInput = page.locator('#edit-list-name-input');

    // Wait for the name input to be visible
    await nameInput.waitFor({ state: 'visible' });

    // Fill in a new name for the wishlist
    await nameInput.fill('My Renamed Wishlist');

    // Click the "Save" button to save the new wishlist name
    const saveButton = page.getByRole('button', { name: 'Save' });
    
    // Wait for and click the save button
    await saveButton.waitFor({ state: 'visible' });
    await saveButton.click();

    // Assert that the wishlist name has been updated on the page
    const wishlistName = page.getByRole('heading', { name: 'My Renamed Wishlist' });
    await expect(wishlistName).toBeVisible();

});

test('User deletes single wish list from /wishlist page', async ({ page, baseURL }) => {

    // Add a product to the wishlist and generate a share token
    await addProductToWishlist(page, { baseURL });

    // Wait for and assert the new button state
    await assertRemoveFromWishlistVisible(page);

    // Assert the share token is set in localStorage
    const shareToken = await getShareTokenFromStorage(page);
    expect(shareToken).not.toBeNull();

    // Navigate to the /wishlist page
    await page.goto(`${baseURL}/wishlist/`);

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