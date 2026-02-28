// helpers/assert-remove-from-wishlist-visible.js
// Playwright helper for asserting that the "Remove from wishlist" button is visible

import { expect } from '@playwright/test';

export async function assertRemoveFromWishlistVisible(page) {

    const removeButton = page.getByRole('button', { name: 'Remove from wishlist' });
    await removeButton.waitFor({ state: 'visible' });
    await expect(removeButton).toHaveText('Remove from wishlist');

}