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

            // Retrieve share token
            $share_token = isset($_COOKIE['tm_wishlist_share_token']) ? sanitize_text_field($_COOKIE['tm_wishlist_share_token']) : "";

            // Allow a deployment to define a stable showroom token for iframe-based showroom screens.
            $showroom_user_token = '';
            if ( defined( 'TM_WISHLIST_SHOWROOM_USER_TOKEN' ) ) {
                $showroom_user_token = sanitize_text_field( constant( 'TM_WISHLIST_SHOWROOM_USER_TOKEN' ) );
            }
            $showroom_user_token = sanitize_text_field(
                apply_filters( 'tm_wishlist_showroom_user_token', $showroom_user_token )
            );

            // Optional origin allowlist for the parent showroom frame.
            $showroom_parent_origin = '';
            if ( defined( 'TM_WISHLIST_SHOWROOM_PARENT_ORIGIN' ) ) {
                $showroom_parent_origin = esc_url_raw( constant( 'TM_WISHLIST_SHOWROOM_PARENT_ORIGIN' ) );
            }
            $showroom_parent_origin = esc_url_raw(
                apply_filters( 'tm_wishlist_showroom_parent_origin', $showroom_parent_origin )
            );

            // Localize core script
            wp_localize_script( 'tm-core-js', 'TMWLSettings', [
                'rest_save_url' => esc_url_raw( rest_url( 'tm-wishlist/v1/lists' ) ),
                'rest_get_url'  => esc_url_raw( rest_url( 'tm-wishlist/v1/lists' ) ),
                'user_token'    => esc_url_raw( rest_url( 'tm-wishlist/v1/user-token' ) ),
                'share_token'   => $share_token,
                'showroom_user_token' => $showroom_user_token,
                'showroom_parent_origin' => $showroom_parent_origin,
                'nonce'         => wp_create_nonce( 'wp_rest' ),
                'max_items'     => 6,
                'storage_key'   => 'tm_wishlist_configs',
            ]);

            // Register add items script
            wp_register_script(
                'tm-add-items-js',
                TMWL_URL . 'assets/js/tm-add-items.js',
                [],
                TMWL_VERSION,
                true
            );

            // Register compare page scripts and styles
            wp_register_script(
                'tm-compare-js',
                TMWL_URL . 'assets/js/tm-compare.js',
                [],
                TMWL_VERSION,
                true
            );

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

            // Enqueue add items script on product pages, landing page, showroom embeds, or if 3d model viewer shortcode is present
            $is_showroom_embed = ( isset( $_GET['tvembed'] ) && $_GET['tvembed'] === 'embed-class' ) || ( isset( $_GET['source'] ) && $_GET['source'] === 'showroom' );
            // Exclude wishlist page — tm-compare.js handles the token bridge there
            if ( ( is_product() || has_shortcode( $post_content, 'tm_model_viewer' ) || is_page_template( 'landing-page.php' ) || $is_showroom_embed ) && ! is_page( 'wishlist' ) ) {
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