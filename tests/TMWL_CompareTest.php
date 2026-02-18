<?php

    use PHPUnit\Framework\TestCase;
    use TMWishlist\TMWL_Compare;
    use TMWishlist\TMWL_DB;

    class TMWL_CompareTest extends TestCase {

        /**
         * Test if the TMWL_Compare class exists
         *
         * @return void
         */
        public function testCompareClassExists() {
            $this->assertTrue(
                class_exists(TMWishlist\TMWL_Compare::class),
                'TMWL_Compare class should exist.'
            );
        }

        /**
         * Verify that canonical link is successfully removed on share pages only
         *
         * @return void
         */
        public function test_remove_share_canonical() {

            // Create instance of TMWL_Compare
            $compare = new TMWL_Compare();

            // Simulate a share page request that should trigger canonical removal
            $_SERVER['REQUEST_URI'] = '/wishlist/share/test-key/';

            // Call the method and assert it returns false to remove canonical
            $result = $compare->removeShareCanonical('https://example.com/wishlist/share/test-key/');
            $this->assertFalse($result, 'removeShareCanonical should return false for share URLs');

            // Simulate a non-share page request that should not trigger canonical removal
            $_SERVER['REQUEST_URI'] = '/some/other/page/';

            // Call the method and assert it returns the original canonical URL
            $result = $compare->removeShareCanonical('https://example.com/some/other/page/');
            $this->assertEquals('https://example.com/some/other/page/', $result, 'removeShareCanonical should return original canonical for non-share URLs');

        }

        public function test_setUrl() {

            $item = [
                'url' => 'https://example.com/product/test-product/'
            ];

            TMWL_Compare::setUrl($item);

            $this->assertEquals('https://example.com/product/test-product/', $item['url'], 'setUrl should set the url correctly');  

        }

        /**
         * Test the compare shortcode output when no share token is present (empty state)
         *
         * @return void
         */
        public function test_compare_shortcode_empty_state() {

            // Create instance of TMWL_Compare
            $compare = new TMWL_Compare();
            
            // Simulate a share page request that should trigger shortcode rendering
            $_SERVER['REQUEST_URI'] = '/wishlist/share/test-key/';

            // Simulate no share token in query var
            if (function_exists('set_query_var')) {
                set_query_var('tm_compare_key', null);
            }

            // Or simulate empty DB return
            $output = $compare->compare_shortcode();

            // Assert that the output contains the expected empty state message
            $this->assertStringContainsString('Your wishlist is empty', $output, 'Shortcode should show empty message when no data');
        }

        /**
        * Test the compare shortcode output when a valid share token with data is present
        *
        * @return void
        */
        public function test_compare_shortcode_populated_list() {
            
            // Get single row from database to use as test data
            global $wpdb;

            // Ensure $wpdb is available
            if ( ! isset( $wpdb ) || ! $wpdb instanceof \wpdb ) {
                return '<p>Database not available.</p>';
            }

            // Set table name
            $table_name = TMWL_DB::get_table_name();

            // Query for the first row where share_token is present (not null or empty), return all columns
            $sql = "SELECT share_token, data 
                    FROM $table_name 
                    WHERE share_token IS NOT NULL 
                    AND share_token != '' 
                    AND data IS NOT NULL 
                    AND data != ''";

            // Get results as associative array
            $rows = $wpdb->get_results($sql, ARRAY_A);

            // Init $valid_row to null
            $valid_row = null;

            // Loop through results to find the first valid row with non-empty data
            foreach ($rows as $row) {
                $data = json_decode($row['data'], true);
                if (is_array($data) && count($data) > 0) {
                    $valid_row = $row;
                    break;
                }
            }

            // Init $wp_query if not set
            global $wp_query;

            if ( ! isset( $wp_query ) ) {
                $wp_query = new WP_Query();
            }

            // Simulate the query var for the share token to be picked up by compare_shortcode
            set_query_var('tm_compare_key', $valid_row['share_token']);

            // Create instance of TMWL_Compare
            $compare = new TMWL_Compare();

            // Call the shortcode method to get output
            $output = $compare->compare_shortcode();

            // Assert that the output contains expected elements based on the test data
            $this->assertStringContainsString('<div class="tm-compare-list">', $output, 'Shortcode output should contain compare page wrapper');
            $this->assertStringContainsString('<h2 class="woocommerce-loop-product__title">', $output, 'Shortcode output should contain product name');
            $this->assertStringContainsString('<p class="price">', $output, 'Shortcode output should contain product price');
            
        }

        /**
         * Test the list control buttons HTML output
         *
         * @return void
         */
        public function test_list_controls_create_html() {
            
            // Simulate a share token for testing
            $share_token = 'test-token';

            // Create instance of TMWL_Compare
            $compare = new TMWL_Compare();

            // Call the listControlButtons method to get output
            $output = $compare->listControlButtons($share_token);

            // Assert that the output contains the expected control button div
            $this->assertStringContainsString('<div class="list-control-buttons">', $output, 'List control buttons should return control button div');
            
            // Assert that all expected buttons are present in the output
            $this->assertStringContainsString('<button id="share_wishlist"', $output, 'List control buttons should return share button');
            $this->assertStringContainsString('<button id="clear_wishlist"', $output, 'List control buttons should return clear wishlist button');
            $this->assertStringContainsString('<button id="delete_list_all"', $output, 'List control buttons should return delete all button');
            $this->assertStringContainsString('<button id="delete_list_me"', $output, 'List control buttons should return delete me button');
        }

        /**
         * Test the active wishlist controls HTML output on single list page (wishlist/share/[key])
         *
         * @return void
         */
        public function test_single_active_wishlist_controls() {

            // Create instance of TMWL_Compare
            $compare = new TMWL_Compare();

            // Call the activeWishlistControls method to get output
            $output = $compare->activeWishlistControls('single-list', 'My Active List');

            // Assert that the output contains the expected control button div
            $this->assertStringContainsString('<div class="active-list-controls">', $output, 'List control buttons should return active list control div');
            
            // Assert that all expected buttons are present in the output
            $this->assertStringContainsString('<button id="create_list"', $output, 'List control buttons should return create list button');
            $this->assertStringContainsString('<a href="/wishlist" id="manage_lists"', $output, 'List control buttons should return manage lists button');
           
        }
        
        /**
         * Test the active wishlist controls HTML output on multi list page (/wishlist)
         *
         * @return void
         */
        public function test_multi_active_wishlist_controls() {

            // Create instance of TMWL_Compare
            $compare = new TMWL_Compare();

            // Call the activeWishlistControls method to get output
            $output = $compare->activeWishlistControls('multi-list', 'My Multi Lists');

            // Assert that the output contains the expected control button div
            $this->assertStringContainsString('<div class="active-list-controls">', $output, 'List control buttons should return active list control div');
            
            // Assert that all expected buttons are present in the output
            $this->assertStringContainsString('<button id="create_list"', $output, 'List control buttons should return create list button');
            $this->assertStringNotContainsString('<a href="/wishlist" id="manage_lists"', $output, 'List control buttons should return manage lists button');
           
        }
    }