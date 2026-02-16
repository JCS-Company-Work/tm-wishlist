<?php

    use PHPUnit\Framework\TestCase;
    use TMWishlist\TMWL_Main;

    class TMWL_MainTest extends TestCase {

        public function testMainClassExists() {
            $this->assertTrue(
                class_exists(TMWL_Main::class),
                'TMWL_Main class should exist.'
            );
        }

        /**
         * Verify that the custom rewrite rules are added correctly
         *
         * @return void
         */
        public function test_if_custom_rewrite_rules_added() {

            // Manually instantiate TMWL_Main to register rewrite rules
            new TMWL_Main();

            // Trigger the init action to register rewrite rules
            do_action('init'); 

            // Check if the rewrite rules are added
            global $wp_rewrite;

            // Set permalink structure and flush rules to ensure our custom rules are registered
            $wp_rewrite->set_permalink_structure('/%postname%/');

            // Flush rewrite rules to ensure our custom rules are registered
            $wp_rewrite->flush_rules();

            // Assert that the custom rewrite rule is present
            $this->assertArrayHasKey('^wishlist/share/([^/]+)/?$', $wp_rewrite->rules);

        }

        /**
         * Verify that the custom query var is registered correctly
         *
         * @return void
         */
        public function test_query_var_registration() {

            // Manually instantiate TMWL_Main to register query vars
            new TMWL_Main();

            // Trigger the init action to register query vars
            do_action('init'); 

            // Get the registered query vars
            $query_vars = apply_filters('query_vars', []);

            // Assert that our custom query var is registered
            $this->assertContains('tm_compare_key', $query_vars, 'tm_compare_key should be registered as a query var');

        }

        /**
         * Test that the render_view_wishlist_button method outputs the correct HTML
         *
         * @return void
         */
        public function test_render_view_wishlist_button_outputs_html() {

            // Load WooCommerce plugin
            include_once WP_PLUGIN_DIR . '/woocommerce/woocommerce.php';

            // Manually instantiate TMWL_Main to ensure hooks are registered
            new TMWL_Main();

            // Mock a WooCommerce product
            global $product;

            // Create a mock product object with get_id() method
            $product = $this->createMock(\WC_Product::class);

            // Set up the get_id() method to return a specific product ID
            $product->method('get_id')->willReturn(123);

            // Capture output
            ob_start();
            (new TMWL_Main())->render_view_wishlist_button();
            $output = ob_get_clean();
            
            // Assert that the output contains the expected HTML elements
            $this->assertStringContainsString('id="view-wishlist"', $output);
            $this->assertStringContainsString('data-product-id="123"', $output);

        }
            

    }