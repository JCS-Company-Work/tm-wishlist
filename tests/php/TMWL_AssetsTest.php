<?php

    use Brain\Monkey;
    use Brain\Monkey\Functions;
    use PHPUnit\Framework\TestCase;

    class TMWL_AssetsTest extends TestCase {

        /**
         * Set up for Brain Monkey
         *
         * @return void
         */
        protected function setUp(): void

        {
            parent::setUp();
            Monkey\setUp();
        }

        /**
         * Tear down for Brain Monkey
         *
         * @return void
         */
        protected function tearDown(): void

        {
            Monkey\tearDown();
            parent::tearDown();
        }

        /**
         * This test verifies that the core script is enqueued on all pages
         *
         * @return void
         */
        public function test_tm_core_script_enqueued() {

            // Now load WooCommerce after Patchwork/Brain Monkey is ready
            require_once WP_PLUGIN_DIR . '/woocommerce/woocommerce.php';

            // Ensure required constants are defined
            if (!defined('TMWL_URL')) {
                define('TMWL_URL', '/assets/');
            }
            if (!defined('TMWL_VERSION')) {
                define('TMWL_VERSION', '1.0.0');
            }

            // Initialize asset hooks
            \TMWishlist\TMWL_Assets::init();

            // Trigger asset registration
            do_action('init');

            // Test core script (enqueued on all project pages)
            do_action('wp_enqueue_scripts');

            // Test that core script is enqueued on all pages
            $this->assertTrue(wp_script_is('tm-core-js', 'enqueued'), 'tm-core-js should be enqueued');

        }

        /**
         * This test verifies that the add items script is enqueued when on a product page
         *
         * @return void
         */
        public function test_tm_add_items_script_enqueued() {

            // Now load WooCommerce after Patchwork/Brain Monkey is ready
            require_once WP_PLUGIN_DIR . '/woocommerce/woocommerce.php';
        
            // Ensure required constants are defined
            if (!defined('TMWL_URL')) {
                define('TMWL_URL', '/assets/');
            }
            if (!defined('TMWL_VERSION')) {
                define('TMWL_VERSION', '1.0.0');
            }

            // Initialize asset hooks
            \TMWishlist\TMWL_Assets::init();

            // Mock is_product() to return true
            Functions\when('is_product')->justReturn(true);

            // Trigger asset registration and enqueue
            do_action('init');
            do_action('wp_enqueue_scripts');

            // Test that add items script is enqueued on product pages
            $this->assertTrue(wp_script_is('tm-add-items-js', 'enqueued'), 'tm-add-items-js should be enqueued on product pages');

        }

        /**
         *  This test verifies that the compare script is enqueued when 
         *  the [compare_products] shortcode is present on a page
         *
         * @return void
         */
        public function test_tm_compare_script_enqueued() {

            global $post, $wp_query;
            
            // Mock is_product() to return true (this is called in TMWL_Assets::enqueue_assets via TMWL_Assets::init)
            Functions\when('is_product')->justReturn(true);

            // Ensure required constants are defined
            if (!defined('TMWL_URL')) {
                define('TMWL_URL', '/assets/');
            }
            if (!defined('TMWL_VERSION')) {
                define('TMWL_VERSION', '1.0.0');
            }

            // Create a post with the [compare_products] shortcode
            $post_id = wp_insert_post([
                'post_title'   => 'Compare Page',
                'post_content' => '[compare_products]',
                'post_status'  => 'publish',
                'post_type'    => 'page',
            ]);

            $post = get_post($post_id);
            setup_postdata($post);

            // Set up global $wp_query to simulate a page context
            $wp_query = new WP_Query(['p' => $post_id, 'post_type' => 'page']);
            $wp_query->post = $post;
            $wp_query->posts = [$post];
            $wp_query->queried_object = $post;
            $wp_query->is_page = true;

            // Initialize asset hooks
            \TMWishlist\TMWL_Assets::init();

            // Register the shortcode to ensure has_shortcode() works
            add_shortcode('compare_products', '__return_true');

            // Trigger asset registration and enqueue
            do_action('init');
            do_action('wp_enqueue_scripts');

            // Test that compare scripts are enqueued on compare page
            $this->assertTrue(wp_script_is('tm-compare-js', 'enqueued'), 'tm-compare-js should be enqueued on compare pages');

            // Clean up
            wp_delete_post($post_id, true);

        }

    }