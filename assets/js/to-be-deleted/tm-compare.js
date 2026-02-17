class TMCompare {

    constructor() {

        // Initialize properties
        this.shareToken = localStorage.getItem('tm_wishlist_share_token') || null;
        this.init();
    }

    /**
     * Initialize compare functionality
     */
    init() {
        this.addListeners();
        this.isWishlistCreator();
    }

    /**
     * Add event listeners to remove buttons and clear all button
     */
    addListeners() {

        // Select all remove buttons from DOM
        const removeBtns = document.querySelectorAll('.remove-from-compare');

        if(removeBtns.length > 0) {
        
            // Bind click event to each remove button
            removeBtns.forEach((btn) => {

                // Add click listener
                btn.addEventListener('click', (e) => {

                    // Prevent default link behavior
                    e.preventDefault();

                    // Call removeItem method
                    this.removeItem(e.currentTarget);

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
     * 
     * Determine if current user is the creator of the viewed wishlist
     * Check for share token in local storage and share token in URL
     * If share token at that share token in server matches, user is creator so show edit options
     * 
     * @returns 
     */
    isWishlistCreator() {

        // Extract share token from local storage if set
        const shareToken = localStorage.getItem('tm_wishlist_share_token') || null;

        // Exit if no share token in local storage (user is not a creator or has not shared wishlist)
        if(!shareToken) return;

        // If share token exists
        if(shareToken) {

            // Fetch compare data from server using share token
            fetch(`${TMCompareSettings.rest_get_url}${encodeURIComponent(shareToken)}`, {
                headers: { 'X-WP-Nonce': TMCompareSettings?.nonce || '' },
                credentials: 'include'
            })
            .then(res => {
                if (!res.ok) throw new Error('Network response was not ok');
                return res.json();
            })
            .then(data => {

                // If server returns a share token that matches the one in local storage, user is creator
                if(data && data.share_token && data.share_token === shareToken) {
                    
                    // Select edit controls from DOM
                    const editControls = document.querySelectorAll('.remove-from-compare, .compare-buttons');

                    // Show edit controls
                    editControls.forEach(el => {
                        el.style.visibility = 'visible';
                    });

                }

            })
            .catch(err => {
                console.error('Error verifying wishlist creator status:', err);
            });

        }

    }

    /**
     * Remove single item from compare list
     * @param {HTMLElement} btn - The button that was clicked
     */
    removeItem(btn) {

        // Get saved configs
        let configs = getSavedConfigs();

        // Get layers IDs from data attribute
        const idsArr = btn.getAttribute('data-layers-ids').split(',') || '';

        // Remove matching config
        configs = configs.filter(item => 
            ![...item.layerIds].every(id => idsArr.includes(String(id)))
        );

        this.saveItems(configs);
        document.dispatchEvent(new Event('tmWishlistUpdated'));

        // Remove the closest .tm-compare-item ancestor from DOM
        const itemEl = btn.closest('.tm-compare-item');
        if (itemEl) itemEl.remove();

    }

    /**
     * Clear all items from compare list
     */
    clearAll() {

        // Save empty list
        this.saveItems([]);

        // Dispatch event to notify other components
        document.dispatchEvent(new Event('tmWishlistUpdated'));

        // Remove all items from container
        document.querySelectorAll('.tm-compare-item').forEach(el => el.remove());

        // Select container element
        const container = document.querySelector('.tm-compare-list');

        // Show empty message
        if (container) {
            container.innerHTML = '<p>Wishlist empty, visit product pages to add items.</p>';
        }

    }

    async saveItems(items) {

        // Persist to localStorage
        localStorage.setItem('tm_wishlist_configs', JSON.stringify(items));

        // Update DB and refresh share state
        try {

            // Send to server
            const res = await fetch(TMCompareSettings.rest_save_url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': TMCompareSettings.nonce || ''
                },
                credentials: 'include',
                body: JSON.stringify({
                    share_token: this.shareToken || null,
                    data: items,
                    replace: true  
                })
            });

            // Exit if response not OK
            if (!res.ok) return;

            // Parse JSON response
            const data = await res.json();
            if (data && data.share_token) {
                this.shareToken = data.share_token;
                localStorage.setItem('tm_wishlist_share_token', this.shareToken);
            }

            // If server returns a share_url, keep the UI up to date
            if (data && data.share_url) {
                const shareBtn = document.querySelector('.compare-share .share-button');
                if (shareBtn) shareBtn.dataset.url = data.share_url;
                const link = document.getElementById('tm-compare-share-url');
                if (link) {
                    link.href = data.share_url;
                    link.textContent = data.share_url;
                }
            }
        } catch (err) {
            console.error('Error saving compare data to server:', err); 
        }
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    new TMCompare();
});