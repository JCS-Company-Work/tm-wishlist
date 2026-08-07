<?php

    namespace TMWishlist;

    if ( ! defined( 'ABSPATH' ) ) exit;

    class TMWL_Main {

        public function __construct() {
            
            // Add rewrite rules for compare share URLs
            add_action('init', [ $this, 'add_compare_rewrite_rules' ]);

            // Register query var
            add_filter( 'query_vars', [ $this, 'register_query_vars' ] );

            // Add "Add To Wishlist" button after the WooCommerce add-to-cart form
            add_action( 'tm_buttons_container', [ $this, 'render_compare_button' ], 10 );
            
            // Add "View Wishlist" button after the WooCommerce add-to-cart form
            add_action( 'tm_buttons_container', [ $this, 'render_view_wishlist_button' ], 15 );
        
        }

        /**
         * Add rewrite rules for compare share URLs
         */
        public function add_compare_rewrite_rules() {

            add_rewrite_rule(
                '^wishlist/share/([^/]+)/?$',
                'index.php?pagename=wishlist&tm_compare_key=$matches[1]',
                'top'
            );

        }

        /**
         * Register query vars
         */
        public function register_query_vars( $vars ) {
            
            $vars[] = 'tm_compare_key';
            return $vars;

        }


        /**
         * Render "View Wishlist" button on product pages
         */
        public function render_view_wishlist_button() {

            global $product;

            if ( ! $product ) return;

            $share_token = isset( $_COOKIE['tm_wishlist_share_token'] ) ? sanitize_text_field( wp_unslash( $_COOKIE['tm_wishlist_share_token'] ) ) : '';
            $wishlist_path = 'wishlist';

            if ( ! empty( $share_token ) ) {
                $wishlist_path = 'wishlist/share/' . rawurlencode( $share_token );
            }

            $wishlist_url = trailingslashit( home_url( $wishlist_path ) );

            if ( isset( $_GET['tvembed'] ) ) {
                $tvembed = sanitize_text_field( wp_unslash( $_GET['tvembed'] ) );
                $wishlist_url = add_query_arg( 'tvembed', ( $tvembed === '' ? '1' : $tvembed ), $wishlist_url );
            }

            printf(
                '<a href="%1$s" id="view-wishlist" class="wishlist btn btn-outline-secondary btn-sm button level-02" data-product-id="%2$d" role="button" aria-pressed="false">%3$s</a>',
                esc_url( $wishlist_url ),
                absint( $product->get_id() ),
                esc_html__( 'View Wishlist', 'tm-product-compare' )
            );

        }

        /**
         * Render "Add To Wishlist" button on product pages
         */
        public function render_compare_button() {

            // Access global product
            global $product;

            // Ensure product exists
            if ( ! $product ) {
                return;
            }

            // Check if current product/config is already in wishlist
            $is_active = self::configExists();

            // Render button with appropriate state
            printf(
                '<div class="tm-compare-controls">
                    <button
                        type="button"
                        class="tm-add-to-compare %1$s btn-outline-secondary btn-sm button level-02"
                        data-product-id="%2$d"
                        aria-pressed="%3$s">
                        %4$s
                    </button>
                    <div class="tm-compare-status" aria-live="polite" aria-atomic="true" role="status"></div>
                </div>',
                $is_active ? 'reverse-btn' : 'btn',
                absint( $product->get_id() ),
                $is_active ? 'true' : 'false',
                esc_html__(
                    $is_active ? 'Remove from wishlist' : 'Add to wishlist',
                    'tm-product-compare'
                )
            );
        }

        private static function configExists() {
            
            // Check for share token or login
            $storageShareToken = isset($_COOKIE['tm_wishlist_share_token']) ? sanitize_text_field($_COOKIE['tm_wishlist_share_token']) : null;

            if ( ! $storageShareToken ) return false;

            // Check database for existing items
            global $wpdb;

            // Ensure $wpdb is available
            if ( ! isset( $wpdb ) || ! $wpdb instanceof \wpdb ) {
                // Optionally log or skip setup
                return false
                ;
            }

            // Set table name
            $table_name = $wpdb->prefix . 'tm_wishlist';

            // Prepare and execute query
            $sql = $wpdb->prepare(
                "SELECT data FROM $table_name WHERE share_token = %s",
                $storageShareToken
            );

            // Get row as associative array
            $row = $wpdb->get_row( $sql, ARRAY_A );

            // If no row or no data, return false
            if ( ! $row || empty( $row['data'] ) ) return false;

            // Decode JSON data
            $configs = json_decode( $row['data'], true );

            // If not an array or empty, return false
            if ( ! is_array( $configs ) || empty( $configs ) ) return false;

            // If URL has params, check against those
            return self::matchConfigParams( $configs );

        }

        /**
         * Method to check all params specified in product page url
         * If param not set in url this is the default
         *
         * @param array $configs
         * @return boolean
         */
        private static function matchConfigParams($configs) {
            
            // Get URL params
            $params = $_GET;

            // Parameters to check mapped between URL and config keys
            $params_to_check = [ 'colour', 'base', 'veneer', 'model' ];

            foreach ( $configs as $config ) {

                if ( isset( $config['product_id'] ) && intval( $config['product_id'] ) === intval( get_the_ID() ) ) {

                    foreach ( $params_to_check as $param ) {

                        // If URL param not set this is the default and we need to check the database serialised data
                        if ( ! isset( $params[ $param ] ) ) {

                            if ( ! self::checkDefaultConfigValue( $param, $config ) ) {
                                continue 2; // default mismatch → next config
                            }

                            continue;
                        }

                        // URL param set but missing in config so skip this config
                        if ( ! isset( $config[ $param ] ) ) {
                            continue 2;
                        }

                        $request_val = strtolower( trim( $params[ $param ] ) );
                        $config_val  = strtolower( trim( $config[ $param ] ) );

                        // Normalise swatch values
                        if ( strpos( $config_val, 'swatch' ) !== false ) {
                            $config_val = trim( str_ireplace( 'swatch', '', $config_val ) );
                        }

                        // Mismatch found, move to next config
                        if ( $request_val !== $config_val ) {
                            continue 2; 
                        }
                    }

                    // All params matched for this config
                    return true;
                }

            }

            return false;

        }

        /**
         * Method to check default config value from serialised postmeta data when no url param set
         *
         * @param string $layer
         * @param array $config
         * @return boolean
         */
        private static function checkDefaultConfigValue( $layer, $config ) {

            // Get serialized data from wp_postmeta
            $data = get_post_meta( $config['product_id'], '_wapf_fieldgroup', true );

            // Ensure data is valid
            if ( empty( $data['fields'] ) || ! is_array( $data['fields'] ) ) {
                return false;
            }

            // Extract config value
            $config_value = strtolower( trim( $config[ $layer ] ) );
                
            // Remove 'swatch' from config value if present
            $config_value = strtolower( trim( $config[ $layer ] ?? '' ) );
            $config_value = str_ireplace( 'swatch', '', $config_value );
            $config_value = trim( $config_value );


            // Set correct label for layers
            $layer_label = $layer;

            if ( $layer === 'colour' ) {
                $layer_label = 'Top Colour';
            } elseif ( $layer === 'veneer' ) {
                $layer_label = 'Metal Edge Veneer';
            }

            // Initialize flags
            $field_found    = false;
            $selected_found = false;

            // Loop through fields to find the layer
            foreach ( $data['fields'] as $field ) {

                // Match the field
                if ( strtolower( $field['label'] ?? '' ) !== strtolower( $layer_label ) ) {
                    continue;
                }

                // Field found
                $field_found = true;

                // Get choices from postmeta data
                $choices = $field['options']['choices'] ?? [];

                // Loop through choices to find selected option
                foreach ( $choices as $choice ) {

                    if ( empty( $choice['selected'] ) ) {
                        continue;
                    }

                    $selected_found = true;

                    $selected_value = strtolower( trim( $choice['label'] ?? '' ) );
                    $selected_value = str_ireplace( 'swatch', '', $selected_value );
                    $selected_value = trim( $selected_value );

                    // Mismatach, return false
                    if ( $selected_value !== $config_value ) {
                        return false;
                    }
                }
            }

            // Field not found or no selected option
            if ( ! $field_found || ! $selected_found ) {
                return false;
            }

            // All checks passed
            return true;

        }

    }