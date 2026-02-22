/**
 * 
 * Core functions used across all pages of TM Compare Plugin
 */

/**
 * Get saved configurations from local storage for the current user
 * @returns {array}
 */
const getSavedConfigs = () => {

    // Get user token from cookie
    const userToken = getCookie('tm_wishlist_user_token');

    // Get share token from local storage (for potential use in share page)
    const shareToken = localStorage.getItem('tm_wishlist_share_token');

    // Get all wishlist configs from local storage
    const data = JSON.parse(localStorage.getItem('tm_wishlist_configs') || '{}');

    // Return configs for current user and share token, or empty array if not found
    return (data[userToken] && data[userToken][shareToken]) ? data[userToken][shareToken] : [];

}

/**
 * Get all lists for a user from local storage, ensuring proper structure and error handling
 * @param {string} userToken 
 * @param {string} storageKey 
 * @returns {object} - Object containing all lists for the user
 */
const getAllListsForUser = (userToken, storageKey) => {

    // Get all user lists from localStorage or initialize
    let allUserLists = {};

    // Process data
    try {

      // Attempt to parse existing localStorage data
      allUserLists = JSON.parse(localStorage.getItem(storageKey)) || {};

    } catch {

      // If parsing fails, log a warning and reset to an empty object to allow saving new data
      allUserLists = {};
      console.warn('Failed to parse wishlist data from localStorage. Resetting to empty object.');

    }

    // Ensure user token structure
    if (!allUserLists[userToken]) {
      allUserLists[userToken] = {};
    }

    // Return user lists object
    return allUserLists;

}

/**
 * Clear all wishlist-related data from local storage
 */
const clearWishlistStorage = () => {

  localStorage.removeItem('tm_wishlist_configs');
  localStorage.removeItem('tm_wishlist_share_token');

}

/**
 * Update wishlist links in the DOM with share token
 */
const updateWishlistLinks = () => {

    // Get share token from cookie
    const token = getCookie('tm_wishlist_share_token');
    console.log('Updating wishlist links with token:', token);
    // Update all wishlist links except #manage_lists
    if (token) {
        document.querySelectorAll('a[href="/wishlist"]')
            .forEach(link => {
                if (link.id !== 'manage_lists') {
                    link.href = `/wishlist/share/${token}/`;
                }
            });
    }
}

/**
 * Get cookie value by name
 * @param {string} name - Cookie name
 * @returns {string|null
 */
const getCookie = (name) => {

    // Get cookie value by name
    const value = `; ${document.cookie}`;

    // Split and find the cookie
    const parts = value.split(`; ${name}=`);

    // Return cookie value if found
    if (parts.length === 2) return parts.pop().split(';').shift();

    // If cookie not found,
    return null;

}

/**
 * Check for cookie and clear localStorage if missing, but only on non-wishlist pages
 */
const checkForCookieAndClearStorage = () => {

    // Get share token from cookie
    const cookieToken = getCookie('tm_wishlist_share_token');

    // Check if we're on a wishlist page (either main or share) to avoid clearing storage unnecessarily
    const isWishlistPage = window.location.pathname.startsWith('/wishlist');

    // Also check for share page to avoid clearing storage when viewing a shared wishlist
    const isSharePage = /\/wishlist\/share\//.test(window.location.pathname);
    if ((!cookieToken || cookieToken === '') && !isWishlistPage && !isSharePage) {
        clearWishlistStorage();
    }

}

/**
 * Sync the current wishlist to the server via REST API.
 * - Payload includes `data` (array of configs) and optionally `generate_share` (boolean)
 * - On success, updates share token and share link in the UI if returned by the server
 * - Prevents parallel syncs with `this.isSyncing` flag
* @param {TMCompareItem[]} configs
*/
const syncToServer = async (configs, saveUrl) => {

    // Ensure user token exists
    const userToken = getCookie('tm_wishlist_user_token');

    // Exit if no save URL
    if (!saveUrl) return;

    // Get share token from local storage
    const shareToken = localStorage.getItem('tm_wishlist_share_token');
    
    // Only request share token if not already present for this session
    const shouldGenerateShare = !shareToken;

    // Prepare payload
    const payload = {
        data: configs,
        share_token: shareToken,
        user_token: userToken,
        ...(shouldGenerateShare ? { generate_share: true } : {})
    };

    try {

        const res = await fetch(saveUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!res.ok) return;

        const data = await res.json();

        if (data?.success) {

            // Store share token if present
            if (data.share_token) {

                // Only update if token has changed to avoid unnecessary UI updates
                if (data.share_token !== shareToken) {

                // Persist new share token
                localStorage.setItem('tm_wishlist_share_token', data.share_token);

                //Update DOM wishlist links
                updateWishlistLinks();

                }

            }

        }

    } catch (err) {

        console.error('Error syncing wishlist to server:', err);

    }
}

document.addEventListener('DOMContentLoaded', () => {

    // On page load, check for cookie and clear localStorage if missing (but only on non-wishlist pages)
    checkForCookieAndClearStorage();

    // Update wishlist links with share token
    updateWishlistLinks();
    
});