TM Wishlist
===================

Lightweight WooCommerce product comparison plugin with shareable lists. Stores selections in localStorage and syncs to the site via WordPress REST API. Provides a shortcode-rendered compare page and a small client-side UI to add/remove items.

Overview
--------

Features
--------
- Adds “Add to Compare” buttons to WooCommerce product pages.
- Stores selected products and their configurations in localStorage for each user/session.
- Syncs wishlist data to the WordPress backend via REST API, supporting both guests (session key) and logged-in users (user ID).
- Provides a compare page via shortcode, rendering a grid of selected products and their details.
- Allows users to remove individual items or clear the entire wishlist, with changes reflected both locally and on the server.
- Supports shareable wishlist links using a unique token; anyone with the link can view the list, but only the creator can edit.
- Ensures backend security: only the session owner or logged-in user can modify their wishlist, even if frontend controls are manipulated.
- Deduplicates items based on product ID and configuration, with a configurable maximum number of items.
- Includes optional header rollover UI for quick wishlist access.
- Handles canonical tags for shared pages to ensure correct SEO and sharing behavior.
- Provides troubleshooting tips for REST API, shortcode rendering, and frontend transitions (Barba.js).

Overview
--------
- Frontend adds an “Add to Compare” button on product pages and a compare page rendering via shortcode.
- Client state lives in `localStorage` under `tm_compare_configs` and syncs to a DB table via REST.
- Session identity:
  - Guests: a generated `session_key` ties the browser to a row in the DB.
  - Logged-in users: a single row per user (`user_id`) is maintained.
- Shareable links: server returns a `share_token` and `share_url` that anyone can open to view the list.

Structure
---------

- tm-wishlst.php: Plugin bootstrap, constants, autoload, activation hook.
- src/TMWL_Main.php: Asset registration/enqueue, shortcode, UI button, session key logic.
- src/TMWL_ComparisonManager.php: REST endpoints, DB schema (create table), merge/upsert logic.
- src/TMWL_Assets.php: Asset management and enqueuing.
- assets/js/
  - tm-add-items.js: Add-to-compare button logic, localStorage, REST sync, share link handling.
  - tm-compare.js: Compare page interactions (remove/clear, sync back to REST).
  - tm-core.js: Core shared logic for wishlist features.
- assets/css/
  - tm-compare.css: Styles for compare list UI.

Installation
------------
1. Ensure the folder is placed at `wp-content/plugins/tm-product-compare`.
2. Activate in WP Admin → Plugins.
3. On activation, the plugin creates the table `wp_tm_product_comparisons` (prefix varies). If needed, deactivate/reactivate to re-run the hook.
4. Pretty permalinks recommended for clean REST URLs; otherwise use the `index.php?rest_route=` form.

Usage
-----
- Add-to-compare button appears automatically on single product pages via `woocommerce_single_product_summary` at priority 35.
- Create a page and insert the shortcode `[compare_products]` to render the comparison grid.
- Alternatively, the plugin also enqueues compare assets on a page with slug `compare-products`.

Client Flow
-----------
1. On a product page, clicking “Add to Compare” reads the current configuration:
   - Top colour, base colour, metal edge (from specific DOM classes),
   - Product layered image URL (`layersImg`),
   - Product name and price.
2. Items are stored in `localStorage` under `tm_compare_configs` (max items = 6).
3. The list is POSTed to the server to persist and obtain a `session_key` and optional `share_url`.
4. On the compare page, the list is rendered from localStorage; remove and clear actions sync back to the server.

Data Model (localStorage item)
------------------------------
Each item resembles:
```
{
  product_id: string,
  productName: string,
  price: string,
  layersImg: string,
  colour: string,        // Top Colour
  secondcolour: string,  // Base Colour
  metalcolour: string,   // Metal Banding
  url: string            // Product page URL
}
```

REST API
--------
Namespace: `tm-compare/v1`

- Save/Upsert
  - Method: POST
  - Path: `/wp-json/tm-compare/v1/save`
  - Body (JSON):
    - `session_key: string|null` (optional for first save)
    - `data: array` (list of items)
    - `generate_share: bool` (optional; generates `share_token` and `share_url`)
    - `replace: bool` or `mode: "replace"` (optional; when true, server overwrites stored data with the provided list; default is merge)
  - Response (JSON): `{ success: true, session_key, share_token?, share_url? }`

- Get by key (session or share token)
  - Method: GET
  - Path: `/wp-json/tm-compare/v1/get/{key}`
  - Response (JSON): `{ session_key, data: [], share_token, user_id }` (returns empty `data` if not found; no 404)

DB Schema
---------
Table: `{prefix}tm_product_comparisons`

```
id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
session_key VARCHAR(64) NOT NULL,
user_id BIGINT UNSIGNED NULL,
data LONGTEXT NOT NULL,          // JSON-encoded items
share_token VARCHAR(64) NULL,    // unique token for sharing
created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
KEY (session_key), KEY (user_id), UNIQUE KEY (share_token)
```

Session Identity
----------------
- `src/TMProductCompare.php::get_session_key()` sources a session key from:
  - Cookie `tm_compare_session_key` (if present), or
  - User meta `tm_compare_session_key` for logged-in users (generated if missing), or
  - `null` (guest with no prior interaction).
- The JS (`tm-add-items.js`) updates localStorage with a new `session_key` after the first save.
- Optional cookie helper: `assets/js/tm-session.js` mirrors the localStorage `tm_compare_session_key` into a cookie so PHP can detect it. This script is not enqueued by default.

Shortcodes
----------
- `[compare_products]`: Renders the saved items for the current session (or a shared list if `?share=TOKEN` is present). Implemented in `src/TMProductCompare.php::compare_shortcode()`.
- `[tm_wishlist_rollover]` (optional): Renders a minimal header rollover container. Implemented in `src/TMWishlistRollover.php` (its class init is currently commented out in the bootstrap).

Enqueued Assets
---------------
- Always on frontend: `tm-wishlist-rollover.js`, `tm-wishlist-rollover.css`.
- On single product pages: `tm-add-items.js`.
- On compare pages (shortcode present or page slug `compare-products`): `tm-compare.js`, `tm-compare.css`.

Limits and Deduplication
------------------------
- Max items: 6 (change via `TMProductCompare::MAX_ITEMS`).
- Deduplication: Same `product_id` + identical configuration (compares config fields excluding `product_id`, `productName`, `price`).

Shareable Links
---------------
- The server returns a `share_url` and `share_token` from POST `/save` when `generate_share: true` and no prior token exists.
- Anyone can view a shared list via:
  - JSON: `/wp-json/tm-compare/v1/get/{share_token}`
  - Page: `/wishlist/share/{share_token}/` (or `/compare-products/?share={share_token}`)
- To share a wishlist, copy the generated link containing the share token and send it to others.
- When viewing a shared wishlist, the plugin checks if the current session key matches the creator's session key:
  - If it matches, edit/copy/clear buttons are shown and the list is editable.
  - If it does not match, the list is view-only and edit controls are hidden.
- This ensures only the original creator can modify a shared wishlist, even if frontend controls are manipulated.

Developer Notes
---------------
- REST URL generation uses `rest_url()`; base is `/wp-json`. Manual hits to `/tm-compare/v1/...` (without `/wp-json`) will 404.
- If `/wp-json` 404s, resave Permalinks or use: `/index.php?rest_route=/tm-compare/v1/get/{key}`.
- The rollover JS renders into `#tmWishlistRollover`. If you want the shortcode-driven markup instead, enable `TMWishlistRollover::init()` in the bootstrap.
- `tm-session.js` is a helper for cookie mirroring and share-button copy UI; enqueue it if PHP-side cookie reads are desired for guests.

Troubleshooting
---------------
- Table missing: deactivate/activate the plugin to run the activation hook, or create the table manually from the schema above.
- REST 404: check `/wp-json` is reachable; flush permalinks; fall back to `index.php?rest_route=` form.
- Nothing appears on compare page: ensure the page has `[compare_products]` or slug `compare-products`, and that items are present in localStorage or stored via REST.
- Duplicate items: verify the product’s DOM provides consistent configuration values; dedup compares config fields only.

End-to-End Interactions
-----------------------
- Add Item (product page):
  - Reads current configuration from the product DOM (top/base/metal colours, `layersImg`, name, price).
  - Appends to localStorage `tm_compare_configs` (max 6, dedup by `product_id` + `layersImg`).
  - POSTs to `/wp-json/tm-compare/v1/save` with the full list; server returns or confirms `session_key` and may return `share_url`.
  - Emits `tmWishlistUpdated` so UI counters/widgets can refresh.
  - Code: [tm-add-items.js](tm-store-new/app/public/wp-content/plugins/tm-product-compare/assets/js/tm-add-items.js)

- Remove Item (compare page):
  - Removes the item from localStorage and re-renders the list.
  - Sends `/save` with `replace: true` and the remaining list so the server exactly mirrors the local state.
  - Awaits response, updates stored `session_key` (if changed) and share UI, then emits `tmWishlistUpdated`.
  - Code: [tm-compare.js](tm-store-new/app/public/wp-content/plugins/tm-product-compare/assets/js/tm-compare.js)

- Clear All (compare page):
  - Empties localStorage `tm_compare_configs`.
  - Sends `/save` with `replace: true` and `data: []` to clear the server-side list.
  - Updates share UI (share token remains if already created; URL still resolves to empty data).
  - Emits `tmWishlistUpdated`.

- Page Load (product page):
  - Seeds localStorage from server if needed, then updates the counter and marks already-added buttons.
  - Keeps `session_key` cached in localStorage (and optionally mirrored to cookie).

- Page Load (compare page):
  - Seeds localStorage from server when viewing your own session and the local list is empty, so the grid shows what’s stored.
  - When viewing a shared list (`?share=TOKEN`), loads that data but does not persist changes unless you explicitly save.

- Share:
  - If `generate_share: true` is sent and no token exists, server creates a `share_token` and returns a `share_url`.
  - Anyone can open the share URL to view the list; your local session remains unchanged.

- Events and Counters:
  - `tmWishlistUpdated` is dispatched on add/remove/clear and after seed/save; use it to refresh counters or UI elements.
  - Counter widgets should read from localStorage and/or re-fetch if needed.

- Identity and Persistence:
  - Guests: `session_key` stored in localStorage; server looks up by `session_key`.
  - Logged-in: server stores one row per `user_id` and merges/overwrites accordingly; include `credentials: 'include'` in fetch for cookie auth.

Debugging Tips
--------------
- Enable server logging by defining `TM_COMPARE_DEBUG` in WP config; tail `wp-content/debug.log` for entries prefixed `[TMCompare]`.
- Browser-side, install a simple fetch monitor in DevTools to log outgoing requests/responses to `/wp-json/tm-compare/v1/save`.