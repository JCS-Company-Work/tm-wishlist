# TM Wishlist Plugin

A modern, multi-list wishlist plugin for WordPress/WooCommerce, supporting both single-list and multi-list user experiences. Built for performance, flexibility, and a seamless user journey.

## Features
- Multiple wishlists per user (multi-list support)
- Single-list fallback for simple use cases
- Add/remove products to wishlists from product pages
- Edit wishlist names (with validation)
- Share wishlists via unique links
- Persistent storage using cookies and localStorage
- REST API endpoints for all core actions
- Responsive, accessible UI with smooth animations

## User Journey
1. **First Visit**
   - User visits a product page or wishlist page.
   - A unique `user_token` is generated and stored in a cookie.

2. **Creating a Wishlist**
   - On first add, a new wishlist is created via the REST API.
   - A unique `share_token` is generated and stored in both a cookie and localStorage.
   - The wishlist is now ready for items.

3. **Adding Products**
   - User clicks "Add to wishlist" on a product page.
   - The product configuration is saved to the active wishlist in localStorage and synced to the server.
   - The UI updates instantly.

4. **Managing Wishlists**
   - User can create, rename, or delete wishlists from the wishlist page.
   - Switching between lists is instant (localStorage), with server sync for persistence.

5. **Sharing**
   - Each wishlist has a unique share link (using `share_token`).
   - Anyone with the link can view the shared wishlist.

6. **Persistence**
   - Wishlists persist across sessions using cookies and localStorage.
   - All changes are synced to the server for reliability.

## Technical Overview
- **Backend:** PHP, WordPress REST API, MySQL
- **Frontend:** Vanilla JS (modular), localStorage, cookies
- **Data Structure:**
  ```json
  {
    "user-xxxx": {
      "share_token1": [ {...}, {...} ],
      "share_token2": [ {...} ]
    }
  }
  ```
- **API Endpoints:**
  - `POST /wp-json/tm-wishlist/v1/lists/new` — Create new wishlist
  - `POST /wp-json/tm-wishlist/v1/lists` — Save/update wishlist
  - `GET /wp-json/tm-wishlist/v1/lists?user_token=...` — Get all wishlists for user
  - `GET /wp-json/tm-wishlist/v1/lists/{share_token}` — Get wishlist by share token
  - `PUT /wp-json/tm-wishlist/v1/lists/{share_token}` — Rename wishlist
  - `DELETE /wp-json/tm-wishlist/v1/lists/{share_token}` — Delete wishlist

## Developer Notes
- All tokens are generated server-side for security.
- Use localStorage for instant UI updates; use cookies for server sync.
- The plugin is designed to be extensible and maintainable.

## License
MIT