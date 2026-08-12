/**
 * Core functions used across all pages of TM Compare Plugin
 */

/**
 * Get cookie value by name
 * @param {string} name - Cookie name
 * @returns {string|null} - Cookie value or null if not found
 */
const getCookie = (name) => {

    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);

    if (parts.length === 2) return parts.pop().split(';').shift();

    return null;

};

/**
 * Resolve the active wishlist user token from localStorage, cookies, or a configured showroom token.
 * @returns {string|null}
 */
const getWishlistUserToken = () => {

    try {
        const storedToken = localStorage.getItem('tm_wishlist_user_token');
        if (storedToken) {
            return storedToken;
        }
    } catch (error) {
        // Ignore localStorage failures and continue to the cookie fallback below.
    }

    if (window.__TM_WISHLIST_USER_TOKEN__) {
        return window.__TM_WISHLIST_USER_TOKEN__;
    }

    const cookieToken = getCookie('tm_wishlist_user_token');
    if (cookieToken) {
        return cookieToken;
    }

    return window.TMWLSettings?.showroom_user_token || null;

};

/**
 * Persist the active wishlist user token for this origin.
 * @param {string} token
 * @param {{ persistCookie?: boolean, sameSite?: 'Lax' | 'None', secure?: boolean }} [options]
 * @returns {string}
 */
const setWishlistUserToken = (token, options = {}) => {

    if (!token) return '';

    const normalizedToken = String(token);
    const isEmbedded = window.self !== window.top;
    const { persistCookie = true, sameSite = isEmbedded ? 'None' : 'Lax', secure = window.location.protocol === 'https:' } = options;

    try {
        localStorage.setItem('tm_wishlist_user_token', normalizedToken);
    } catch (error) {
        window.__TM_WISHLIST_USER_TOKEN__ = normalizedToken;
    }

    if (persistCookie) {
        try {
            const cookieParts = [
                `tm_wishlist_user_token=${encodeURIComponent(normalizedToken)}`,
                'path=/',
                'max-age=31536000',
                `SameSite=${sameSite}`,
            ];

            if (secure) {
                cookieParts.push('Secure');
            }

            document.cookie = cookieParts.join('; ');
        } catch (error) {
            // Cookie storage is optional fallback behavior; continue without blocking the user flow.
        }
    }

    return normalizedToken;

};

/**
 * Get saved configurations from local storage for the current user
 * @returns {array}
 */
const getSavedConfigs = () => {

    const userToken = getWishlistUserToken();
    const shareToken = localStorage.getItem('tm_wishlist_share_token');
    const data = JSON.parse(localStorage.getItem('tm_wishlist_configs') || '{}');

    return (data[userToken] && data[userToken][shareToken]) ? data[userToken][shareToken] : [];

};

/**
 * Get all lists for a user from local storage, ensuring proper structure and error handling
 * @param {string} userToken
 * @param {string} storageKey
 * @returns {object} - Object containing all lists for the user
 */
const getAllListsForUser = (userToken, storageKey) => {

    let allUserLists = {};

    try {
        allUserLists = JSON.parse(localStorage.getItem(storageKey)) || {};
    } catch {
        allUserLists = {};
    }

    if (!allUserLists[userToken]) {
        allUserLists[userToken] = {};
    }

    return allUserLists;

};

/**
 * Clear all wishlist-related data from local storage
 */
const clearWishlistStorage = () => {
    localStorage.removeItem('tm_wishlist_configs');
    localStorage.removeItem('tm_wishlist_share_token');
};

/**
 * Update wishlist links in the DOM with share token
 */
const updateWishlistLinks = (shareToken) => {

    const getEmbedQueryString = () => {
        const currentUrl = new URL(window.location.href);
        const query = new URLSearchParams();

        if (currentUrl.searchParams.has('tvembed')) {
            const tvEmbedValue = currentUrl.searchParams.get('tvembed') || '1';
            query.set('tvembed', tvEmbedValue);
        }

        const queryString = query.toString();
        return queryString ? `?${queryString}` : '';
    };

    const buildWishlistUrl = (token) => {
        const query = getEmbedQueryString();

        if (token) {
            return `/wishlist/share/${encodeURIComponent(token)}/${query}`;
        }

        return `/wishlist/${query}`;
    };

    const token = shareToken || localStorage.getItem('tm_wishlist_share_token');

    document.querySelectorAll('a[href*="/wishlist"]')
        .forEach(link => {
            if (link.id === 'manage_lists') {
                link.href = buildWishlistUrl('');
                return;
            }

            link.href = buildWishlistUrl(token);
        });

};

/**
 * Check for cookie and clear localStorage if missing, but only on non-wishlist pages
 */
const checkForCookieAndClearStorage = () => {

    const shareToken = localStorage.getItem('tm_wishlist_share_token');
    const isWishlistPage = window.location.pathname.startsWith('/wishlist');
    const isSharePage = /\/wishlist\/share\//.test(window.location.pathname);
    const userToken = getWishlistUserToken();
    const isIframe = window.self !== window.top;

    if ((!shareToken || shareToken === '') && !isWishlistPage && !isSharePage && !userToken && !isIframe) {
        clearWishlistStorage();
    }

};

/**
 * Sync the current wishlist to the server via REST API.
 * - Payload includes `data` (array of configs) and optionally `generate_share` (boolean)
 * - On success, updates share token and share link in the UI if returned by the server
 * - Prevents parallel syncs with `this.isSyncing` flag
 * @param {TMCompareItem[]} configs
 */
const syncToServer = async (configs, saveUrl) => {

    const userToken = getWishlistUserToken();

    if (!saveUrl) return;

    const shareToken = localStorage.getItem('tm_wishlist_share_token');
    const shouldGenerateShare = !shareToken;

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

        if (data?.success && data.share_token && data.share_token !== shareToken) {
            localStorage.setItem('tm_wishlist_share_token', data.share_token);
            updateWishlistLinks();
        }

    } catch (err) {
        // Ignore sync errors and allow the UI to keep working.
    }
};

document.addEventListener('DOMContentLoaded', () => {

    checkForCookieAndClearStorage();
    updateWishlistLinks();

});