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

        // Update list names on edit button click
        this.updateListName();

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

        // Set button text content
        newEditLink.textContent = 'edit';

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
        const shareToken = wrapper.dataset.shareToken;
        const userTokenMatch = document.cookie.match(/(?:^|; )tm_wishlist_user_token=([^;]*)/);
        const userToken = userTokenMatch ? userTokenMatch[1] : null;
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

}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    new TMCompare();
});