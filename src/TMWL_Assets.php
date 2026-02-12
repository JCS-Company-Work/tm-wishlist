<?php

    namespace TMWishlist;

    if ( ! defined( 'ABSPATH' ) ) exit;

    /**
     * TMWL_Assets
     * Manages registration and enqueueing of scripts and styles for TM Wishlist.
     */
    class TMWL_Assets {

        /**
         * Initialize asset management
         */
        public static function init() {

            // Register/enqueue assets
            add_action( 'init', [ __CLASS__, 'register_assets' ] );
            add_action( 'wp_enqueue_scripts', [ __CLASS__, 'enqueue_assets' ] );

            // Defer non-critical scripts
            add_filter('script_loader_tag', [__CLASS__, 'deferScripts'], 10, 2);

        }

        /**
         * Register scripts and styles
         */
        public static function register_assets() {

            // Register core JS script
            wp_register_script(
                'tm-core-js',
                TMWL_URL . 'assets/js/tm-core.js',
                [],
                TMWL_VERSION,
                true
            );

            // Register add items script
            wp_register_script(
                'tm-add-items-js',
                TMWL_URL . 'assets/js/tm-add-items.js',
                [],
                TMWL_VERSION,
                true
            );

            // Retrieve share token
            $share_token = isset($_COOKIE['tm_wishlist_share_token']) ? sanitize_text_field($_COOKIE['tm_wishlist_share_token']) : "";

            // Localize add items script
            wp_localize_script( 'tm-add-items-js', 'TMAddItemsSettings', [
                'rest_save_url' => esc_url_raw( rest_url( 'tm-wishlist/v1/save' ) ),
                'rest_get_url'  => esc_url_raw( rest_url( 'tm-wishlist/v1/get' ) ),
                'share_token'   => $share_token,
                'nonce'         => wp_create_nonce( 'wp_rest' ),
            ]);

            // Register compare page scripts and styles
            wp_register_script(
                'tm-compare-js',
                TMWL_URL . 'assets/js/tm-compare.js',
                [],
                TMWL_VERSION,
                true
            );

            // Localize compare script
            wp_localize_script( 'tm-compare-js', 'TMCompareSettings', [
                'rest_save_url' => esc_url_raw( rest_url( 'tm-wishlist/v1/save' ) ),
                'rest_get_url'  => esc_url_raw( rest_url( 'tm-wishlist/v1/get/' ) ),
                'nonce'         => wp_create_nonce( 'wp_rest' ),
                'share_token'   => $share_token,
            ]);

        }

        /**
         * Enqueue scripts and styles conditionally
         */
        public static function enqueue_assets() {

            // Get post ID
            $post_id = get_the_ID();

            // Get post content to check for shortcode
            $post_content = $post_id ? get_post_field( 'post_content', $post_id ) : '';

            // Enqueue core script globally
            wp_enqueue_script( 'tm-core-js' );

            // Enqueue add items script on product pages
            if ( is_product() ) {
                wp_enqueue_script( 'tm-add-items-js' );
            }

            // Enqueue compare scripts/styles on compare page
            if ( has_shortcode( $post_content, 'compare_products' ) || ( is_page() && is_page( 'wishlist' ) ) ) {
                wp_enqueue_script( 'tm-compare-js' );
            }
        }

        /**
         * Defer JS not required above the fold
         *
         * @param string $tag
         * @param string $handle
         * @return string
         */
        public static function deferScripts($tag, $handle) {

            // List of scripts to defer
            $async_scripts = [
                'tm-add-items-js',
                'tm-compare-js',
                'tm-core-js',
            ];

            // Defer selected scripts
            if (in_array($handle, $async_scripts, true)) {
                return str_replace('<script ', '<script defer ', $tag);
            }

            // Return unmodified tag for other scripts
            return $tag;
       
        }

    }