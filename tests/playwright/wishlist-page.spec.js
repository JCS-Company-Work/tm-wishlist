import { test, expect } from '@playwright/test';
import { addProductToWishlist } from './helpers/product/add-product-to-wishlist.js';
import { assertRemoveFromWishlistVisible } from './helpers/buttons/assert-remove-from-wishlist-visible.js';
import { waitForConfigsInStorage } from './helpers/storage/wait-for-configs-in-storage.js';
import { getShareTokenFromStorage } from './helpers/storage/get-share-token-from-storage.js';
import { getProductConfigsFromStorage } from './helpers/storage/get-product-configs-from-storage.js';
import { clickButton } from './helpers/buttons/click-button.js';
import { captureApiResponse } from './helpers/api/capture-api-response.js';

test('User creates new list from wishlist page', async ({ page, baseURL }) => {
    
    // Add a product to the wishlist and generate a share token
    await addProductToWishlist(page, { baseURL, productUrl: '/product/tavolo-mezzaluna-colonna/?colour=Laurent%20Golden&base=Yamuna&veneer=Brushed%20Inox' });

    // Wait for configs to be present before asserting button
    await waitForConfigsInStorage(page);

    // Wait for and assert the new button state
    await assertRemoveFromWishlistVisible(page);

    // Assert the wishlist configs are set in localStorage so that edit button is visible on the wishlist page
    await getProductConfigsFromStorage(page);

    // Assert the share token is set in localStorage
    const shareToken = await getShareTokenFromStorage(page);
    expect(shareToken).not.toBeNull();

    // Navigate to the wishlist page for this share token
    await page.goto(`${baseURL}/wishlist/share/${shareToken}`);

    // Click Manage Lists button to open the list management interface on the wishlist page
    await clickButton(page, 'Manage Lists');

    // Click the "Create New List" button
    await clickButton(page, 'Create New List');

    // Wait for the number of lists to increase to 2
    await expect(page.locator('.tm-compare-list-wrapper')).toHaveCount(2);

    // Get all list wrapper elements as ElementHandles
    const listElements = await page.$$('.tm-compare-list-wrapper');

    // Get all h3 elements within tm-compare-list-wrapper and extract their text
    const headingElements = await page.$$('.tm-compare-list-wrapper h3');
    const headingTexts = await Promise.all(headingElements.map(async h => (await h.innerText()).trim()));

    // Check uniqueness
    const uniqueHeadings = new Set(headingTexts);
    expect(uniqueHeadings.size).toBe(headingTexts.length);
    expect(uniqueHeadings.size).toBeGreaterThan(1);

    // Save new list element to variable for further assertions
    const newList = page.locator('.tm-compare-list-wrapper').first();

    // Assert that the new list has been added to the DOM
    await expect(newList).toBeVisible();

    // Assert that the new list has a unique share token in its data attribute
    const newListShareToken = await newList.getAttribute('data-share-token');
    expect(newListShareToken).not.toBeNull();
    expect(newListShareToken).not.toBe('');

    // Assert that toggle control are visible for the new list
    const toggleControls = newList.locator('.list-controls');
    await expect(toggleControls).toBeVisible();

    // Assert that control buttons are visible for the new list
    const controlButtons = newList.locator('.list-control-buttons');
    await expect(controlButtons).toBeVisible();

    // Assert that the new list contains the empty message
    const listWrappers = page.locator('.tm-compare-list-wrapper');

    // Find numbers of list wrappers in DOM
    const count = await listWrappers.count();
    
    // Flag to track if empty message is found
    let foundEmpty = false;

    // Loop through list wrappers and check for empty message
    for (let i = 0; i < count; i++) {
    
        // Get the text content of the current list wrapper
        const text = await listWrappers.nth(i).locator('.tm-compare-list').innerText();

        // Check if the text content matches the empty message
        if (text.trim() === 'Your wishlist is empty. To start, view our products pages.') {
            foundEmpty = true;
            break;
        }
    }

    // Assert that the empty message was found in at least one list wrapper
    expect(foundEmpty).toBe(true);

});

test('User renames their only wishlist from the wishlist page', async ({ page, baseURL }) => {

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

    // Click Manage Lists button to open the list management interface on the wishlist page
    await clickButton(page, 'Manage Lists');

    // Click the "Edit list name" button to enable the wishlist name input
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

    // Wait for configs to be present before asserting button
    await waitForConfigsInStorage(page);

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

test('User deletes single list for me from /wishlist page', async ({ page, baseURL }) => {

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

    // Delete the wishlist by clicking the delete list (me) button
    await clickButton(page, 'Delete List (ME)');

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

test('User deletes single list for me from /wishlist page with multiple lists present', async ({ page, baseURL }) => {

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
    const newList = page.locator('.tm-compare-list-wrapper').first();

    // Assert that the new list has been added to the DOM
    await expect(newList).toBeVisible();

    // Delete the wishlist by clicking the delete list (me) button
    await clickButton(newList, 'Delete List (ME)');

    // Listen for the delete API response, capture and assert the response body
    const responseBody = await captureApiResponse(page, '/wp-json/tm-wishlist/v1/lists/', 'DELETE');

    // Check that data is null in the response which indicates the list was deleted
    expect(responseBody.data).toBeNull();

    // Wait for one compare list wrapper to be removed from the page, should be 1 remaining
    await expect(page.locator('.tm-compare-list-wrapper')).toHaveCount(1);

});

test('User updates active list via wishlist controls', async ({ page, baseURL }) => {

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
    const newList = page.locator('.tm-compare-list-wrapper').first();

    // Assert that the new list has been added to the DOM
    await expect(newList).toBeVisible();

    // Click the "Activate" button on the new list to switch active list
    await newList.click('.list-active');

    // Wait for the active class to be applied to the new list wrapper
    await expect(newList).toHaveClass(/active/);

    // Wait for the 'selected' class to be applied to the .list-active element inside the new list
    const activeIcon = newList.locator('.list-active');
    await expect(activeIcon).toHaveClass(/selected/);

});

test('Share button contains correct url with share token from list wrapper', async ({ page, baseURL }) => {

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
    const newList = page.locator('.tm-compare-list-wrapper').first();

    // Assert that the new list has been added to the DOM
    await expect(newList).toBeVisible();

    // Get the share token from the new list's data attribute
    const newListShareToken = await newList.getAttribute('data-share-token');
    expect(newListShareToken).not.toBeNull();
    expect(newListShareToken).not.toBe('');

    // Assert that the share button for the new list contains the correct share token in its data-url attribute
    const shareBtn = newList.getByRole('button', { name: 'Share Wishlist' });
    await expect(shareBtn).toBeVisible();

    // Get data-url attribute from the share button and assert it contains the correct share token
    const dataUrl = await shareBtn.getAttribute('data-url');
    expect(dataUrl).toContain(`/wishlist/share/${newListShareToken}/`);

});

test('Multiple list can be opened on the wishlist page and contain correct data', async ({ page, baseURL }) => {

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
    const newList = page.locator('.tm-compare-list-wrapper').first();

    // Assert that the new list has been added to the DOM
    await expect(newList).toBeVisible();

    // Assert that both lists can be opened and contain correct data
    // Open the new list and assert it contains the empty message
    await expect(newList.locator('.tm-compare-list')).toHaveText('Your wishlist is empty. To start, view our products pages.');

    // Open the second list and assert it contains the product we added to the wishlist
    const secondList = page.locator('.tm-compare-list-wrapper').nth(1);

    // Get the toggle element within the second list wrapper
    const toggle = secondList.locator('.list-toggle');
    
    // Get the class attribute of the toggle element
    const toggleClasses = await toggle.getAttribute('class');
    
    // If the toggle does not have the 'active' class, click it to open the list
    if (!toggleClasses.includes('active')) {
        await toggle.click();
    }

    // Assert the product is visible in the list
    await expect(secondList.locator('.tm-compare-list')).toContainText('Tavolo Mezzaluna Colonna');
   
});

test ('Empty message only shown when list is opened and empty', async ({ page, baseURL }) => {
    
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
    const newList = page.locator('.tm-compare-list-wrapper').first();

    // Assert that the new list has been added to the DOM
    await expect(newList).toBeVisible();

    // Assert that the empty message is visible as list is open by default on creation
    const emptyMessage = newList.locator('text=Your wishlist is empty. To start, view our products pages.');
    await expect(emptyMessage).toBeVisible();

    // Click the toggle to close the list
    const toggle = newList.locator('.list-toggle');
    await toggle.click();

    // Assert that toggle doees not contain active class
    await expect(toggle).not.toHaveClass(/active/);

    // Assert that the list has max-height of 0 when closed to ensure it is fully hidden and not just visually hidden
    const parentMaxHeight = await newList.evaluate(el => window.getComputedStyle(el).maxHeight);
    expect(parentMaxHeight).toBe('none');

    // Click the toggle to open the list again
    await toggle.click();

    // Assert that the empty message is visible when the list is opened and empty
    await expect(emptyMessage).toBeVisible();

});

test ('User deletes only item from wishlist on multi list page', async ({ page, baseURL }) => {

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

    // Target first list element which contains the product we added to the wishlist
    const listWithProduct = page.locator('.tm-compare-list-wrapper').nth(listElements.length - 1);

    // Assert that the new list has been added to the DOM
    await expect(listWithProduct).toBeVisible();
    
    // Prepare to capture the POST /lists response before clicking remove
    const apiPromise = captureApiResponse(page, '/wp-json/tm-wishlist/v1/lists', 'POST');

    // Click the "Remove from wishlist" span (remove-from-compare)
    const removeButton = listWithProduct.locator('span.remove-from-compare');
    await expect(removeButton).toBeVisible();
    await removeButton.click();

    // Wait for and capture the API response
    const responseBody = await apiPromise;
    
    // Check that data is an empty array which indicates the item was removed and the list is now empty
    expect(responseBody.data).toEqual([]);

    // Wait for the empty message to be visible on the page
    const emptyMessage = await listWithProduct.locator('text=Your wishlist is empty. To start, view our products pages.').innerText();
    expect(emptyMessage).toBe('Your wishlist is empty. To start, view our products pages.');

});