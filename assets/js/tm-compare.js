class TMCompare {

    constructor() {

        // Initialize properties
        this.init();
    }

    init() {

        // Initialize share button listeners
        this.addControlBtnListeners();

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

    }

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
                    
                    // Query appropriate API based on action
                    switch(action) {
                        case 'share_wishlist':
                            this.shareWishlist(e.currentTarget);
                            break;
                        case 'clear_wishlist':
                            this.triggerAction(`wp-json/tm-wishlist/v1/lists/${share_token}/items`, 'DELETE', share_token);
                            break;
                        case 'delete_list_me':
                            this.triggerAction(`wp-json/tm-wishlist/v1/lists/${share_token}/user`, 'DELETE', share_token);
                            break;
                        case 'delete_list_all':
                            this.triggerAction(`wp-json/tm-wishlist/v1/lists/${share_token}`, 'DELETE', share_token);
                            break;
                        default:
                            console.warn('Unknown action:', action);
                    }

                });

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

            if (Array.isArray(data.data) && data.data.length === 0) {
                
                // If returned data is empty show empty message
                wrapper.querySelector('.tm-compare-list').innerHTML = '<p>Your wishlist is empty.</p>';

            } else if(data.data === null) {

                // If data is null, it means the list was deleted, so remove the entire wrapper
                wrapper.remove();

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
            const listName = shareBtn.closest('.tm-compare-list-wrapper').querySelector('.tm-compare-list-name').textContent || 'My Wishlist';

            // Use Web Share API to share the URL with the list name as title
            navigator.share({
                title: listName,
                url: url
            }).catch(function(){});

        } else {

            // Fallback: copy to clipboard if Web Share API is not supported
            if (navigator.clipboard) {

                navigator.clipboard.writeText(url).then(function() {
                    if (shareCopied) {
                        shareCopied.style.display = 'inline';
                        setTimeout(function(){ shareCopied.style.display = 'none'; }, 1500);
                    }
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
                    console.log('Action response:', data);

                    // Add new list to the compare page
                    const lists = document.querySelector('.tm-wishlist-lists');
                    const newListHTML = data.list_html;
                    if (lists && newListHTML) {
                        lists.insertAdjacentHTML('afterbegin', newListHTML);
                    }
                });

            });
        }
    }

    /**
     * Toggle the visibility of compare lists
     */
    toggleList() {

        // Add click listener to list toggle buttons
        const toggleButtons = document.querySelectorAll('.list-toggle');

        // Check if toggle buttons exist in DOM
        if (toggleButtons.length > 0) {

            // Loop through toggle buttons and add click listener
            toggleButtons.forEach((btn) => {

                btn.addEventListener('click', () => {

                    // Toggle active class on button
                    btn.classList.toggle('active');

                    // Toggle open/close state for the wrapper and list
                    const wrapper = btn.closest('.tm-compare-list-wrapper');

                    // Toggle open class on the compare list within the wrapper
                    const compareList = wrapper.querySelector('.tm-compare-list');

                    // Toggle open class to show/hide the list
                    if (compareList) {
                        compareList.classList.toggle('open');
                    }

                });

            });

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
     * On page load, check for active list share token in cookies 
     * and set the corresponding list as active, also scroll to it
     */
    setActiveListOnInit() {

        // Get share token from cookie
        const cookieMatch = document.cookie.match(/(?:^|; )tm_wishlist_share_token=([^;]*)/);
        const shareToken = cookieMatch ? cookieMatch[1] : null;

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
                        // Set cookie with share token to remember active list
                        document.cookie = `tm_wishlist_share_token=${shareToken}; path=/; max-age=31536000`; // Expires in 1 year

                        // Remove active class from all icons and toggle buttons
                        document.querySelectorAll('.list-active').forEach(el => el.classList.remove('selected'));
                        //document.querySelectorAll('.list-toggle').forEach(el => el.classList.remove('active'));
                        document.querySelectorAll('.tm-compare-list-wrapper').forEach(el => el.classList.remove('active'));
                        
                        // Add active class to the clicked icon's wrapper and toggle button
                        wrapper.classList.add('active');

                        // Add active class to clicked icon and its toggle button       
                        icon.classList.add('selected');
                        // const toggleBtn = icon.closest('.tm-compare-list-wrapper').querySelector('.list-toggle');
                        // if (toggleBtn) {
                        //     toggleBtn.classList.add('active');
                        // }

                        // Extract new list title from DOM
                        const newTitle = wrapper.querySelector('.tm-compare-list-name').textContent;

                        // Update active list title
                        this.updateActiveListTitle(newTitle);

                    }

                });

            });
        }

    }

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