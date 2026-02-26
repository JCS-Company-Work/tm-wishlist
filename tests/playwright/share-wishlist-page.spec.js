import { test, expect } from '@playwright/test';

test('User creates new wish list from wishlist/share page', async ({ page }) => {

    // Go to the product page
    await page.goto('https://tm-store-jan-26.local/product/tavolo-mezzaluna-colonna/');

    // Clear local storage to ensure the user has no existing wishlist data
    await page.evaluate(() => localStorage.clear());

    // Click the "Add to wishlist" button to create a new wishlist and generate share token
    const addButton = page.getByRole('button', { name: 'Add to wishlist' });
    await addButton.waitFor({ state: 'visible' });
    await addButton.click();

    // Wait for and assert the new button state
    const removeButton = page.getByRole('button', { name: 'Remove from wishlist' });

    // Wait for button
    await removeButton.waitFor({ state: 'visible' });

    // Assert the button text has updated to "Remove from wishlist"
    await expect(removeButton).toHaveText('Remove from wishlist');

    // Wait for the share token to appear in localStorage (timeout after 2s)
    const shareToken = await page.waitForFunction(() => localStorage.getItem('tm_wishlist_share_token'), null, { timeout: 2000 }).then(fn => fn.jsonValue());
    console.log('Share token from local storage:', shareToken);
    if (!shareToken) {
        console.log('No share token found in local storage');
        return;
    }

    // Go to the wishlist page for this share token
    await page.goto(`https://tm-store-jan-26.local/wishlist/share/${shareToken}`);

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
