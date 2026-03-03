import { test, expect } from '@playwright/test';
import { addProductToWishlist } from './helpers/product/add-product-to-wishlist.js';
import { assertRemoveFromWishlistVisible } from './helpers/buttons/assert-remove-from-wishlist-visible.js';
import { getShareTokenFromStorage } from './helpers/storage/get-share-token-from-storage.js';
import { clickButton } from './helpers/buttons/click-button.js';
import { captureApiResponse } from './helpers/api/capture-api-response.js';

test('User uses wishlist links after adding item', async ({ page, baseURL }) => {
    
    // Go to the product page
    await page.goto(`${baseURL}/product/tavolo-mezzaluna-colonna/`);

    // Use the helper to add a product to the wishlist and generate a share token
    await addProductToWishlist(page, { baseURL });

    // Wait for and assert the new button state
    await assertRemoveFromWishlistVisible(page);

    // Assert the share token is set in localStorage
    const shareToken = await getShareTokenFromStorage(page);
    expect(shareToken).not.toBeNull();

    // Wait for wishlist share link to appear and log page HTML for debugging
    await page.waitForSelector('a[href^="/wishlist/share/"]', { timeout: 50000 });
    const wishlistLinks = page.locator('a[href^="/wishlist/share/"]');
    const count = await wishlistLinks.count();
    const hrefs = await wishlistLinks.evaluateAll(links => links.map(link => link.getAttribute('href')));

    // Log page HTML for debugging
    const html = await page.content();

    const linkFoundWithToken = hrefs.some(href => href && href.includes(shareToken));
    expect(linkFoundWithToken).toBe(true);

    // Click the first wishlist link found
    await wishlistLinks.first().click();

    // Assert that the URL is correct and includes the share token
    expect(page.url()).toBe(`${baseURL}/wishlist/share/${shareToken}/`);

});

test('User creates new wish list from wishlist/share page', async ({ page, baseURL }) => {

    // Go to the product page
    await page.goto(`${baseURL}/product/tavolo-mezzaluna-colonna/`);

    // Use the helper to add a product to the wishlist and generate a share token
    await addProductToWishlist(page, { baseURL });

    // Wait for and assert the new button state
    await assertRemoveFromWishlistVisible(page);

    // Assert the share token is set in localStorage
    const shareToken = await getShareTokenFromStorage(page);
    expect(shareToken).not.toBeNull();

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

    // Debug: log share token from localStorage before helper
    const rawShareToken = await page.evaluate(() => localStorage.getItem('tm_wishlist_share_token'));
    console.log('Raw share token from localStorage (delete list for me test):', rawShareToken);

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

test('User clears wishlist', async ({ page, baseURL }) => {

    // Add a product to the wishlist and generate a share token
    await addProductToWishlist(page, { baseURL });

    // Wait for configs to be present before asserting button
    await page.waitForFunction(() => localStorage.getItem('tm_wishlist_configs') !== null);

    // Wait for and assert the new button state
    await assertRemoveFromWishlistVisible(page);

    // Debug: log share token from localStorage before helper
    const rawShareToken = await page.evaluate(() => localStorage.getItem('tm_wishlist_share_token'));
    console.log('Raw share token from localStorage (clear wishlist test):', rawShareToken);

    // Assert the share token is set in localStorage
    const shareToken = await getShareTokenFromStorage(page);
    expect(shareToken).not.toBeNull();

    // Navigate to the wishlist page for this share token
    await page.goto(`${baseURL}/wishlist/share/${shareToken}`);

    // Clear the wishlist by clicking the "Clear Wishlist" button
    await clickButton(page, 'Clear Wishlist');

    // Listen for the clear API response, capture and assert the response body
    const responseBody = await captureApiResponse(page, `/wp-json/tm-wishlist/v1/lists/${shareToken}`, 'DELETE');

    // Check that data is an empty array which indicates the list was cleared
    expect(responseBody.data).toEqual([]);

    // Wait for the compare list wrapper to still be visible on the page (list is not deleted, just cleared)
    await expect(page.locator('.tm-compare-list-wrapper')).toHaveCount(1);

    // List now shows empty message
    const emptyMessage = await page.locator('.tm-compare-list.open').innerText();
    expect(emptyMessage).toBe('Your wishlist is empty. To start, view our products pages.');

});

test ('User deletes only item from wishlist', async ({ page, baseURL }) => {

    // Add a product to the wishlist and generate a share token
    await addProductToWishlist(page, { baseURL });

    // Wait for and assert the new button state
    await assertRemoveFromWishlistVisible(page);

    // Assert the share token is set in localStorage
    const shareToken = await getShareTokenFromStorage(page);
    expect(shareToken).not.toBeNull();

    // Navigate to the wishlist page for this share token
    await page.goto(`${baseURL}/wishlist/share/${shareToken}`);
    
    // Prepare to capture the POST /lists response before clicking remove
    const apiPromise = captureApiResponse(page, '/wp-json/tm-wishlist/v1/lists', 'POST');

    // Click the "Remove from wishlist" span (remove-from-compare)
    const removeButton = page.locator('span.remove-from-compare');
    await expect(removeButton).toBeVisible();
    await removeButton.click();

    // Wait for and capture the API response
    const responseBody = await apiPromise;
    
    // Check that data is an empty array which indicates the item was removed and the list is now empty
    expect(responseBody.data).toEqual([]);

    // Wait for the empty message to be visible on the page
    const emptyMessage = await page.locator('.tm-compare-list.open').innerText();
    expect(emptyMessage).toBe('Your wishlist is empty. To start, view our products pages.');

});

test('User deletes list for me', async ({ page, baseURL }) => {

    // Add a product to the wishlist and generate a share token
    await addProductToWishlist(page, { baseURL });

    // Wait for and assert the new button state
    await assertRemoveFromWishlistVisible(page);

    // Assert the share token is set in localStorage
    const shareToken = await getShareTokenFromStorage(page);
    expect(shareToken).not.toBeNull();

    // Navigate to the wishlist page for this share token
    await page.goto(`${baseURL}/wishlist/share/${shareToken}`);

    // Click the "Delete List (ME)" button
    await clickButton(page, 'Delete List (ME)');

    // Listen for the delete API response, capture and assert the response body
    const responseBody = await captureApiResponse(page, `/wp-json/tm-wishlist/v1/lists/${shareToken}/user`, 'DELETE');

    // Check that data is null in the response which indicates the list was deleted for this user
    expect(responseBody.data).toBeNull();

    // Wait for the compare list wrapper to be removed from the page
    await expect(page.locator('.tm-compare-list-wrapper')).toHaveCount(0);

    // Check entry content, should only contain "Your wishlist is empty. To start, view our products pages."
    const emptyMessage = await page.locator('.entry-content').innerText();
    expect(emptyMessage).toBe('Your wishlist is empty. To start, view our products pages.');

    // Assert that the share token and configs have been removed from localStorage
    const shareTokenAfter = await page.evaluate(() => localStorage.getItem('tm_wishlist_share_token'));
    expect(shareTokenAfter).toBeNull();

    const configs = await page.evaluate(() => localStorage.getItem('tm_wishlist_configs'));
    expect(configs).toBeNull();

    // Visit product page and assert that share token has been removed from wishlist links
    await page.goto(`${baseURL}/product/tavolo-mezzaluna-colonna/`);

    // Get all wishlist share links and their hrefs
    const wishlistLinks = page.locator('a[href^="/wishlist"]');
    const hrefs = await wishlistLinks.evaluateAll(links => links.map(link => link.getAttribute('href')));

    // Assert there are exactly 2 links and both are "/wishlist" (no share token)
    expect(hrefs.length).toBe(2);
    expect(hrefs.every(href => href === '/wishlist')).toBe(true);

});

test('User visits share wishlist link but is not the owner', async ({ browser, baseURL }) => {

    // Create wishlist and get share token in first context (owner)
    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    await ownerPage.goto(`${baseURL}/product/tavolo-mezzaluna-colonna/`);

    // Use the helper to add a product to the wishlist and generate a share token
    await addProductToWishlist(ownerPage, { baseURL });
    
    // Wait for and assert the new button state
    await assertRemoveFromWishlistVisible(ownerPage);
    
    // Wait for the share token to appear in localStorage (timeout after 2s)
    const shareToken = await getShareTokenFromStorage(ownerPage);
    
    // Assert that the share token is present before proceeding
    expect(shareToken).not.toBeNull();
    
    // Close the owner context to simulate a new visitor with no existing wishlist data or tokens
    await ownerContext.close();

    // Open share link in a fresh context (not owner)
    const visitorContext = await browser.newContext();
    const visitorPage = await visitorContext.newPage();
    await visitorPage.goto(`${baseURL}/wishlist/share/${shareToken}`);

    // Assert that the URL is correct and includes the share token
    expect(visitorPage.url()).toBe(`${baseURL}/wishlist/share/${shareToken}/`);

    // Assert that the wishlist contents are visible on the page (i.e. we can see the product names)
    const productName = await visitorPage.locator('.woocommerce-loop-product__title').first().innerText();
    expect(productName).not.toBe('');

    // Assert that entry content contains the view only wishlist message
    const entryContent = await visitorPage.locator('.entry-content').innerText();
    expect(entryContent).toContain('This is a view only wishlist. To create your own wishlist, please add products from the product pages.');

    // Assert that list control buttons element does not exist on the page
    const controlButtons = visitorPage.locator('.list-control-buttons');
    await expect(controlButtons).toHaveCount(0);

    // Assert that the "Manage Lists" button is not visible to non-owners
    const manageButton = visitorPage.getByRole('button', { name: 'Manage Lists' });
    await expect(manageButton).toHaveCount(0);

    // Close the visitor context
    await visitorContext.close();

});

test('Manage lists button only visible to owner on share page', async ({ page, baseURL }) => {

    // Add a product to the wishlist and generate a share token
    await addProductToWishlist(page, { baseURL });

    // Wait for and assert the new button state
    await assertRemoveFromWishlistVisible(page);

    // Assert the share token is set in localStorage
    const shareToken = await getShareTokenFromStorage(page);
    expect(shareToken).not.toBeNull();

    // Navigate to the wishlist page for this share token
    await page.goto(`${baseURL}/wishlist/share/${shareToken}`);

    // Assert that the "Manage Lists" button is visible to the owner
    const manageButton = page.getByRole('button', { name: 'Manage Lists' });
    await expect(manageButton).toBeVisible();
    
    // Navigate to the wishlist page
    await page.goto(`${baseURL}/wishlist/`);

    // Assert that the "Manage Lists" button not visible on /wishlist page
    const button = page.getByRole('button', { name: 'Manage Lists' });
    await expect(button).toHaveCount(0);

});

test('Share button contains correct url with share token', async ({ page, baseURL }) => {

    // Add a product to the wishlist and generate a share token
    await addProductToWishlist(page, { baseURL });

    // Wait for and assert the new button state
    await assertRemoveFromWishlistVisible(page);

    // Assert the share token is set in localStorage
    const shareToken = await getShareTokenFromStorage(page);
    expect(shareToken).not.toBeNull();

    // Navigate to the wishlist page for this share token
    await page.goto(`${baseURL}/wishlist/share/${shareToken}`);

    const shareBtn = page.getByRole('button', { name: 'Share Wishlist' });
    await expect(shareBtn).toBeVisible();

    // Get data-url attribute from the share button and assert it contains the correct share token
    const dataUrl = await shareBtn.getAttribute('data-url');
    expect(dataUrl).toContain(`/wishlist/share/${shareToken}/`);

});