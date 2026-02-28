// helpers/add-product-to-wishlist.js
// Playwright helper for adding a product to a wishlist

/**
 * Adds a product to the wishlist via UI interactions.
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} options - Options for the helper
 */
export async function addProductToWishlist(page, options = {}) {
  
    // Destructure options with defaults, can be overridden when calling the function
    const {
        baseURL,
        productUrl = '/product/tavolo-mezzaluna-colonna/',
        addButtonName = 'Add to wishlist',
    } = options;

    // Navigate to the product page or listing
    await page.goto(`${baseURL}${productUrl}`);

    // Clear local storage to ensure the user has no existing wishlist data
    await page.evaluate(() => localStorage.clear());

    // Click the "Add to wishlist" button to create a new wishlist and generate share token
    const addButton = page.getByRole('button', { name: addButtonName });
    await addButton.waitFor({ state: 'visible' });
    await addButton.click();

}