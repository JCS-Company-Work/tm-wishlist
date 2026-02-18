class TMCompare {

    constructor() {

        // Initialize properties
        this.init();
    }

    init() {

        this.addControlBtnListeners();

        this.createList();

    }

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

    shareWishlist(shareBtn) {
        
        var url = shareBtn.getAttribute('data-url');

        if (navigator.share) {
            navigator.share({
                title: 'My TailorMade Wishlist',
                url: url
            }).catch(function(){});
        } else {
            // Fallback: copy to clipboard
            if (navigator.clipboard) {
                navigator.clipboard.writeText(url).then(function() {
                    if (shareCopied) {
                        shareCopied.style.display = 'inline';
                        setTimeout(function(){ shareCopied.style.display = 'none'; }, 1500);
                    }
                });
            } else {
                // Older fallback
                var tempInput = document.createElement('input');
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

}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    new TMCompare();
});