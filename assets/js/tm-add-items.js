/**
 * TMAddItems
 * Manages the client-side Compare list on product pages:
 * - Reads current product configuration from the DOM
 * - Stores items in localStorage (key configurable)
 * - Syncs list to the backend via WP REST API (guest or user scope)
 * - Emits a `tmWishlistUpdated` event on changes
 *
 * Data is persisted under `this.STORAGE_KEY` as an array of items.
 */
class TMAddItems {

  /**
   * @typedef {Object} TMAddItemsOptions
   * @property {string|null} [syncUrl]          REST save URL for guests
   * @property {string|null} [syncGetUrl]       REST get URL base for guests (append /{key})
   * @property {string|null} [userTokenUrl]       REST URL to fetch user token (if not included in settings)
   * @property {string|null} [nonce]            WP REST nonce
   */
  
  /**
   * @param {TMAddItemsOptions} [options]
   */
  constructor(options = {}) {

    // Configuration
    this.MAX_ITEMS = 6;
    this.STORAGE_KEY = 'tm_wishlist_configs';
    this.SYNC_URL = options.syncUrl || null;
    this.SYNC_GET_URL = options.syncGetUrl || null;
    this.USER_TOKEN_URL = options.userTokenUrl || null;

    this.nonce = options.nonce || null;

    // Mapping of config keys to CSS classes
    this.configKeyMap = {
      colour: 'obj-top-colour',
      veneer: 'obj-metal-edge-veneer',
      base: 'obj-base',
      model: 'obj-model'
    };

    // Bind event handlers
    this.onWishlistUpdated = this.onWishlistUpdated.bind(this);

    // Reference to wishlist status element
    this.wishlistStatus = document.querySelector('.tm-compare-status');

    // Initialize
    this.init();

    // On page load, check for cookie and clear localStorage if missing
    const cookieToken = document.cookie.match(/(?:^|; )tm_wishlist_share_token=([^;]*)/);
    console.log(cookieToken);
    if (!cookieToken) {
      localStorage.removeItem('tm_wishlist_share_token');
      localStorage.removeItem(this.STORAGE_KEY);
    }
    
  }

  /**
   * Add DOM listeners and fetch existing configs from db/localStorage.
   */
  init() {

    // Listen for wishlist updates
    document.addEventListener('tmWishlistUpdated', this.onWishlistUpdated);

    // On DOM ready
    document.addEventListener('DOMContentLoaded', () => {

      // Monitor layer/model changes
      this.monitorLayerChanges();

      // Add listener to add/remove buttons
      this.activateButtons();

      // Update wishlist counter
      this.updateWishlistCounter(getSavedConfigs().length);

      // Seed from server if applicable
      this.seedFromServer();
      
    });

  }

  /************ Event Wiring ************/

  /**
   * Activate add/remove buttons on the product page.
   */
  activateButtons() {

    // Select add/remove button from DOM
    const button = document.querySelector('.tm-add-to-compare');

    // If button exists, add click listener
    if (button) {

      button.addEventListener('click', (e) => {

        // Prevent default button action
        e.preventDefault();

        // Determine current state
        const isCurrentlyAdded = button.getAttribute('aria-pressed') === 'true';

        // Update button state
        this.setButtonState(button, !isCurrentlyAdded);

        // Extract product ID from button
        const productId = this.getProductId(button);

        // Toggle add/remove
        isCurrentlyAdded ? this.removeConfig(productId) : this.addConfig(productId);

      });

    }

  }

  /** 
   * Monitor layer/model changes to update button state.
   */
  monitorLayerChanges() {

    // Select add/remove button from DOM
    const button = document.querySelector('.tm-add-to-compare');

    // Ensure button is valid
    if (!button) return;

    // Get product ID
    const productId = this.getProductId(button);

    // Ensure product ID is present
    if (!productId) return;

    // Select all layer option inputs
    const layerInputs = document.querySelectorAll('.obj-top-colour input, .obj-metal-edge-veneer input, .obj-base input, .obj-model select');

    // Function to update button state
    const updateButtonState = () => {

      // Get saved configs
      const savedConfigs = getSavedConfigs();
      const currentConfig = this.getCurrentProductConfig();
      const matchIndex = this.findMatchingConfigIndex(savedConfigs, currentConfig, productId);

      // Update button state based on match
      this.setButtonState(button, matchIndex !== -1);

    };

    //Set initial state once DOM has applied any changes (two rAFs to ensure styles applied)
    requestAnimationFrame(() => requestAnimationFrame(updateButtonState))

    // Update state whenever selections change
    layerInputs.forEach(input => {

      input.addEventListener('change', () => {
        requestAnimationFrame(updateButtonState);
      });

    });

  }

  /**
   * 
   * Set the button state to added or not added.
   * 
   * @param {HTMLElement} button 
   * @param {boolean} isAdded 
   * @returns 
   */
  setButtonState(button, isAdded) {

    // Ensure button is valid
    if (!button) return;

    // Toggle styles and attributes
    button.classList.toggle('reverse-btn', !!isAdded);

    // Set aria-pressed attribute
    button.setAttribute('aria-pressed', isAdded ? 'true' : 'false');

    // Update button text
    button.textContent = isAdded ? 'Remove from wishlist' : 'Add to wishlist';

  }

  /************ Persistence & Sync ************/

  /**
   * Persist list to localStorage and sync to server if configured.
   * Also dispatches a `tmWishlistUpdated` event on `document`.
   * @param {TMCompareItem[]} configs
   */
  saveConfigs(configs) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(configs));
    if (this.SYNC_URL) {
      this.syncToServer(configs);
    }
    document.dispatchEvent(new Event('tmWishlistUpdated'));
  }

  /**
   * Sync the current wishlist to the server via REST API.
   * - Uses `this.SYNC_URL` for guests
   * - Payload includes `data` (array of configs) and optionally `generate_share` (boolean)
   * - On success, updates share token and share link in the UI if returned by the server
   * - Prevents parallel syncs with `this.isSyncing` flag
    * @param {TMCompareItem[]} configs
   */
  async syncToServer(configs) {

    // Prevent parallel syncs
    if (this.isSyncing) return;
    this.isSyncing = true;

    // Ensure user token exists
    const userToken = this.ensureUserToken();

    // Ensure save URL is configured
    const saveUrl = this.SYNC_URL;

    // Exit if no save URL
    if (!saveUrl) {
      this.isSyncing = false;
      return;
    }

    // Only request share token if not already present for this session
    const prevShareToken = localStorage.getItem('tm_wishlist_share_token');
    const shouldGenerateShare = !prevShareToken;

    // Prepare payload
    const payload = {
      data: configs,
      share_token: localStorage.getItem('tm_wishlist_share_token'),
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

          // Get previous values
          const prevShareToken = localStorage.getItem('tm_wishlist_share_token');

          // Only update if token has changed to avoid unnecessary UI updates
          if (data.share_token !== prevShareToken) {

            // Persist new share token
            localStorage.setItem('tm_wishlist_share_token', data.share_token);

            // Set cookie for server access (expires in 1 year)
            document.cookie = `tm_wishlist_share_token=${data.share_token}; path=/; SameSite=Lax; max-age=31536000`;

            //Update DOM wishlist links
            updateWishlistLinks();

          }

        }

        // Update share link if returned
        if (data.share_url) {
          this.updateShareLink(data.share_url);
        }
      }

    } catch (err) {

      console.error('Error syncing wishlist to server:', err);

    } finally {

      this.isSyncing = false;

    }
  }

  /**
   * Ensure user token exists in localStorage and cookie.
   * If missing, generate a new one (UUID).
   */
  async ensureUserToken() {
    let userToken = localStorage.getItem('tm_wishlist_user_token');
    if (!userToken) {
      try {
        const res = await fetch(this.USER_TOKEN_URL, { credentials: 'same-origin' });
        if (!res.ok) return null;
        const data = await res.json();
        const serverToken = data?.user_token || null;
        if (!serverToken) return null;
         // Generate a short random string
      //userToken = 'user-' + Math.random().toString(36).substr(2, 8);
      localStorage.setItem('tm_wishlist_user_token', serverToken);
      document.cookie = `tm_wishlist_user_token=${serverToken}; path=/; SameSite=Lax; max-age=31536000`;
        return serverToken;
      } catch(err) {
        console.error('Failed to fetch user token:', err);  
      }
     
    }
  }

  /**
   * Populate local list from the server when possible.
   * - Logged-in users: `SYNC_GET_URL_USER`
   */
  async seedFromServer() {
    
    // Use share token from localStorage
    const shareToken = localStorage.getItem('tm_wishlist_share_token');
    if (!this.SYNC_GET_URL || !shareToken) return;

    // Construct URL
    const url = `${this.SYNC_GET_URL}/${encodeURIComponent(shareToken)}`;

    try {
        const res = await fetch(url, {
            headers: {},
            credentials: 'omit'
        });

        if (!res.ok) return;

        const data = await res.json();

        // If server returns no data, clear local wishlist
        if (data && Array.isArray(data.data) && data.data.length === 0) {
            clearWishlistStorage();
            return;
        }

        // Persist returned data if valid
        if (data && Array.isArray(data.data)) {
            const existing = getSavedConfigs();
            if (data.data.length > 0 || existing.length === 0) {
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data.data));
                this.updateWishlistCounter(data.data.length);
            }
        }

        // Update share link if provided
        if (data.share_url) this.updateShareLink(data.share_url);

    } catch (err) {
        console.warn('Could not seed compare list from server', err);
    }
  }

  /************ DOM Extraction ************/

  /**
   * Read the currently selected configuration from the product page.
   * Uses `configKeyMap` to locate radio inputs and extract swatch names.
   * Also reads the large layered image (if present) and current URL (without tvembed param).
   * @returns {Partial<TMCompareItem>} Current configuration (without product_id/productName/price)
   */
  getCurrentProductConfig() {

    // Object to hold config
    const config = {};

    // Extract swatch selections
    Object.entries(this.configKeyMap).forEach(([key, cssClass]) => {

      // Special handling for model select
      if(key === 'model') {

        // Get the select element
        const selectEl = document.querySelector(`.${cssClass} select`);

        if (selectEl && selectEl.selectedIndex !== -1) {
          config[key] = selectEl.options[selectEl.selectedIndex].getAttribute('data-wapf-label');
        } else {
          config[key] = '';
        }
      } else {

        // Find checked input within the section
        const checkedInput = document.querySelector(`.${cssClass} input:checked`);
  
        // Extract data-wapf-label and add to config
        if (checkedInput) {

          config[key] = checkedInput.getAttribute('data-wapf-label');
  
        }

      }

    });

    // Get visible layered image IDs
    config.layerIds = this.getLayerIds();

    const url = new URL(window.location.href);
    url.searchParams.delete('tvembed');
    config.url = url.toString();

    return config;
  }

  /**
   * Extract IDs of visible layers from the layered image display.
   * 
   * @returns 
   */
  getLayerIds() {

    // Get all checked swatches from DOM
    const checkedSwatches = document.querySelectorAll('.wapf-checked');

    // Map to their data-ids
    const wapfIds = [...checkedSwatches].map(swatch => swatch.querySelector('input').value);

    // Get the status image container
    const statusImage = document.querySelector('.status-image');

    // Map wapfIds to layer data-ids
    const layerIds = wapfIds.map(swatchId => {

      // Find corresponding layer in status image
      const layer = statusImage.querySelector(`[data-value="${swatchId}"]`);

      // Return data-id or null
      return layer ? layer.getAttribute('data-id') : null;

    });

    // Return ids in reverse order to ensure that layered images stack correctly on wishlist page
    return layerIds.reverse();

  }

  /**
   * 
   * Extract product ID from a button element.
   * 
   * @param {HTMLElement} target 
   * @returns 
   */
  getProductId(target) {

    return target.getAttribute('data-product-id');

  }

  /**
   * Convert a dashed swatch slug into Title Case words.
   * @param {string} str
   * @returns {string}
   */
  formatSwatchName(str) {
    if (!str) return '';
    return str
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /************ DOM Extraction ************/

  /**
   * Normalize a layersIds array into a deterministic signature string.
   * Sorts numeric IDs and joins with '|'.
   * @param {Array<number|string>} ids
   * @returns {string}
   */
  normalizeLayersSignature(ids) {
    if (!Array.isArray(ids)) return '';
    const normalized = ids
      .map(id => parseInt(id, 10))
      .filter(n => Number.isFinite(n) && n > 0)
      .sort((a, b) => a - b)
      .join('|');
    return normalized;
  }

  /**
   * Check to see if two configurations are equal.
   * @param {Object} configA
   * @param {Object} configB
   * @returns {boolean}
   */
  areConfigsEqual(configA, configB) {

    // Fallback deep-equality for non-layerIds fields if ever needed
    // Prefer layerIds signature comparisons elsewhere.
    const keysA = Object.keys(configA);
    const keysB = Object.keys(configB);

    // Quick length check
    if (keysA.length !== keysB.length) return false;

    // Check each key
    for (let key of keysA) {

      // Skip url check as we can have a default configuration created by user navigation
      // which means params are included in the url and will differ from default
      if(key !== 'url') {

        // Get values
        const a = configA[key];
        const b = configB[key];
  
        // Special handling for layerIds array
        if (Array.isArray(a) && Array.isArray(b)) {
  
          // Compare normalized signatures
          const sigA = this.normalizeLayersSignature(a);
          const sigB = this.normalizeLayersSignature(b);
  if (sigA !== sigB) {
    console.log(key);
    console.log(sigA);
    console.log(sigB);
  }
          // Compare normalized signatures
          if (sigA !== sigB) return false;
  
        } else if (a !== b) {
  
          // Mismatch found
          return false;
  
        }

      }

    }

    // All keys matched
    return true;

  }

  /**
   * Check for matching configurations already in saved list.
   *
   * @param {string} checkType
   * @param {Array} savedConfigs
   * @param {object} currentConfig
   * @param {string} productId
   * @returns {boolean}
   */
  findMatchingConfigIndex(savedConfigs, currentConfig, productId) {

    // Ensure savedConfigs is an array
    if (!Array.isArray(savedConfigs)) return false;

    // Find index of matching config
    const index = savedConfigs.findIndex(config => {

      // Check product ID match
      if (String(config.product_id) !== String(productId)) {
        return false;
      }

      // Create a copy excluding non-config fields
      const copy = { ...config };

      // Remove non-config fields
      delete copy.product_id;
      delete copy.productName;
      delete copy.price;

      // Compare configurations
      console.log(this.areConfigsEqual(copy, currentConfig));
      return this.areConfigsEqual(copy, currentConfig);

    });

    // Return -1 if not found
    return index; 

  }

  /************ Actions ************/

  /**
   * Add current product configuration to compare list.
   * @param {string} productId
   */
  addConfig(productId) {

    // Ensure product ID is present
    if (!productId) return;
    
    // Get current saved configs
    const priceEl = document.querySelector('.status-price');
    const price = priceEl ? priceEl.textContent.trim() : '';
    const productNameEl = document.querySelector('.product-model-title');
    const productName = productNameEl ? productNameEl.textContent.trim() : '';

    const savedConfigs = getSavedConfigs();

    // Get current config
    const currentConfig = this.getCurrentProductConfig();

    // Check for matches (product_id + layerIds signature)
    const match = this.findMatchingConfigIndex(savedConfigs, currentConfig, productId);

    // Handle matches and limits
    if (match !== -1) {

      // Update status text
      this.statusText('This configuration is already in your compare list.');
      return;

    }

    // Enforce max items
    if (savedConfigs.length >= this.MAX_ITEMS) {

      // Update status text
      this.statusText(`You can only compare up to ${this.MAX_ITEMS} products.`);
      return;

    }

    // Add new config
    savedConfigs.push({
      product_id: productId,
      productName,
      price,
      ...currentConfig
    });

    // Save updated list
    this.saveConfigs(savedConfigs);

    // Update status text
    this.statusText('Product added to wishlist.');

  }

  /**
   * Remove current product configuration from compare list.
   * @param {string} productId
   */
  removeConfig(productId) {

    // Ensure product ID is present
    if (!productId) return;

    // Get current saved configs
    const savedConfigs = getSavedConfigs();

    // Get current config
    const currentConfig = this.getCurrentProductConfig();

    // Check for matches (product_id + layerIds signature)
    const match = this.findMatchingConfigIndex(savedConfigs, currentConfig, productId);

    // If found, remove it
    if (match !== -1) {

      // Remove from array
      savedConfigs.splice(match, 1);

      // Save updated list
      this.saveConfigs(savedConfigs);

    }

    // Update status text
    this.statusText('Product removed from wishlist.');

  }

  /************ UI Updates ************/

  /**
   * Handler for `tmWishlistUpdated` event.
   * Updates the wishlist counter.
   */
  onWishlistUpdated() {
    this.updateWishlistCounter(getSavedConfigs().length);
  }

  /**
   * Animate the cart counter after adding an item
   */
  updateWishlistCounter(wishlistCount) {

      // Select the compare counter from DOM
      const cartCounter = document.querySelector('span.header-compare-count');

      // If element exists, update it
      if (cartCounter) {

          // Update the count
          cartCounter.textContent = wishlistCount;

          // Trigger animation
          cartCounter.classList.add('cart-animate');

          // Remove animation class after animation ends
          cartCounter.addEventListener('animationend', function handler() {
              cartCounter.classList.remove('cart-animate');
              cartCounter.removeEventListener('animationend', handler);
          });
      }
  }

  /**
   * 
   * Display a temporary status message in the wishlist status element.
   * 
   * @param {string} message 
   */
  statusText(message) {

    // Update status text
    this.wishlistStatus.innerText = message;

    // Show the status text
    this.wishlistStatus.classList.remove('hidden');
    this.wishlistStatus.classList.add('visible');

    // Hide after 1.5 seconds
    setTimeout(() => {

      this.wishlistStatus.classList.remove('visible');
      this.wishlistStatus.classList.add('hidden');

    }, 1500);

  }

  /**
   * Update the visible share link UI when a new `share_url` is available.
   * @param {string} shareUrl
   */
  updateShareLink(shareUrl) {
    const container = document.getElementById('tm-compare-share-link');
    const link = document.getElementById('tm-compare-share-url');
    if (container && link) {
      link.href = shareUrl;
      link.textContent = shareUrl;
      container.style.display = 'block';
    }
  }

}

// Instantiate
new TMAddItems({
  syncUrl: window.TMAddItemsSettings?.rest_save_url || null,
  syncGetUrl: window.TMAddItemsSettings?.rest_get_url || null,
  userTokenUrl: window.TMAddItemsSettings?.user_token || null,
  nonce: window.TMAddItemsSettings?.nonce || null,
});