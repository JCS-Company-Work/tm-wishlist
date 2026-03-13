// helpers/api/edit-list-name-mocked-api.js
// Playwright helper for mocking the API response for editing a wishlist name

export async function editListNameMockAPI(page, { mockWishlistDbRow }) {

    // Mock backend response
    await page.route('**/tm-wishlist/v1/lists/**', route => {

        // Return successful response with the new name
        if (route.request().method() === 'PUT') {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    share_token: 'c81cddf6d25ad9ee38cc',
                    list_name: 'My New Wishlist Name'
                })
            });
        } else {
            // For GET or other methods, return mockWishlistDbRow
            route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockWishlistDbRow)
            });
        }
    });

}