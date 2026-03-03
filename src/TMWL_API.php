<?php

    namespace TMWishlist;

    use TMWishlist\TMWL_DB;
    use WP_REST_Request;

    if ( ! defined( 'ABSPATH' ) ) exit;

    class TMWL_API {

        public function __construct() {
            
            // Register REST API routes
            add_action( 'rest_api_init', [ $this, 'register_routes' ] );

        }

        /**
         * Register REST API routes
         */
        public function register_routes() {

            // Create new list
            register_rest_route( 'tm-wishlist/v1', '/lists/new', [
                'methods'  => 'POST',
                'callback' => [ $this, 'create_new_list' ],
                'permission_callback' => '__return_true',
            ]);

            // Save current list
            register_rest_route( 'tm-wishlist/v1', '/lists', [
                'methods'  => 'POST',
                'callback' => [ $this, 'save_comparison' ],
                'permission_callback' => '__return_true',
            ]);

            // Fetch all lists for user_token
            register_rest_route( 'tm-wishlist/v1', '/lists', [
                'methods'  => 'GET',
                'callback' => [ $this, 'get_all_lists' ],
                'permission_callback' => '__return_true',
            ]);

            // Fetch a specific list by share_token
            register_rest_route( 'tm-wishlist/v1', '/lists/(?P<share_token>[A-Za-z0-9_-]+)', [
                'methods'  => 'GET',
                'callback' => [ $this, 'get_comparison' ],
                'permission_callback' => '__return_true',
            ]);

            // Rename a list (PUT)
            register_rest_route( 'tm-wishlist/v1', '/lists/(?P<share_token>[A-Za-z0-9_-]+)', [
                'methods'  => 'PUT',
                'callback' => [ $this, 'rename_list' ],
                'permission_callback' => '__return_true',
            ]);

            // Delete a list
            register_rest_route( 'tm-wishlist/v1', '/lists/(?P<share_token>[A-Za-z0-9_-]+)', [
                'methods'  => 'DELETE',
                'callback' => [ $this, 'delete_list' ],
                'permission_callback' => '__return_true',
            ]);
           
            // Delete a list for user
            register_rest_route( 'tm-wishlist/v1', '/lists/(?P<share_token>[A-Za-z0-9_-]+)/user', [
                'methods'  => 'DELETE',
                'callback' => [ $this, 'delete_list_for_user' ],
                'permission_callback' => '__return_true',
            ]);

            // Clear all items from a list
            register_rest_route( 'tm-wishlist/v1', '/lists/(?P<share_token>[A-Za-z0-9_-]+)/items', [
                'methods'  => 'DELETE',
                'callback' => [ $this, 'clear_list_items' ],
                'permission_callback' => '__return_true',
            ]);

            // Generate user token
            register_rest_route( 'tm-wishlist/v1', '/user-token', [
                'methods'  => 'GET',
                'callback' => [ $this, 'generate_user_token' ],
                'permission_callback' => '__return_true',
            ]);
        
        }

        /**
         * Create a new list with a unique name for the user and return the share token, user token, and list HTML
         *
         * @param \WP_REST_Request $request
         * @return \WP_REST_RESPONSE
         */
        public function create_new_list( \WP_REST_Request $request ) {

            global $wpdb;

            // Ensure $wpdb is available
            if ( ! isset( $wpdb ) || ! $wpdb instanceof \wpdb ) {
                return new \WP_Error( 'db_unavailable', 'Database not available', [ 'status' => 500 ] );
            }

            // Get table name
            $table_name = TMWL_DB::get_table_name();

            // Get user token from request or cookie
            $user_token = sanitize_text_field($request->get_param('user_token') ?? '');

            // Check if there is data in request, else init empty array
            $data = $request->get_param('data') ?? [];

            // If no user token in request, check cookie for existing token
            if (empty($user_token) && isset($_COOKIE['tm_wishlist_user_token'])) {
                $user_token = sanitize_text_field($_COOKIE['tm_wishlist_user_token']);
            }

            // If still no user token, generate a new one (this allows creating a list without a pre-existing token, but will create a new user token for them)
            if (empty($user_token)) {
                $user_token = 'user-' . substr(str_shuffle('abcdefghijklmnopqrstuvwxyz0123456789'), 0, 8);
            }

            // Generate a unique list name for this user
            $new_list_name = $this->unique_list_name($wpdb, $user_token, $table_name);

            // Generate new share token
            $share_token = bin2hex(random_bytes(10));

            // Insert new row with blank data
            $wpdb->insert(
                $table_name,
                [
                    'user_token' => $user_token,
                    'share_token' => $share_token,
                    'data' => wp_json_encode($data),
                    'updated_at' => current_time('mysql'),
                    'list_name' => $new_list_name,
                ],
                ['%s', '%s', '%s', '%s', '%s']
            );

            // If data is not empty, return only tokens and data for localStorage update
            if (!empty($data)) {
                return rest_ensure_response([
                    'success' => true,
                    'share_token' => $share_token,
                    'user_token' => $user_token,
                    'data' => wp_json_encode($data),
                ]);
            }

            // Use listControlButtons from TMWL_Compare for unified button markup
            if ( ! class_exists( '\TMWishlist\TMWL_Compare' ) ) {
                require_once dirname( __FILE__ ) . '/TMWL_Compare.php';
            }

            // Render list HTML with buttons (initially empty)
            $compare = new \TMWishlist\TMWL_Compare();

            // Get control buttons HTML
            $buttons_html = $compare->listControlButtons($share_token);
            
            // Get toggle controls HTML
            $list_toggle_controls = $compare->openCloseActive();

            $list_html = '<div class="tm-compare-list-wrapper" data-share-token="' . esc_attr($share_token) . '">' .
                $list_toggle_controls .
                '<h3>' . esc_html($new_list_name) . '</h3>' .
                '<div class="tm-compare-list"><p>Your wishlist is empty. To start, view our products pages.</p></div>' .
                $buttons_html .
                '</div>';

            return rest_ensure_response([
                'success' => true,
                'share_token' => $share_token,
                'user_token' => $user_token,
                'list_html' => $list_html,
            ]);
        }

        /**
         * Generate a unique list name for a user's wishlist
         *
         * @param \wpdb $wpdb
         * @param string $user_token
         * @param string $table_name
         * @return string
         */
        public function unique_list_name($wpdb, $user_token, $table_name) {

            // Set a default base name for list
            $base_name = 'My Wishlist';

            // Get existing list names for this user that start with the base name
            $existing_names = $wpdb->get_col(
                $wpdb->prepare(
                    "SELECT list_name FROM {$table_name} WHERE user_token = %s AND list_name LIKE %s",
                    $user_token,
                    $base_name . '%'
                )
            );

            // Find the highest numbered list and increment for the new name
            $max_num = 0;

            // Loop through existing names to find the highest number suffix
            foreach ($existing_names as $name) {

                // Use regex to match names like "My Wishlist #2" and extract the number
                if (preg_match('/^' . preg_quote($base_name, '/') . ' #(\d+)$/', $name, $matches)) {
                    $num = intval($matches[1]);

                    // Update max_num if this number is higher
                    if ($num > $max_num) {
                        $max_num = $num;
                    }
                }
            }

            // Generate new name with incremented number
            $new_list_name = $base_name . ' #' . ($max_num + 1);

            // Return new name
            return $new_list_name;

        }

        /**
        * Save comparison data for a given share token, with ownership check and user token management
        *
        * @param \WP_REST_Request $request
        * @return \WP_REST_Response
        */
        public function save_comparison( \WP_REST_Request $request ) {

            global $wpdb;

            // Ensure $wpdb is available
            if ( ! isset( $wpdb ) || ! $wpdb instanceof \wpdb ) {
                return new \WP_Error( 'db_unavailable', 'Database not available', [ 'status' => 500 ] );
            }

            // Table name
            $table_name = TMWL_DB::get_table_name();

            // Get incoming data and share token
            $params = $request->get_json_params();

            // Sanitize inputs
            $incoming_share_token = sanitize_text_field($params['share_token'] ?? '');
            $incoming_data = is_array($params['data'] ?? null) ? $params['data'] : [];

            // Get user token from request or cookie, generate if not present
            $incoming_user_token = sanitize_text_field($params['user_token'] ?? '');
            if (empty($incoming_user_token) && isset($_COOKIE['tm_wishlist_user_token'])) {
                $incoming_user_token = sanitize_text_field($_COOKIE['tm_wishlist_user_token']);
            }

            // If still no user token, generate a new one (this allows saving without a pre-existing token, but will create a new user token for them)
            if (empty($incoming_user_token)) {

                // Generate a new user token
                $incoming_user_token = 'user-' . substr(str_shuffle('abcdefghijklmnopqrstuvwxyz0123456789'), 0, 8);

            }

            // If no share token in request, check cookie for existing token
            if (empty($incoming_share_token) && isset($_COOKIE['tm_wishlist_share_token'])) {
                $incoming_share_token = sanitize_text_field($_COOKIE['tm_wishlist_share_token']);
            }

            // Find row by share_token
            $row = $wpdb->get_row(
                $wpdb->prepare("SELECT * FROM {$table_name} WHERE share_token = %s LIMIT 1", $incoming_share_token)
            );

            // Ownership check: only allow edit if share_token matches
            if ($row && $row->share_token !== $incoming_share_token) {
                return new \WP_Error('forbidden', 'You do not have permission to edit this wishlist.', 403);
            }

            // If row exists, update. If not, insert new row with new share token and user token.
            if ($row) {
                // Update data
                $wpdb->update(
                    $table_name,
                    [
                        'data' => wp_json_encode($incoming_data),
                        'updated_at' => current_time('mysql'),
                        'user_token' => $incoming_user_token,
                    ],
                    ['share_token' => $incoming_share_token],
                    ['%s', '%s', '%s'],
                    ['%s']
                );
                $share_token = $row->share_token;
            } else {
                // Insert new row
                $share_token = $incoming_share_token ?: bin2hex(random_bytes(10));
                $wpdb->insert(
                    $table_name,
                    [
                        'user_token' => $incoming_user_token,
                        'share_token' => $share_token,
                        'data' => wp_json_encode($incoming_data),
                        'updated_at' => current_time('mysql'),
                    ],
                    ['%s', '%s', '%s', '%s']
                );
            }

            // Prepare response with share URL and user token
            $result = [
                'success' => true,
                'data' => $incoming_data,
                'share_token' => $share_token,
                'user_token' => $incoming_user_token,
                'share_url' => trailingslashit( home_url( 'wishlist' ) ) . 'share/' . rawurlencode( $share_token ) . '/',
            ];

            // Set cookie for user token if not already set or if different (expires in 1 year)
            if (!isset($_COOKIE['tm_wishlist_user_token']) || $_COOKIE['tm_wishlist_user_token'] !== $incoming_user_token) {
                setcookie('tm_wishlist_user_token', $incoming_user_token, time() + 31536000, '/', '', false, false);
            }

            // Return response
            return $result;

        }

        /**
         * Get comparison data by share token
         *
         * @param \WP_REST_Request $request
         * @return \WP_REST_Response
         */
        public function get_comparison( \WP_REST_Request $request ) {

            global $wpdb;
            
            // Ensure $wpdb is available
            if ( ! isset( $wpdb ) || ! $wpdb instanceof \wpdb ) {
                return new \WP_Error( 'db_unavailable', 'Database not available', [ 'status' => 500 ] );
            }

            // Sanitize share_token parameter
            $share_token = sanitize_text_field( $request->get_param('share_token') ?? '' );

            // Table name
            $table_name = TMWL_DB::get_table_name();

            // Find row by share_token
            $row = $wpdb->get_row(
                $wpdb->prepare("SELECT * FROM {$table_name} WHERE share_token = %s LIMIT 1", $share_token)
            );

            // If no row found, return empty data with share token for potential new entry
            if ( ! $row ) {
                return rest_ensure_response([
                    'share_token' => $share_token,
                    'data'        => [],
                    'edit_allowed' => false,
                ]);
            }

            // Decode data and check ownership
            $data = json_decode( $row->data, true );

            // Ownership check: edit_allowed if share_token matches
            $edit_allowed = ($row->share_token === $share_token);

            // Return data with share token and edit permission flag
            return rest_ensure_response([
                'user_token' => $row->user_token,
                'share_token' => $row->share_token,
                'data'        => $data ?: [],
                'edit_allowed' => $edit_allowed,
            ]);
        }

        /**
         * Fetch all lists for a given user_token (placeholder, currently returns empty data - needs implementation)
         *
         * @param \WP_REST_Request $request
         * @return \WP_REST_Response
         */
        public function get_all_lists( \WP_REST_Request $request ) {

            // Global $wpdb for database access
            global $wpdb;
            
            // Ensure $wpdb is available
            if ( ! isset( $wpdb ) || ! $wpdb instanceof \wpdb ) {
                return new \WP_Error( 'db_unavailable', 'Database not available', [ 'status' => 500 ] );
            }

            // Sanitize user_token parameter
            $user_token = sanitize_text_field( $request->get_param('user_token') ?? '' );

            // Table name
            $table_name = TMWL_DB::get_table_name();

            // Find rows by user_token, most recent first
            $rows = $wpdb->get_results(
                $wpdb->prepare("SELECT * FROM {$table_name} WHERE user_token = %s ORDER BY created_at DESC", $user_token)
            );

            // If no row found, return empty data with share token for potential new entry
            if ( ! $rows ) {
                return rest_ensure_response([
                    'user_token'    => $user_token,
                    'lists'         => [],
                    'edit_allowed'  => false,
                ]);
            }

            // Decode data and check ownership
            $data = array_map(function($row) {
                return [
                    'list_name'     => $row->list_name,
                    'share_token'   => $row->share_token,
                    'user_token'    => $row->user_token,
                    'data'          => json_decode( $row->data, true ) ?: [],
                    'edit_allowed'  => false,
                ];
            }, $rows);

            return rest_ensure_response([
                'user_token' => $user_token,
                'lists'      => $data,
            ]);
        }

        /**
         * Rename a list by share_token
         *
         * @param \WP_REST_Request $request
         * @return \WP_REST_Response
         */
        public function rename_list( \WP_REST_Request $request ) {

            global $wpdb;

            // Ensure $wpdb is available
            if ( ! isset( $wpdb ) || ! $wpdb instanceof \wpdb ) {
                return new \WP_Error( 'db_unavailable', 'Database not available', [ 'status' => 500 ] );
            }

            // Extract share_token from request body
            $share_token = sanitize_text_field($request->get_param('share_token') ?? '');

            // Get user token from request body
            $user_token = sanitize_text_field($request->get_param('user_token') ?? '');

            // Extract name from request body
            $list_name = sanitize_text_field($request->get_param('list_name') ?? '');
            
            // Get table name
            $table_name = TMWL_DB::get_table_name();

            // Check for duplicate name for this user (excluding current list)
            $existing = $wpdb->get_var(
                $wpdb->prepare(
                    "SELECT COUNT(*) FROM {$table_name} WHERE user_token = %s AND list_name = %s AND share_token != %s",
                    $user_token, $list_name, $share_token
                )
            );

            if ($existing > 0) {
                return new \WP_Error('duplicate_name', 'List name already exists, please choose a unique name.', ['status' => 409]);
            }

            // Update the name for the given share_token
            $wpdb->update(
                $table_name,
                [ 'list_name' => $list_name ],
                [ 'share_token' => $share_token ],
                [ '%s' ],
                [ '%s' ]
            );

            // Return success response
            return rest_ensure_response([
                'success' => true,
                'share_token' => $share_token,
                'list_name' => $list_name,
            ]);

        }

        /**
         * Delete a list by share_token
         *
         * @param \WP_REST_Request $request
         * @return \WP_REST_Response
         */
        public function delete_list( \WP_REST_Request $request ) {

            global $wpdb;

            // Ensure $wpdb is available
            if ( ! isset( $wpdb ) || ! $wpdb instanceof \wpdb ) {
                return new \WP_Error( 'db_unavailable', 'Database not available', [ 'status' => 500 ] );
            }

            // Extract share_token from request body
            $share_token = $request->get_param('share_token');

            // Get table name
            $table_name = TMWL_DB::get_table_name();

            // Delete the row for the given share_token
            $wpdb->delete(
                $table_name,
                [ 'share_token' => $share_token ],
                [ '%s' ]
            );

            // Return success response
            return rest_ensure_response([
                'success' => true,
                'share_token' => $share_token,
                'data' => null,
            ]);

        }

        public function delete_list_for_user( \WP_REST_Request $request ) {

            global $wpdb;

            // Ensure $wpdb is available
            if ( ! isset( $wpdb ) || ! $wpdb instanceof \wpdb ) {
                return new \WP_Error( 'db_unavailable', 'Database not available', [ 'status' => 500 ] );
            }

            // Extract share_token from request body
            $share_token = $request->get_param('share_token');

            // Get user token from cookie
            $user_token = isset($_COOKIE['tm_wishlist_user_token']) ? sanitize_text_field($_COOKIE['tm_wishlist_user_token']) : '';

            // Get table name
            $table_name = TMWL_DB::get_table_name();

            // Update the user_token to NULL (or empty string) for the matching row
            $wpdb->update(
                $table_name,
                [ 'user_token' => NULL ],
                [
                    'share_token' => $share_token,
                    'user_token' => $user_token,
                ],
                [ '%s' ],
                [ '%s', '%s' ]
            );

            // Fetch the updated row
            $updated_row = $wpdb->get_row(
                $wpdb->prepare("SELECT * FROM {$table_name} WHERE share_token = %s LIMIT 1", $share_token)
            );

            // Return success response with updated row data and type
            return rest_ensure_response([
                'success' => true,
                'type' => 'list cleared for user',
                'share_token' => $share_token,
                'user_token' => $updated_row ? $updated_row->user_token : null,
                'data' => null,
            ]);

        }

        /**
         * Clear all items from a list (set data to empty array)
         *
         * @param \WP_REST_Request $request
         * @return \WP_REST_Response
         */
        public function clear_list_items( \WP_REST_Request $request ) {

            global $wpdb;

            // Ensure $wpdb is available
            if ( ! isset( $wpdb ) || ! $wpdb instanceof \wpdb ) {
                return new \WP_Error( 'db_unavailable', 'Database not available', [ 'status' => 500 ] );
            }

            // Extract share_token from request body
            $share_token = $request->get_param('share_token');

            // Get table name
            $table_name = TMWL_DB::get_table_name();

            // Clear the items for the given share_token
            $wpdb->update(
                $table_name,
                [ 'data' => '[]' ],
                [ 'share_token' => $share_token ],
                [ '%s' ],
                [ '%s' ]
            );

            // Return success response
            return rest_ensure_response([
                'success' => true,
                'share_token' => $share_token,
                'data' => [],
            ]);

        }

        /**
         * Generate a user token (for future user-specific lists) 
         *
         * @param \WP_REST_Request $request
         * @return \WP_REST_Response
         */
        public function generate_user_token( \WP_REST_Request $request ) {
            $token = 'user-' . substr(str_shuffle('abcdefghijklmnopqrstuvwxyz0123456789'), 0, 8);
            return rest_ensure_response([
                'user_token' => $token,
            ]);
        }

    }