/**
 * 
 * Core functions used across all pages of TM Compare Plugin
 */

/**
 * Get saved configurations from local storage
 * @returns {array}
 */
const getSavedConfigs = () => {

    // Try localStorage first
    const data = localStorage.getItem('tm_wishlist_configs');
    return data ? JSON.parse(data) : [];

}

/**
 * Clear all wishlist-related data from local storage
 */
const clearWishlistStorage = () => {

  localStorage.removeItem('tm_wishlist_configs');
  localStorage.removeItem('tm_wishlist_share_token');

}

/**
 * 
 * Share Button Clipboard Functionality
 */
// const addShareButtonListeners = () => {

//     // Get all share buttons
//     const shareButtons = document.querySelectorAll('.share-button');

//     // Exit if no buttons found
//     if (!shareButtons.length) return;

//     // Bind click event to each button
//     shareButtons.forEach(button => {

//         // Add click listener
//         button.addEventListener('click', () => {

//             // Get URL from data attribute
//             const url = button.dataset.url;

//             // Exit if no URL
//             if (!url) return;

//             // Copy to clipboard
//             navigator.clipboard.writeText(url).then(() => {

//                 // Show feedback
//                 const msg = button.nextElementSibling;

//                 // Show message if exists
//                 if (msg && msg.classList.contains('share-copied')) {
//                     msg.style.display = 'inline';
//                     setTimeout(() => {
//                         msg.style.display = 'none';
//                     }, 2000);
//                 }
//             }).catch(err => {
//                 console.error('Failed to copy:', err);
//             });
//         });
//     });
// }

/**
 * Update the header wishlist counter
 * Animates on change and reads from localStorage
 */
// const updateHeaderCounter = () => {

//     // Get counter element
//     const counter = document.querySelector('span.header-compare-count');

//     // Exit if not found
//     if (!counter) return;

//     // Get current value from localStorage
//     const value = Array.isArray(getSavedConfigs()) ? getSavedConfigs().length : 0;

//     // Update counter text
//     counter.textContent = String(value);

//     // Trigger animation
//     counter.classList.add('cart-animate');

//     // Remove animation class after animation ends
//     const handler = () => {

//         // Remove animation class
//         counter.classList.remove('cart-animate');
//         counter.removeEventListener('animationend', handler);

//     };

//     // Listen for animation end
//     counter.addEventListener('animationend', handler);

// };

/**
 * Update wishlist links in the DOM with share token
 */
const updateWishlistLinks = () => {

    // Get share token from local storage
    const token = localStorage.getItem('tm_wishlist_share_token');

    // Update all wishlist links
    if (token) {

        // Update hrefs
        document.querySelectorAll('a[href=\"/wishlist\"]')
            .forEach(link => link.href = `/wishlist/share/${token}/`);
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

document.addEventListener('DOMContentLoaded', () => {

    // Initialize share button listeners
    //addShareButtonListeners();

    // On page load, check for cookie and clear localStorage if missing (but only on non-wishlist pages)
    checkForCookieAndClearStorage();

    // Update wishlist links with share token
    updateWishlistLinks();
    
    // Initialize header counter on load
    //try { updateHeaderCounter(); } catch {}
});

// Keep header counter in sync on list changes
// document.addEventListener('tmWishlistUpdated', () => {
//     try { updateHeaderCounter(); } catch {}
// });