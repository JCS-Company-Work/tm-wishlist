import { test, expect } from '@playwright/test';

test('User renames their only wishlist from the wishlist page', async ({ page }) => {

    // Click the "Add to wishlist" button on a product page to create a wishlist
    await page.goto('https://tm-store-jan-26.local/product/tavolo-mezzaluna-colonna/?colour=Laurent%20Golden&base=Yamuna&veneer=Brushed%20Inox');
    
    // Clear local storage to ensure the user has no existing wishlist data
    await page.evaluate(() => localStorage.clear());
    
    // Click the "Add to wishlist" button
    const addButton = page.getByRole('button', { name: 'Add to wishlist' });
    
    // Wait for and click the add to wishlist button
    await addButton.waitFor({ state: 'visible' });
    
    // Click the add to wishlist button to create a new wishlist
    await addButton.click();

    // Go back to the wishlist page
    await page.goto('https://tm-store-jan-26.local/wishlist');

    // Click the "Edit wishlist name" button
    const editNameButton = page.getByRole('button', { name: 'edit' });

    // Wait for and click the edit name button
    await editNameButton.waitFor({ state: 'visible' });
    
    // Click the edit name button to open the rename input
    await editNameButton.click();

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