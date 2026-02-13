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

            // RESTful: Create a new list
            register_rest_route( 'tm-wishlist/v1', '/lists', [
                'methods'  => 'POST',
                'callback' => [ $this, 'save_comparison' ],
                'permission_callback' => '__return_true',
            ]);

            // RESTful: Fetch all lists for user_token (placeholder, needs implementation)
            register_rest_route( 'tm-wishlist/v1', '/lists', [
                'methods'  => 'GET',
                'callback' => [ $this, 'get_all_lists' ],
                'permission_callback' => '__return_true',
            ]);

            // RESTful: Fetch a specific list by share_token
            register_rest_route( 'tm-wishlist/v1', '/lists/(?P<share_token>[A-Za-z0-9_-]+)', [
                'methods'  => 'GET',
                'callback' => [ $this, 'get_comparison' ],
                'permission_callback' => '__return_true',
            ]);

            // RESTful: Rename a list (PUT)
            register_rest_route( 'tm-wishlist/v1', '/lists/(?P<share_token>[A-Za-z0-9_-]+)', [
                'methods'  => 'PUT',
                'callback' => [ $this, 'rename_list' ],
                'permission_callback' => '__return_true',
            ]);

            // RESTful: Delete a list
            register_rest_route( 'tm-wishlist/v1', '/lists/(?P<share_token>[A-Za-z0-9_-]+)', [
                'methods'  => 'DELETE',
                'callback' => [ $this, 'delete_list' ],
                'permission_callback' => '__return_true',
            ]);

            // RESTful: Clear all items from a list
            register_rest_route( 'tm-wishlist/v1', '/lists/(?P<share_token>[A-Za-z0-9_-]+)/items', [
                'methods'  => 'DELETE',
                'callback' => [ $this, 'clear_list_items' ],
                'permission_callback' => '__return_true',
            ]);

            // RESTful: Generate user token (placeholder, needs implementation)
            register_rest_route( 'tm-wishlist/v1', '/user-token', [
                'methods'  => 'POST',
                'callback' => [ $this, 'generate_user_token' ],
                'permission_callback' => '__return_true',
            ]);
        }

        /**
         * Save comparison data
         * - NEVER regenerate on update
         * - Cookie + client key are authoritative
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

            // User token logic ---
            $incoming_user_token = sanitize_text_field($params['user_token'] ?? '');
            if (empty($incoming_user_token) && isset($_COOKIE['tm_wishlist_user_token'])) {
                $incoming_user_token = sanitize_text_field($_COOKIE['tm_wishlist_user_token']);
            }
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
                'share_token' => $share_token,
                'user_token' => $incoming_user_token,
            ];
            $result['share_url'] = trailingslashit( home_url( 'wishlist' ) ) . 'share/' . rawurlencode( $share_token ) . '/';
            
            // Set cookies server-side for maximum persistence (1 year, SameSite=Lax)
            if (!isset($_COOKIE['tm_wishlist_share_token']) || $_COOKIE['tm_wishlist_share_token'] !== $share_token) {
                setcookie('tm_wishlist_share_token', $share_token, time() + 31536000, '/', '', false, false);
            }
            if (!isset($_COOKIE['tm_wishlist_user_token']) || $_COOKIE['tm_wishlist_user_token'] !== $incoming_user_token) {
                setcookie('tm_wishlist_user_token', $incoming_user_token, time() + 31536000, '/', '', false, false);
            }

            // Return response
            return $result;

        }

        /**
         * Retrieve comparison by key (share_token)
         */
        public function get_comparison( \WP_REST_Request $request ) {

            global $wpdb;
            
            // Ensure $wpdb is available
            if ( ! isset( $wpdb ) || ! $wpdb instanceof \wpdb ) {
                return new \WP_Error( 'db_unavailable', 'Database not available', [ 'status' => 500 ] );
            }

            // Sanitize key parameter
            $key = sanitize_text_field( $request['key'] );

            // Table name
            $table_name = TMWL_DB::get_table_name();

            // Find row by share_token
            $row = $wpdb->get_row(
                $wpdb->prepare("SELECT * FROM {$table_name} WHERE share_token = %s LIMIT 1", $key)
            );

            // If no row found, return empty data with share token for potential new entry
            if ( ! $row ) {
                return rest_ensure_response([
                    'share_token' => $key,
                    'data'        => [],
                    'edit_allowed' => false,
                ]);
            }

            // Decode data and check ownership
            $data = json_decode( $row->data, true );

            // Ownership check: edit_allowed if share_token matches
            $edit_allowed = ($row->share_token === $key);

            // Return data with share token and edit permission flag
            return rest_ensure_response([
                'share_token' => $row->share_token,
                'data'        => $data ?: [],
                'edit_allowed' => $edit_allowed,
            ]);
        }

        /**
         * Placeholder for fetching all lists for a user_token
         */
        public function get_all_lists( \WP_REST_Request $request ) {
            
            // Global $wpdb for database access
            global $wpdb;
            
            // Ensure $wpdb is available
            if ( ! isset( $wpdb ) || ! $wpdb instanceof \wpdb ) {
                return new \WP_Error( 'db_unavailable', 'Database not available', [ 'status' => 500 ] );
            }

            // Sanitize user_token parameter
            //$user_token = sanitize_text_field( $request['user_token'] );
            $user_token = 'user-7a4l3c9m';

            // Table name
            $table_name = TMWL_DB::get_table_name();

            // Find rows by user_token
            $rows = $wpdb->get_results(
                $wpdb->prepare("SELECT * FROM {$table_name} WHERE user_token = %s", $user_token)
            );

            // If no row found, return empty data with share token for potential new entry
            if ( ! $rows ) {
                return rest_ensure_response([
                    'user_token'    => $user_token,
                    'data'          => [],
                    'edit_allowed'  => false,
                ]);
            }

            // Decode data and check ownership
            $data = array_map(function($row) {
                return [
                    'user_token'    => $row->user_token,
                    'data'          => json_decode( $row->data, true ) ?: [],
                    'edit_allowed'  => false, // For now, we can set this to false or implement logic based on user_token
                ];
            }, $rows);

            return rest_ensure_response([
                'user_token' => $user_token,
                'lists'      => $data,
            ]);
        }

        /**
         * Placeholder for renaming a list
         */
        public function rename_list( \WP_REST_Request $request ) {

            /** @var \wpdb $wpdb */
            global $wpdb;

            // Ensure $wpdb is available
            if ( ! isset( $wpdb ) || ! $wpdb instanceof \wpdb ) {
                return new \WP_Error( 'db_unavailable', 'Database not available', [ 'status' => 500 ] );
            }

            // Extract share_token from request body
            $share_token = $request->get_param('share_token');
            // Extract name from request body
            $list_name = $request->get_param('list_name');
            // Get table name
            $table_name = TMWL_DB::get_table_name();

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
         * Placeholder for deleting a list
         */
        public function delete_list( \WP_REST_Request $request ) {
            return new \WP_Error( 'not_implemented', 'Deleting a list is not yet implemented', [ 'status' => 501 ] );
        }

        /**
         * Placeholder for clearing all items from a list
         */
        public function clear_list_items( \WP_REST_Request $request ) {
            return new \WP_Error( 'not_implemented', 'Clearing list items is not yet implemented', [ 'status' => 501 ] );
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