/**
 * TMAddItems
 * Manages the client-side Compare list on product pages:
 * - Reads current product configuration from the DOM
 * - Stores items in localStorage (key configurable)
 * - Syncs list to the backend via WP REST API
 *
 * Data is persisted under `this.STORAGE_KEY` as an array of items.
 */
class TMAddItems {

  /**
   * Initialize the class, set up event listeners, and seed data from server if applicable.
   */
  constructor() {

    // API endpoints and settings from global WordPress-localized object (window.TMWLSettings)
    this.MAX_ITEMS = window.TMWLSettings?.max_items || 6;
    this.STORAGE_KEY = window.TMWLSettings?.storage_key || 'tm_wishlist_configs';
    this.SYNC_URL = window.TMWLSettings?.rest_save_url || null;
    this.SYNC_GET_URL = window.TMWLSettings?.rest_get_url || null;
    this.USER_TOKEN_URL = window.TMWLSettings?.user_token || null;
    this.nonce = window.TMWLSettings?.nonce || null;

    // Add isSyncing property
    this.isSyncing = false;

    // Mapping of config keys to CSS classes
    this.configKeyMap = {
      colour: 'obj-top-colour',
      veneer: 'obj-metal-edge-veneer',
      base: 'obj-base',
      model: 'obj-model'
    };

    // Initialize
    this.init();
    
  }

  /**
   * Add DOM listeners and fetch existing configs from db/localStorage.
   */
  init() {

    // Monitor layer/model changes
    this.monitorLayerChanges();

    // Add listener to add/remove buttons
    this.activateButtons();

    // Seed from server if applicable
    this.seedFromServer();
      
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
      const savedConfigs = getSavedConfigs();
      this.updateButtonState(button, savedConfigs);
    };

    //Set initial state once DOM has applied any changes (two rAFs to ensure styles applied)
    requestAnimationFrame(() => requestAnimationFrame(updateButtonState));

    // Update state whenever selections change
    layerInputs.forEach(input => {
      input.addEventListener('change', () => {
        requestAnimationFrame(updateButtonState);
      });
    });

  }

  /**
   * Update the add/remove button state based on current config and saved configs.
   * @param {HTMLElement} button
   * @param {Array} savedConfigs
   */
  updateButtonState(button, savedConfigs) {

    // Ensure button is valid
    if (!button) return;
    
    // Get product ID
    const productId = this.getProductId(button);
    
    // Ensure product ID is present
    if (!productId) return;

    // Get current product config
    const currentConfig = this.getCurrentProductConfig();
    
    // Find if current config matches any saved config for this product
    const matchIndex = this.findMatchingConfigIndex(savedConfigs, currentConfig, productId);
    
    // Set button state to "added" if a match is found, otherwise "not added"
    this.setButtonState(button, matchIndex !== -1);

  }

  /**
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
   * @param {TMCompareItem[]} configs
   */
  async saveConfigs(configs) {

    // Check cookies for user token
    let userToken = getCookie('tm_wishlist_user_token');

    // If not present in cookies, generate a new one
    if (!userToken) {
      userToken = await this.generateUserToken();
    }

    // Return if user token is missing
    if (!userToken) return;

    // Get share token from local storage
    let shareToken = localStorage.getItem('tm_wishlist_share_token') ?? null;

    if (shareToken) {

      // If share token exists, update existing list on server
      this.updateExistingList(userToken, shareToken, configs);

    } else {

      // If no share token, create new list on server and wait for share token
      shareToken = await this.createList(userToken, configs);

      if (shareToken) {
        this.updateExistingList(userToken, shareToken, configs);
      }

    }

  }

  /**
   * Create a new wishlist list.
   * @param {string} userToken
   * @param {TMCompareItem[]} configs
   */
  async createList(userToken, configs) {
    // If no share token, create new list
    return fetch('/wp-json/tm-wishlist/v1/lists/new', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_token: userToken,
        data: configs
      })
    })
      .then(response => response.json())
      .then(data => {
        // If list created successfully, store share token and update localStorage
        if (data?.success) {
          // Set share token in localStorage for potential use in share page
          localStorage.setItem('tm_wishlist_share_token', data.share_token);

          // Update localStorage with new share token
          const newShareToken = data.share_token;

          // Get all user lists from localStorage or initialize
          let allUserLists = {};
          try {
            // Attempt to parse existing localStorage data
            allUserLists = JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || {};
          } catch {
            // If parsing fails, log a warning and reset to an empty object to allow saving new data
            allUserLists = {};
            console.warn('Failed to parse wishlist data from localStorage during share token update. Resetting to empty object.');
          }
          // Ensure user token structure exists
          if (!allUserLists[userToken]) {
            allUserLists[userToken] = {};
          }

          // Set new share token list to current configs
          allUserLists[userToken][newShareToken] = configs;

          // Save back to localStorage
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(allUserLists));

          // Update view wishlist button and /wishlist menu item links
          updateWishlistLinks();

          return newShareToken;

        }
        return null;
      });

  }

  /**
   * Update an existing wishlist list.
   * @param {string} userToken
   * @param {string} shareToken
   * @param {TMCompareItem[]} configs
   */
  updateExistingList(userToken, shareToken, configs) {

    const allUserLists = getAllListsForUser(userToken, this.STORAGE_KEY);

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
   * Generate a user token by making a request to the server.
   * - If successful, stores the token in a cookie and returns it.
   * - If the request fails or no token is returned, logs an error and returns null.
   * @returns {Promise<string|null>} The generated user token or null if failed.
   */
  async generateUserToken() {

    // If no user token URL is configured, log an error and return null
    if (!this.USER_TOKEN_URL) {
      console.error('User token URL is not configured.');
      return null;
    }

    try {

      // Make request to server to generate user token
      const res = await fetch(this.USER_TOKEN_URL, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin'
      });

      // Data response
      const data = await res.json();

      // If user token is returned, set it in cookies and return
      if (data?.user_token) {

        document.cookie = `tm_wishlist_user_token=${data.user_token}; path=/; SameSite=Lax; max-age=31536000`;
        return data.user_token;

      }

      // If no token returned, log an error and return null
      console.error('User token was not returned by the server.');
      return null;

    } catch (err) {

      // If an error occurs during the request, log the error and return null
      console.error('Failed to generate user token:', err);
      return null;

    }

  }

  /**
   * Populate local list from the server when possible.
   * - Logged-in users: `SYNC_GET_URL_USER`
   */
  async seedFromServer() {

    // Use user token from cookie
    const userToken = getCookie('tm_wishlist_user_token');

    // If no sync URL or user token, clear local storage and exit
    if (!this.SYNC_GET_URL || !userToken) {

      // Attempt to recover user token, if not clear storage to avoid stale data
      await this.recoverUserToken();
      
      return;
    }

    // Construct URL for user lists
    const url = `${this.SYNC_GET_URL}?user_token=${encodeURIComponent(userToken)}`;

    try {
        const res = await fetch(url, {
            headers: {},
            credentials: 'omit'
        });

        if (!res.ok) return;

        const data = await res.json();

        // If server returns no data, clear local wishlist
        if (data && Array.isArray(data.lists) && data.lists.length === 0) {
            clearWishlistStorage();
            return;
        }

        // Persist returned data if valid
        if (data && Array.isArray(data.lists)) {

          // Get all user lists from localStorage or initialize empty object
          let allUserLists = {};

          // Process data
          try {

            // Attempt to parse localstorage data
            allUserLists = JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || {};

          } catch {

            // If parsing fails, log a warning and reset to an empty object to allow seeding new data
            allUserLists = {};
            console.warn('Failed to parse existing wishlist data from localStorage. Resetting to empty state.');

          }

          // Build nested structure: userToken -> shareToken -> configs
          // Ensure user token structure exists
          allUserLists[userToken] = {};

          // Iterate over lists returned by server and populate user's lists
          data.lists.forEach(list => {
            allUserLists[userToken][list.share_token] = list.data || [];
          });

          // Save back to localStorage
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(allUserLists));

        }

    } catch (err) {
        // If any error occurs during fetch or processing, log a warning and do not seed data
        console.warn('Could not seed compare list from server', err);
    }

  }

  /**
   * Attempt to recover or set user token if possible.
   * - If configs exist, assume user token is present.
   * - If only share token exists, attempt to fetch user token from backend (not implemented here, placeholder for extension).
   */
  async recoverUserToken() {

    // Get user token from cookies and share token from local storage
    const configs = localStorage.getItem(this.STORAGE_KEY);
    const shareToken = localStorage.getItem('tm_wishlist_share_token');

    if (configs) {
      // Attempt recovery with configs first as user token is part of data structure
      const parsedConfigs = JSON.parse(configs);
      const userToken = Object.keys(parsedConfigs)[0];

      // If user token is found in configs, set it in cookies
      if (userToken) {
        document.cookie = `tm_wishlist_user_token=${userToken}; path=/; SameSite=Lax; max-age=31536000`;

        // Update button state using refactored method
        const button = document.querySelector('.tm-add-to-compare');
        if (button) {
          const savedConfigs = parsedConfigs[userToken] ? Object.values(parsedConfigs[userToken]).flat() : [];
          this.updateButtonState(button, savedConfigs);
        }
        return;
      }
    } else if (shareToken) {
      // If only share token exists, attempt to recover user token from backend using the share token
      fetch(`/wp-json/tm-wishlist/v1/lists/${shareToken}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
      })
      .then(response => response.json())
      .then(data => {
        if (data && data.user_token) {
          // Set user token in cookies
          document.cookie = `tm_wishlist_user_token=${data.user_token}; path=/; SameSite=Lax; max-age=31536000`;
          // Update button state using refactored method
          const button = document.querySelector('.tm-add-to-compare');
          if (button && data.data) {
            const savedConfigs = Object.values(data.data).flat();
            this.updateButtonState(button, savedConfigs);
          }
          // Seed data from server now that we have the user token
          this.seedFromServer();
        }
      })
      .catch(err => {
        console.warn('Failed to recover user token using share token:', err);
      });
    } else {
      // If no data exists, clear storage to avoid stale data
      clearWishlistStorage();
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

    // Get current saved configs for user
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
   * 
   * Display a temporary status message in the wishlist status element.
   * 
   * @param {string} message 
   */
  statusText(message) {

    // Reference to wishlist status element
    const wishlistStatus = document.querySelector('.tm-compare-status');

    // Update status text
    wishlistStatus.innerText = message;

    // Show the status text
    wishlistStatus.classList.remove('hidden');
    wishlistStatus.classList.add('visible');

    // Hide after 1.5 seconds
    setTimeout(() => {

      wishlistStatus.classList.remove('visible');
      wishlistStatus.classList.add('hidden');

    }, 1500);

  }

}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    new TMAddItems();
});