import { test, expect } from '@playwright/test';
import { mockWishlistData } from './helpers/data/mock-wishlist-data.js';
import { mockWishlistDbRow } from './helpers/data/mock-wishlist-db-row.js';
import { waitForConfigsInStorage } from './helpers/storage/wait-for-configs-in-storage.js';
import { getShareTokenFromStorage } from './helpers/storage/get-share-token-from-storage.js';
import { getProductConfigsFromStorage } from './helpers/storage/get-product-configs-from-storage.js';
import { clickButton } from './helpers/buttons/click-button.js';
import { editListNameMockAPI } from './helpers/api/edit-list-name-mocked-api.js';
import { setCookies } from './helpers/data/set-cookies.js';

test('Edit wishlist name inline @critical', async ({ page, baseURL }) => {

    // Mock the API response for editing the wishlist name and for fetching the wishlist details
    await editListNameMockAPI(page, { mockWishlistDbRow });

    // Set cookie for user_token
    await setCookies(page.context(), { userToken: mockWishlistDbRow.user_token, shareToken: mockWishlistDbRow.share_token });

    // Go to homepage
    await page.goto(baseURL);

    // Set mock wishlist data in localStorage to simulate an existing wishlist with a share token
    await page.evaluate((data) => {
        localStorage.setItem('tm_wishlist_configs', JSON.stringify(data));
        localStorage.setItem('tm_wishlist_share_token', 'c81cddf6d25ad9ee38cc');
        return data;
    }, mockWishlistData);

    // Navigate to the wishlist page for this share token
    await page.goto(`${baseURL}/wishlist/share/c81cddf6d25ad9ee38cc`);

    // Click the "Edit list name" button to enable the wishlist name input
    await clickButton(page, '.edit-list-name');

    // Get the input field and change the wishlist name
    const nameInput = page.locator('#edit-list-name-input');
    await nameInput.fill('My New Wishlist Name');

    // Wait for the Save button to be visible and enabled, then click
    await clickButton(page, '.save-list-name');

    // Assert that the new wishlist name is displayed on the page
    const wishlistNameHeading = page.locator('h3', { hasText: 'My New Wishlist Name' });
    await expect(wishlistNameHeading).toBeVisible();

});

test('User edits name of active wishlist @critical', async ({ page, baseURL }) => {

    // Mock the API response for editing the wishlist name and for fetching the wishlist details
    await editListNameMockAPI(page, { mockWishlistDbRow });

    // Set cookie for user_token
    await setCookies(page.context(), { userToken: mockWishlistDbRow.user_token, shareToken: mockWishlistDbRow.share_token });

    // Go to homepage
    await page.goto(baseURL);

    // Set mock wishlist data in localStorage to simulate an existing wishlist with a share token
    await page.evaluate((data) => {
        localStorage.setItem('tm_wishlist_configs', JSON.stringify(data));
        localStorage.setItem('tm_wishlist_share_token', 'c81cddf6d25ad9ee38cc');
        return data;
    }, mockWishlistData);

    // Navigate to the wishlist page for this share token
    await page.goto(`${baseURL}/wishlist/`);
    
    // Find current active list wrapper by checking for active class
    const activeList = page.locator('.tm-compare-list-wrapper.active');

    // Assert that the active list wrapper is found and visible
    await expect(activeList).toBeVisible();

    // Click the "Edit list name" button to enable the wishlist name input
    await clickButton(activeList, '.edit-list-name');

    // Get the input field and change the wishlist name
    const nameInput = activeList.locator('#edit-list-name-input');
    await nameInput.fill('My Edited Wishlist Name');

    // Click the "Save" button to save the new wishlist name
    await clickButton(activeList, '.save-list-name');

    // Assert that the new wishlist name is displayed on the page
    const wishlistNameHeading = page.locator('.active-list-span', { hasText: 'My Edited Wishlist Name' });
    await expect(wishlistNameHeading).toBeVisible();

});

test ('User cannot save duplicate wishlist name', async ({ page, baseURL }) => {

    // Add a product to the wishlist and generate a share token
    await addProductToWishlist(page, { baseURL });

    // Wait for configs to be present before asserting button
    await waitForConfigsInStorage(page);

    // Wait for and assert the new button state
    await assertRemoveFromWishlistVisible(page);

    // Assert the share token is set in localStorage
    const shareToken = await getShareTokenFromStorage(page);
    expect(shareToken).not.toBeNull();

    // Navigate to the wishlist page for this share token
    await page.goto(`${baseURL}/wishlist/share/${shareToken}`);

    // Click Manage Lists button to open the list management interface on the wishlist page
    await clickButton(page, 'Manage Lists');

    // Click the "Create New List" button to create a second list
    await clickButton(page, 'Create New List');

    // Wait for the number of lists to increase to 2
    await expect(page.locator('.tm-compare-list-wrapper')).toHaveCount(2);

    // Get all list wrapper elements as ElementHandles
    const listElements = await page.$$('.tm-compare-list-wrapper');

    // Save new list element to variable for further assertions
    const newList = page.locator('.tm-compare-list-wrapper').nth(listElements.length - 1);

    // Assert that the new list has been added to the DOM
    await expect(newList).toBeVisible();

    // Assert the wishlist configs are set in localStorage so that edit button is visible on the wishlist page
    await getProductConfigsFromStorage(page);

    // Click the "Edit list name" button to enable the wishlist name input
    await clickButton(newList, 'Edit list name');

    // Get the input field and change the wishlist name to a duplicate name
    const nameInput = newList.locator('#edit-list-name-input');
    await nameInput.fill('My Wishlist #2');

    // Intercept the API response for saving the wishlist name
    const [response] = await Promise.all([
        page.waitForResponse(resp =>
            resp.url().includes('/tm-wishlist/v1/lists/') && resp.request().method() === 'PUT'
        ),
        clickButton(newList, 'Save')
    ]);

    // Assert the API response contains the expected error
    const json = await response.json();

    // Assert that duplicate_name error is returned under code key
    expect(json).toHaveProperty('code', 'duplicate_name');
    
    // Assert that the message indicates duplicate names are not allowed
    expect(json).toHaveProperty('message', 'List name already exists, please choose a unique name.');

});

