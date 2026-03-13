export async function setCookies(context, { userToken, shareToken }) {

    // Set cookie for user_token
    await context.addCookies([{
        name: 'tm_wishlist_user_token',
        value: userToken,
        domain: 'store.tailormade.uk',  
        path: '/',
    }]);

    // Set cookie for share_token if provided
    if (shareToken) {
        await context.addCookies([{
            name: 'tm_wishlist_share_token',
            value: shareToken,
            domain: 'store.tailormade.uk',  
            path: '/',
        }]);
    }
    
}