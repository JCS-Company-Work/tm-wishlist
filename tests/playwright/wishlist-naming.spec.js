import { test, expect } from '@playwright/test';
import { addProductToWishlist } from './helpers/product/add-product-to-wishlist.js';
import { assertRemoveFromWishlistVisible } from './helpers/buttons/assert-remove-from-wishlist-visible.js';
import { waitForConfigsInStorage } from './helpers/storage/wait-for-configs-in-storage.js';
import { getShareTokenFromStorage } from './helpers/storage/get-share-token-from-storage.js';
import { getProductConfigsFromStorage } from './helpers/storage/get-product-configs-from-storage.js';
import { clickButton } from './helpers/buttons/click-button.js';
import { captureApiResponse } from './helpers/api/capture-api-response.js';

test('Edit wishlist name inline', async ({ page, baseURL }) => {

    // Add a product to the wishlist and generate a share token
    await addProductToWishlist(page, { baseURL, productUrl: '/product/tavolo-mezzaluna-colonna/?colour=Laurent%20Golden&base=Yamuna&veneer=Brushed%20Inox' });

    // Wait for configs to be present before asserting button
    await waitForConfigsInStorage(page);

    // Wait for and assert the new button state
    await assertRemoveFromWishlistVisible(page);

    // Assert the share token is set in localStorage
    const shareToken = await getShareTokenFromStorage(page);
    expect(shareToken).not.toBeNull();

    // Navigate to the wishlist page for this share token
    await page.goto(`${baseURL}/wishlist/share/${shareToken}`);

    // Assert that the "Manage Lists" button is visible to the owner
    const manageButton = page.getByRole('button', { name: 'Manage Lists' });

    // Click Manage Lists button to open the list management interface on the wishlist page
    await Promise.all([page.waitForNavigation(), clickButton(page, 'Manage Lists')]);

    // Assert the wishlist configs are set in localStorage so that edit button is visible on the wishlist page
    await getProductConfigsFromStorage(page);

    // Click the "Edit list name" button to enable the wishlist name input
    await clickButton(page, 'Edit list name');

    // Get the input field and change the wishlist name
    const nameInput = page.locator('#edit-list-name-input');
    await nameInput.fill('My New Wishlist Name');

    // Click the "Save" button to save the new wishlist name
    await clickButton(page, 'Save');

    // Assert that the new wishlist name is displayed on the page
    const wishlistNameHeading = page.locator('h3', { hasText: 'My New Wishlist Name' });
    await expect(wishlistNameHeading).toBeVisible();

    // Assert that wishlist name stays the same after page reload
    await page.reload();
    await expect(wishlistNameHeading).toBeVisible();

});