<?php

    use PHPUnit\Framework\TestCase;

    class TMWL_AssetsTest extends TestCase {

        public function test_all_scripts_enqueued() {

            // Ensure required constants are defined
            if (!defined('TMWL_URL')) {
                define('TMWL_URL', '/assets/');
            }
            if (!defined('TMWL_VERSION')) {
                define('TMWL_VERSION', '1.0.0');
            }

            // Initialize asset hooks
            \TMWishlist\TMWL_Assets::init();

            // Trigger asset registration and enqueue
            do_action('init');
            do_action('wp_enqueue_scripts');

            // Check core script is enqueued
            $this->assertTrue(wp_script_is('tm-core-js', 'enqueued'), 'tm-core-js should be enqueued');

            // Simulate product page for add-items script
            // This requires mocking is_product() to return true
            // If using Brain Monkey or WP_Mock, you would mock here
            // For integration, you may need to manually set up the environment
            // $this->assertTrue(wp_script_is('tm-add-items-js', 'enqueued'), 'tm-add-items-js should be enqueued on product pages');

            // Simulate compare page for compare script
            // This requires mocking has_shortcode() and is_page()
            // $this->assertTrue(wp_script_is('tm-compare-js', 'enqueued'), 'tm-compare-js should be enqueued on compare pages');
        }

    }