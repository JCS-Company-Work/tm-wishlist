/**
 * TM Compare Class
 * Handles all interactions and API calls for the compare page, including:
 * - Managing multiple compare lists
 * - Removing items from lists
 * - Clearing entire lists
 * - Sharing lists
 * - Inline editing of list names
 * 
 * This class relies on configurations saved in localStorage and API endpoints for syncing data with the server.
 */    
class TMCompare {

    constructor() {

        // API endpoints and settings from global WordPress-localized object (window.TMWLSettings)
        this.STORAGE_KEY = window.TMWLSettings?.storage_key || 'tm_wishlist_configs';
        this.SYNC_URL = window.TMWLSettings?.rest_save_url || null;
        this.nonce = window.TMWLSettings?.nonce || null;

        // Empty wishlist message for reuse
        this.EMPTY_MESSAGE = '<p>Your designs list is empty. To start, view our products pages.</p>';

        // Initialize properties
        this.init();

    }

    init() {

        // Initialize share button listeners
        this.addControlBtnListeners();

        // Initialize remove button listeners
        this.addRemoveBtnListeners();

        // Initialize create list button listener
        this.createList();

        // Initialize list toggle listeners
        this.toggleList();

        // Set active list on page load
        this.setActiveListOnInit();

        // Show or hide lists based on active state on page load
        this.showHideLists();

        // Update active list on icon click
        this.updateActiveList();

        // Update list names on edit button click
        this.updateListName();

        // Check for new list data in localStorage and insert it into the DOM if it exists 
        this.checkAndInsertNewListFromStorage();

    }

    /** ================= Event Binding / Setup ================= **/

    /**
     * Bind click events to control buttons (share, clear, delete) and trigger appropriate API calls based on button ID
     */
    addControlBtnListeners() {

        // Select all control buttons from DOM
        const controlBtns = document.querySelectorAll('.list-control-buttons button');
        
        if(controlBtns.length > 0) {

            // Bind click event to each control button
            controlBtns.forEach((btn) => {

                // Add click listener
                btn.addEventListener('click', (e) => {

                    // Prevent default button behavior
                    e.preventDefault();

                    // Get action from button ID
                    const action = e.currentTarget.id;

                    // Get share token from closest wrapper data attribute
                    const share_token = e.currentTarget.closest('.tm-compare-list-wrapper').dataset.shareToken;

                    // Construct API path using share token
                    const apiPath = `wp-json/tm-wishlist/v1/lists/${share_token}`;
                    
                    // Query appropriate API based on action
                    switch(action) {
                        case 'share_wishlist':
                            this.shareWishlist(e.currentTarget);
                            break;
                        case 'clear_wishlist':
                            this.triggerAction(`${apiPath}/items`, 'DELETE', share_token);
                            break;
                        case 'delete_list_me':
                            this.triggerAction(`${apiPath}/user`, 'DELETE', share_token);
                            break;
                        case 'delete_list_all':
                            this.triggerAction(`${apiPath}`, 'DELETE', share_token);
                            break;
                        default:
                            console.warn('Unknown action:', action);
                    }

                });

            });
        }

    }

    /**
     * Add event listeners to remove buttons and clear all button
     */
    addRemoveBtnListeners() {

        // Select all remove buttons from DOM
        const removeBtns = document.querySelectorAll('.remove-from-compare');

        if(removeBtns.length > 0) {
        
            // Bind click event to each remove button
            removeBtns.forEach((btn) => {

                // Add click listener
                btn.addEventListener('click', (e) => {

                    // Prevent default link behavior
                    e.preventDefault();

                    // Call removeConfig method
                    this.removeConfig(e.currentTarget);

                });

            });

        }

        // Select the clear all button from DOM
        const clearBtn = document.querySelector('.clear-compare');
        
        if (clearBtn) {
            
            // Bind click event to clear button
            clearBtn.addEventListener('click', (e) => {

                // Prevent default button behavior
                e.preventDefault();

                // Call clearAll method
                this.clearAll();

            });
        }
    }

    /**
     * Bind click event to "Create New List" button to trigger API call for creating a new
     * wishlist and update the compare page with the new list without requiring a page refresh
     */
    createList() {

        // Add click listener to "Create New List" button
        const createListBtn = document.getElementById('create_list');
        
        // If button exists, bind click event to redirect to new list creation page
        if (createListBtn) {

            createListBtn.addEventListener('click', () => {

                const getWishlistRootUrl = () => {
                    const currentUrl = new URL(window.location.href);
                    const params = new URLSearchParams();

                    if (currentUrl.searchParams.has('tvembed')) {
                        const tvEmbedValue = currentUrl.searchParams.get('tvembed') || '1';
                        params.set('tvembed', tvEmbedValue);
                    }

                    const query = params.toString();
                    return query ? `/wishlist?${query}` : '/wishlist';
                };

                // Get user token from cookie               
                const userTokenMatch = document.cookie.match(/(?:^|; )tm_wishlist_user_token=([^;]*)/);
                const userToken = userTokenMatch ? userTokenMatch[1] : null;
                
                // Redirect to new list creation page with user token as query parameter
                fetch('/wp-json/tm-wishlist/v1/lists/new', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        user_token : userToken 
                    })
                })
                .then(response => response.json())
                .then(data => {

                    // If we are on the share page, redirect to the main wishlist page to show the new list
                    if (window.location.pathname.startsWith('/wishlist/share/')) {
                        window.location.href = getWishlistRootUrl();

                        // Add data to local storage for use after redirect
                        localStorage.setItem('tm_wishlist_new_list_data', JSON.stringify(data));

                    } else {

                        // Else just add the new list to the compare page
                        console.log('Action response:', data);

                        // Update UI based on response by adding new list to the DOM
                        this.addNewListToDom(data);
    
                    }
                });

            });
        }
    }

    /**
     * Add a new compare list to the DOM using the HTML returned from the server after creating a new list
     * 
     * @param {object} data 
     */
    addNewListToDom(data) {

        // Add new list to the compare page
        const lists = document.querySelector('.tm-wishlist-lists');

        // Extract new list HTML from response data
        const newListHTML = data.list_html;

        // If list HTML exists, insert it into the DOM and bind necessary event listeners for the new list
        if (lists && newListHTML) {

            // Guard to prevent duplicate insertion if timing page load and API response are close together 
            // and the new list already exists in the DOM from a previous response or page load check
            if (!document.querySelector(`.tm-compare-list-wrapper[data-share-token="${data.share_token}"]`)) {

                // Insert new list HTML into the DOM as the first child of the lists container
                lists.insertAdjacentHTML('afterbegin', newListHTML);

                // Re-bind event listeners for toggle controls for the new list
                this.toggleList();

                // Re-bind event listeners for the active icon for the new list
                this.updateActiveList();

                // Re-bind event listeners for the edit list name button for the new list
                this.updateListName();

                // Re-bind control button listeners for the new list
                this.addRemoveBtnListeners();

                // Re-bind control button listeners for the new list
                this.addControlBtnListeners();

                // Add new list to configs in localstorage with an empty array
                this.updateConfigsWithNewList(data.user_token, data.share_token);

            }
            
        }

    }

    /**
     * Check for new list data in localStorage (after redirect from creating
     * a new list on wishlist/share) and add it to the DOM if it exists
     */
    checkAndInsertNewListFromStorage() {

        // Check for new list data in local storage
        if(localStorage.getItem('tm_wishlist_new_list_data')) {

            // If new list data exists, parse it and add the new list to the DOM
            const newListData = JSON.parse(localStorage.getItem('tm_wishlist_new_list_data'));

            // Add new list to the DOM
            this.addNewListToDom(newListData);

            // Remove the new list data from localStorage to prevent duplicate additions
            localStorage.removeItem('tm_wishlist_new_list_data');

        }

    }

    /**
     * 
     * When a new list is created, add it to localStorage configs 
     * If configs are empty, attempt to repopulate from database
     * 
     * @param {string} userToken 
     * @param {string} shareToken 
     */
    updateConfigsWithNewList(userToken, shareToken) {

        // Get all user lists from localStorage or initialize
        let allUserLists = {};

        try {

            // Attempt to parse existing localStorage data
            allUserLists = JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || {};

        } catch {

            // If parsing fails, log a warning and reset to an empty object to allow saving new data
            allUserLists = {};
            console.warn('Failed to parse wishlist data from localStorage. Resetting to empty object.');
        }

        // Ensure user token structure
        // If allUserLists is empty check database with user token to find existing lists and populate localStorage
        if (!allUserLists[userToken]) {
            fetch(`/wp-json/tm-wishlist/v1/lists?user_token=${userToken}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            })
            .then(response => response.json())
            .then(data => {

                // If data contains lists, populate localStorage with them
                if (data && Array.isArray(data.lists)) {

                    // Initialize user token structure in allUserLists
                    allUserLists[userToken] = {};
                    
                    // Loop through lists and add them to the user token in 
                    // allUserLists with share token as key and configs as value
                    data.lists.forEach(list => {
                        allUserLists[userToken][list.share_token] = list.configs || [];
                    });

                }

                // Add empty array for the new list
                allUserLists[userToken][shareToken] = [];
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(allUserLists));

            });

        } else {

            // Add empty array for the new list
            allUserLists[userToken][shareToken] = [];
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(allUserLists));
            
        }

    }

    /**
     * Toggle the visibility of compare lists
     */
    toggleList() {

        const toggleButtons = document.querySelectorAll('.list-toggle');
        if (toggleButtons.length > 0) {
            toggleButtons.forEach((btn) => {
                btn.removeEventListener('click', this.handleToggleClick);
                btn.addEventListener('click', this.handleToggleClick);
            });
        }

    }

    /** 
     * Handle click event for list toggle buttons to open/close the compare list and toggle active state
     */
    handleToggleClick(e) {
        const btn = e.currentTarget;
        btn.classList.toggle('active');
        const wrapper = btn.closest('.tm-compare-list-wrapper');
        const compareList = wrapper.querySelector('.tm-compare-list-multi');
        if (compareList) {
            compareList.classList.toggle('open');
        }
    }

    /**
     * On page load, check for active list share token in localstorage 
     * and set the corresponding list as active, also scroll to it
     */
    setActiveListOnInit() {

        // Get share token from localstorage
        const shareToken = localStorage.getItem('tm_wishlist_share_token');

        if (shareToken) {

            // If share token exists, find the corresponding compare list wrapper and activate it
            const wrapper = document.querySelector(`.tm-compare-list-wrapper[data-share-token="${shareToken}"]`);

            if (wrapper) {

                // Add active class to wrapper
                wrapper.classList.add('active');

                // Extract toggle button and active icon within the wrapper
                const toggleBtn = wrapper.querySelector('.list-toggle');
                const activeIcon = wrapper.querySelector('.list-active');

                // Set toggle to active state if exists
                if (toggleBtn) {

                    toggleBtn.classList.add('active');

                    // Set active icon to selected state if exists
                    if (activeIcon) {
                        activeIcon.classList.add('selected');
                    }

                    // Ensure the list is open
                    const compareList = wrapper.querySelector('.tm-compare-list');
                    if (compareList) {
                        compareList.classList.add('open');
                    }

                    // Scroll to the active list
                    wrapper.scrollIntoView({ behavior: 'smooth' });

                }
            }
        }
    }

    /**
     * Hide all lists that do not contain .active class on initial page load.
     */
    showHideLists() {
        
        // On load, hide all lists except those with .active
        document.querySelectorAll('.tm-compare-list-wrapper').forEach(wrapper => {

            // If wrapper does not have active class, ensure its list is closed
            const compareList = wrapper.querySelector('.tm-compare-list');

            // If compare list exists, toggle open class based on whether wrapper is active
            if (compareList) {
                if (!wrapper.classList.contains('active')) {
                    compareList.classList.remove('open');
                } else {
                    compareList.classList.add('open');
                }
            }
        });
    }

    /**
     * Bind click events to list active icons to set the active list and store it in a cookie for persistence
     */
    updateActiveList() {

        // Add click listener to each list active icon
        const activeIcons = document.querySelectorAll('.list-active');
        
        // If icons exist, bind click event to update active list and set cookie
        if(activeIcons.length > 0) {

            // On icon click, set the corresponding list as active and store its share token in a cookie
            activeIcons.forEach((icon) => {

                icon.addEventListener('click', () => {

                    // Get the share token of the clicked list
                    const wrapper = icon.closest('.tm-compare-list-wrapper');
                    const shareToken = wrapper ? wrapper.dataset.shareToken : null;

                    if (shareToken) {

                        // Set share token in localStorage for potential use in share page
                        localStorage.setItem('tm_wishlist_share_token', shareToken);

                        // Set share token in cookie for server-side access to update active title
                        document.cookie = 'tm_wishlist_share_token=' + shareToken + '; path=/';

                        // Remove active class from all icons and toggle buttons
                        document.querySelectorAll('.list-active').forEach(el => el.classList.remove('selected'));

                        document.querySelectorAll('.tm-compare-list-wrapper').forEach(el => el.classList.remove('active'));
                        
                        // Add active class to the clicked icon's wrapper and toggle button
                        wrapper.classList.add('active');

                        // Add active class to clicked icon and its toggle button       
                        icon.classList.add('selected');

                        // Extract new list title from DOM
                        const newTitle = wrapper.querySelector('.tm-compare-list-name').textContent;

                        // Update active list title
                        this.updateActiveListTitle(newTitle);

                        // Update wishlist links with new share token
                        updateWishlistLinks(shareToken);

                    }

                });

            });
        }

    }

    /** ================= User Triggered Actions ================= **/

    /** 
     * Delete a compare list 
     * @param {HTMLElement} wrapper - The wrapper element of the list to be deleted
     * @param {string} shareToken - The share token of the list to be deleted
    */
    deleteList(wrapper, shareToken) {

        // Get user token from cookie
        const userTokenMatch = document.cookie.match(/(?:^|; )tm_wishlist_user_token=([^;]*)/);
        const userToken = userTokenMatch ? userTokenMatch[1] : null;
        
        // Get all user lists from localStorage
        let allUserLists = JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || {};
        
        // If the list exists for this user and share token, remove it from localStorage
        if (allUserLists[userToken] && allUserLists[userToken][shareToken]) {

            // Check if deleted list was active
            const activeShareToken = localStorage.getItem('tm_wishlist_share_token');

            if (allUserLists[userToken] && allUserLists[userToken][shareToken]) {
                // Remove the share token key entirely from the user's lists
                delete allUserLists[userToken][shareToken];
            }

            // If the deleted list was the active list, we need to set a new active list or clear the active share token
            if (activeShareToken === shareToken) {
                
                // If deleted list was active pass active state to first available list
                const firstAvailableList = Object.keys(allUserLists[userToken])[0];

                if (firstAvailableList) {

                    // Set the first available list as active in localStorage
                    localStorage.setItem('tm_wishlist_share_token', firstAvailableList);

                    // Also set the active share token cookie for server-side access to update active title
                    document.cookie = 'tm_wishlist_share_token=' + firstAvailableList + '; path=/';

                    // Update active state in the UI
                    document.querySelectorAll('.tm-compare-list-wrapper').forEach(el => el.classList.remove('active'));

                    // Select new active wrapper using the first available share token
                    const newActiveWrapper = document.querySelector(`.tm-compare-list-wrapper[data-share-token="${firstAvailableList}"]`);

                    if (newActiveWrapper) {

                        // Add active class to the new active wrapper
                        newActiveWrapper.classList.add('active');
                        
                        // Also update the active icon state
                        newActiveWrapper.querySelector('.list-active').classList.add('selected');

                        // Update the active list title in the header
                        const newTitle = newActiveWrapper.querySelector('.tm-compare-list-name').textContent;

                        this.updateActiveListTitle(newTitle);

                    }
                } else {
                    console.log('No more lists available, removing active share token from localStorage');
                    // If no lists remain, remove active share token from localStorage
                    localStorage.removeItem('tm_wishlist_share_token');
                }
            }
            
            // Save the updated lists back to localStorage
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(allUserLists));

            // Only remove active share token if no lists remain
            if (!Object.keys(allUserLists[userToken]).length) {
                localStorage.removeItem('tm_wishlist_share_token');
            }

            // Remove share token cookie if it matches the deleted list's share token to prevent stale cookie
            if (document.cookie.includes(`tm_wishlist_share_token=${shareToken}`)) {
                document.cookie = 'tm_wishlist_share_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
            }

        }

        

        // Remove the deleted list from the DOM
        wrapper.remove();

        // If there are no lists show empty message in the main content
        if (document.querySelectorAll('.tm-compare-list-wrapper').length === 0) {
            document.querySelector('.entry-content').innerHTML = this.EMPTY_MESSAGE;
        }

    }

    /**
     * Remove single item from compare list
     * @param {HTMLElement} btn - The button that was clicked
     */
    removeConfig(btn) {

        // Find the wrapper to get the correct share token (active list)
        const wrapper = btn.closest('.tm-compare-list-wrapper');
        const shareToken = wrapper ? wrapper.dataset.shareToken : null;

        // Get user token from cookie
        const userTokenMatch = document.cookie.match(/(?:^|; )tm_wishlist_user_token=([^;]*)/);
        const userToken = userTokenMatch ? userTokenMatch[1] : null;

        // Get all user lists from localStorage
        const allUserLists = getAllListsForUser(userToken, this.STORAGE_KEY);

        // Remove item from list and get updated configs
        const updatedLists = this.removeItemFromList(allUserLists, userToken, shareToken, btn);

        // Update server if SYNC_URL is configured
        if (this.SYNC_URL) {

            // Prevent parallel syncs
            if (this.isSyncing) return;

            // Set syncing flag to prevent parallel syncs
            this.isSyncing = true;

            // Sync to server
            syncToServer(updatedLists, this.SYNC_URL)
            .then(() => {
                this.isSyncing = false;
                console.log('Sync successful');
            })
            .catch((error) => {
                this.isSyncing = false;
                console.error('Sync failed:', error);
            });
        }

        // Remove the item from the DOM
        this.removeItemFromDOM(btn, wrapper);

    }

    /**
     * Get all compare lists for a user from localStorage, ensuring the structure is initialized properly
     * @param {object} allUserLists 
     * @param {string} userToken 
     * @param {string} shareToken 
     * @param {HTMLElement} btn 
     * @returns {Array} Updated configs for the current list after removal
     */
    removeItemFromList(allUserLists, userToken, shareToken, btn) {

        //Get configs for this user and list
        let configs = (allUserLists[userToken] && allUserLists[userToken][shareToken]) ? allUserLists[userToken][shareToken] : [];

        // Extract item key from button data attribute to identify which item to remove from configs
        const key = btn.getAttribute('data-config-key');

        // Destructure the key to get individual config values for comparison
        const [product_id, base, colour, veneer, model] = key.split('|');
        
        // Find the index of the item in the configs that matches the extracted config values
        const index = configs.findIndex(cfg =>
            cfg.product_id === product_id &&
            cfg.base === base &&
            cfg.colour === colour &&
            (cfg.veneer || '') === veneer &&
            cfg.model === model
        );

        // If the item was found in the configs, remove it
        if (index !== -1) {
            configs.splice(index, 1);
        }

        // Ensure user token level is an object
        if (!allUserLists[userToken]) allUserLists[userToken] = {};

        // Ensure share token level is an array
        if (!allUserLists[userToken][shareToken]) allUserLists[userToken][shareToken] = [];
        
        // Update the list for this user and share token with the filtered configs
        allUserLists[userToken][shareToken] = configs;

        // Save back to localStorage
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(allUserLists));

        // Return updated configs
        return configs;

    }

    /**
     * Remove an item from the DOM and update the UI if the list is empty after removal
     * @param {HTMLElement} btn 
     * @param {HTMLElement} wrapper 
     */
    removeItemFromDOM(btn, wrapper) {

        // Remove the closest .tm-compare-item ancestor from DOM
        const itemEl = btn.closest('.tm-compare-item');
        if (itemEl) itemEl.remove();

        // After removal, check if the list is now empty
        if (wrapper) {

            // Select the list container within the wrapper
            const listContainer = wrapper.querySelector('.tm-compare-list');

            // If no more items remain, show empty message and hide control buttons
            if (listContainer && listContainer.querySelectorAll('.tm-compare-item').length === 0) {

                // Remove grid from list container
                listContainer.classList.remove('tm-compare-grid');

                // Show empty message as first element
                listContainer.insertAdjacentHTML('afterbegin', this.EMPTY_MESSAGE);

            }
        }
    }

    /**
     * Clear all items from compare list
     */
    clearAll() {

        // Save empty list
        this.saveItems([]);

        // Remove all items from container
        document.querySelectorAll('.tm-compare-item').forEach(el => el.remove());

        // Select container element
        const container = document.querySelector('.tm-compare-list');

        // Show empty message
        if (container) {
            container.classList.remove('tm-compare-grid');
            container.innerHTML = this.EMPTY_MESSAGE;
        }

    }

     async saveItems(configs) {

        // Get user token from cookie               
        const userTokenMatch = document.cookie.match(/(?:^|; )tm_wishlist_user_token=([^;]*)/);
        const userToken = userTokenMatch ? userTokenMatch[1] : null;

        // Get all user lists from localStorage or initialize
        let allUserLists = {};

        // Process data
        try {

            // Attempt to parse existing localStorage data
            allUserLists = JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || {};

        } catch {

            // If parsing fails, log a warning and reset to an empty object to allow saving new data
            allUserLists = {};
            console.warn('Failed to parse wishlist data from localStorage. Resetting to empty object.');

        }

        // Ensure user token structure
        if (!allUserLists[userToken]) {
        allUserLists[userToken] = {};
        }

        // Get share token from localstorage
        const shareToken = localStorage.getItem('tm_wishlist_share_token');

        // Update only the active list for this user
        allUserLists[userToken][shareToken] = configs;

        // Save back to localStorage
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(allUserLists));

        // Sync to server if configured
        if (this.SYNC_URL) {

        // Prevent parallel syncs
        if (this.isSyncing) return;

        // Set syncing flag to prevent parallel syncs
        this.isSyncing = true;

        // Sync to server
        syncToServer(configs, this.SYNC_URL)
            .then(() => {
            this.isSyncing = false;
            // handle response if needed
            })
            .catch(() => {
            this.isSyncing = false;
            // handle error if needed
            });
        }
    }

    /**
     * Trigger an API action for the wishlist.
     * @param {string} url - The API endpoint URL.
     * @param {string} method - The HTTP method (e.g., 'DELETE').
     * @param {string} shareToken - The share token for the wishlist.
     */
    triggerAction(url, method, shareToken) {

        fetch(`/${url}`, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                share_token : shareToken 
            })
        })
        .then(response => response.json())
        .then(data => {
            console.log('Action response:', data);

            // Update UI based on response

            // Find the corresponding compare list wrapper using share token
            const wrapper = document.querySelector(`.tm-compare-list-wrapper[data-share-token="${shareToken}"]`);
            
            if (data.success && data.type === 'list cleared for user') {

                // Remove list from DOM and update UI
                this.deleteList(wrapper, shareToken);

            } else if (Array.isArray(data.data) && data.data.length === 0) {

                // If returned data is empty show empty message
                const listContainer = wrapper.querySelector('.tm-compare-list');

                // Remove grid from list container
                listContainer.classList.remove('tm-compare-grid');

                // Display empty message
                listContainer.innerHTML = this.EMPTY_MESSAGE;

            } else if(data.type === 'list deleted for all') {

                // If the list was deleted for all users, remove it from the DOM and show empty message if we are on the share page
                if (window.location.pathname.startsWith('/wishlist/share/')) {
                    document.querySelector('.entry-content').innerHTML = this.EMPTY_MESSAGE;
                }

                // Remove list from DOM and update UI
                this.deleteList(wrapper, shareToken);

            } else if(data.data === null) {

                // Check if the share_token in the response is in the current URL if it is this is a single
                // wishlist page and the list has been deleted so show the empty message and remove control buttons
                if (window.location.href.includes(shareToken)) {
                    document.querySelector('.active-list-controls').remove();
                }

                // If data is null, it means the list was deleted, so remove the entire wrapper
                this.deleteList(wrapper, shareToken);

                document.querySelector('.entry-content').innerHTML = this.EMPTY_MESSAGE;

            } else if (data.data) {

                // Otherwise update the compare list with returned data
                wrapper.querySelector('.tm-compare-list').innerHTML = data.data;

            }
        })
        .catch(error => {
            console.error('Error performing action:', error);
            // Handle error (e.g. show error message)
        });
    }

    /**
     * Handles sharing the wishlist link.
     * Uses the Web Share API if available, otherwise copies the share URL to the clipboard.
     * @param {HTMLElement} shareBtn - The share button element that was clicked.
     */
    shareWishlist(shareBtn) {

        // Extract share URL from data attribute
        const url = shareBtn.getAttribute('data-url');

        // If Web Share API is supported, use it to share the URL
        if (navigator.share) {

            // Extract list name for sharing title
            const listName = shareBtn.closest('.tm-compare-list-wrapper').querySelector('.tm-compare-list-name').textContent || 'Designs List';

            // Use Web Share API to share the URL with the list name as title
            navigator.share({
                title: listName,
                url: url
            }).catch(function(){});

        } else {

            // If Web Share API is not supported, copy the URL to the clipboard and show a temporary "Copied!" message

            // Fallback: copy to clipboard if Web Share API is not supported
            if (navigator.clipboard) {

                navigator.clipboard.writeText(url).then(function() {

                    // Save original button text and width
                    const originalText = shareBtn.textContent;

                    // Set a minimum width to prevent button from resizing when text changes
                    const originalWidth = shareBtn.offsetWidth;
                    shareBtn.style.minWidth = originalWidth + 'px';

                    // Change button text to 'Copied!'
                    shareBtn.textContent = 'Copied!';

                    // Revert to original after 2 seconds
                    setTimeout(function(){
                        shareBtn.textContent = originalText;
                        shareBtn.style.minWidth = '';
                    }, 2000);

                });

            } else {

                // Older fallback for browsers that do not support navigator.clipboard
                const tempInput = document.createElement('input');
                tempInput.value = url;
                document.body.appendChild(tempInput);
                tempInput.select();
                document.execCommand('copy');
                document.body.removeChild(tempInput);

                if (shareCopied) {
                    shareCopied.style.display = 'inline';
                    setTimeout(function(){ shareCopied.style.display = 'none'; }, 1500);
                }

            }

        }

    }

    /** ================= Inline Editing Methods ================= **/
    
    /**
     * Bind click events to edit list name buttons to allow inline editing of the list name,
     */
    updateListName() {

        // Add click listener to each edit list name button
        const editButtons = document.querySelectorAll('.edit-list-name');

        // If buttons exist, bind click event to update list name
        if (editButtons.length > 0) {

            editButtons.forEach(btn => {

                btn.addEventListener('click', (e) => {

                    // Prevent default button behavior
                    e.preventDefault();

                    // On mobile, also add a class to the parent element to adjust styling for the edit mode
                    if (window.innerWidth <= 768) {
                        btn.parentElement.classList.add('column');
                    }

                    // Close any open edit inputs before opening a new one
                    this.closeAllEditInputs();

                    // Open the edit input for the clicked button
                    this.openEditInput(btn);

                });
            });
        }
    }

    /**
     * Close all open edit inputs and restore their headers
     */
    closeAllEditInputs() {

        // Find all open edit inputs and restore their headers to close the edit mode
        document.querySelectorAll('.edit-list-name-input').forEach(input => {

            // Get current header from DOM
            const header = input.closest('.tm-compare-list-header');

            // Get current name from input value
            const currentName = input.value;

            // Restore the header to close the edit mode
            this.restoreHeader(header, currentName);

        });

    }

    /**
     * Open the edit input for the given button
     * @param {HTMLElement} btn - The edit button that was clicked to trigger the edit mode
     */
    openEditInput(btn) {

        // Get necessary elements and data from DOM
        const header = btn.closest('.tm-compare-list-header');
        const wrapper = btn.closest('.tm-compare-list-wrapper');
        const listNameEl = wrapper.querySelector('.tm-compare-list-name');
        const currentName = listNameEl.textContent;

        // Create input field with current name as value
        const input = this.createInput(currentName);

        // Create save button with click listener to save the new name
        const saveBtn = this.createSaveButton(() => {
            this.saveListName(input, wrapper, header, currentName);
        });

        // Replace header content with input and save button
        header.replaceChildren(input, saveBtn);

        // Focus the input field for immediate editing
        input.focus();

        // Add event listener to save the new name on Enter key press
        input.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') saveBtn.click();
        });

    }

    /**
     * Create an input element for editing the list name
     * @param {string} value - The current name of the list
     * @returns {HTMLInputElement} The created input element
     */
    createInput(value) {

        //Create input element for editing list name with current name as value
        const input = document.createElement('input');

        // Set input type, value and class for styling
        input.type = 'text';

        // If value is empty, set placeholder to prompt user to enter a name
        input.value = value;

        // Set input id for styling and identification
        input.id = 'edit-list-name-input';

        // Return input element
        return input;

    }

    /**
     * Create a save button element for saving the list name
     * @param {Function} onClick - The function to call when the button is clicked
     * @returns {HTMLButtonElement} The created save button element
     */
    createSaveButton(onClick) {

        // Create save button element
        const btn = document.createElement('button');

        // Set button type and classes for styling
        btn.type = 'button';

        // Add multiple classes for styling the save button
        btn.classList.add('save-list-name', 'tm-add-to-compare', 'btn', 'btn-outline-secondary', 'btn-sm', 'button', 'level-02');
        
        // Set button text to "Save"
        btn.textContent = 'Save';

        // Add click event listener to trigger the provided onClick function when the button is clicked
        btn.addEventListener('click', onClick);

        // Return the created button element
        return btn;
    }

    /**
     * Restore the header to its original state with the list name and edit button
     * @param {HTMLElement} header - The header element to restore
     * @param {string} name - The name to display in the header
     */
    restoreHeader(header, name) {

        // Create h3 element
        const newListNameEl = document.createElement('h3');

        // Set class names for element
        newListNameEl.classList.add('tm-compare-list-name');

        // Set text content to the provided name
        newListNameEl.textContent = name;
        
        // Create edit button element
        const newEditLink = document.createElement('button');
        
        // Set button type
        newEditLink.type = 'button';

        // Set class name for styling
        newEditLink.className = 'edit-list-name';

        // Add pencil icon to edit button
        const pencilIcon = document.createElement('icon');
        pencilIcon.className = 'fa-light fa-pen';
        newEditLink.appendChild(pencilIcon);

        // On mobile, also add a class to the parent element to adjust styling for the edit mode
        if (window.innerWidth <= 768) {
            header.classList.remove('column');
        }

        // Replace header content with the new list name element and edit button
        header.replaceChildren(newListNameEl, newEditLink);

        // Re-bind click event to the new edit button to allow editing again
        this.updateListName();
    }

    /**
     * Save the updated list name
     * @param {HTMLInputElement} input - The input element containing the new name
     * @param {HTMLElement} wrapper - The wrapper element containing the list
     * @param {HTMLElement} header - The header element to update
     * @param {string} currentName - The current name of the list
     */
    saveListName(input, wrapper, header, currentName, errorMsg) {

        // Get new name from input or fallback to current name if input is empty
        const newName = input.value.trim() || currentName;
        const isActiveList = wrapper.classList.contains('active');
        const shareToken = wrapper.dataset.shareToken;
        const userTokenMatch = document.cookie.match(/(?:^|; )tm_wishlist_user_token=([^;]*)/);
        const userToken = userTokenMatch ? userTokenMatch[1] : null;

        // Update list name via API call
        fetch(`/wp-json/tm-wishlist/v1/lists/${shareToken}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                list_name: newName, 
                user_token: userToken 
            })
        })
        .then(async response => {
            let data;
            try {
                data = await response.json();
            } catch (e) {
                data = {};
            }
            if (response.ok && data && data.success) {

                if(isActiveList) {
                    this.updateActiveListTitle(newName);
                }

                this.restoreHeader(header, newName);
            } else {
                
                // Define a generic error message
                let msg = 'Error updating list name. Please try again.';

                // If the response contains a specific error message, use it instead of the generic one
                if (data && data.message) {
                    msg = data.message; // Use specific error message from response if available
                }

                // Display error message to user
                this.displayError(input, msg);
                
            }
            console.log(data);
        })
        .catch(error => {
            console.error('Error updating list name:', error);

            // Display generic error message to user
            this.displayError(input, 'Error updating name. Try again.');
        });
    }

    /**
     * Display an error message for the input element
     * @param {HTMLInputElement} input - The input element to display the error for
     * @param {string} message - The error message to display
     */
    displayError(input, message) {

        // Add error class to input for styling
        input.classList.add('error');

        // Set custom validity message to display error to user
        input.setCustomValidity(message);

        // Trigger validation to show the error message
        input.reportValidity();

        // Remove error state after a delay to allow user to correct the input
        input.value = '';

        // Remove error class and custom validity after a delay
        input.removeAttribute('placeholder');

        // Focus the input to prompt user to enter a new name
        input.focus();

    }

    /** ================= Utility / Helper Methods ================= **/

    /**
     * Update the active list title in the header
     * @param {string} newTitle - The new title to set as active list title
     */
    updateActiveListTitle(newTitle) {

        // Update active wishlist title in header
        const activeTitle = document.querySelector('.active-list-span');

        if (activeTitle) {
            activeTitle.textContent = newTitle;
        }

    }

}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    new TMCompare();
});