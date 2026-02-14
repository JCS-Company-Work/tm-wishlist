<?php

    use PHPUnit\Framework\TestCase;
    use TMWishlist\TMWL_API;

    class TMWL_APITest extends TestCase {

        /**
         * Mock data for test class
         */
        const DATA = [
            'colours' => ['Yamuna', 'Ganges', 'Nile', 'Amazon'],
            'bases' => ['Yamuna', 'Ganges', 'Nile', 'Amazon'],
            'models' => ['300cm', '250cm', '200cm'],
            'productNames' => ['Tavolo Piazza Alveo', 'Tavolo Piazza Classico', 'Tavolo Piazza Moderno'],
            'urls' => [
                'https://tm-store-jan-26.local/product/tavolo-piazza-alveo-solido-12/',
                'https://tm-store-jan-26.local/product/tavolo-piazza-classico/',
                'https://tm-store-jan-26.local/product/tavolo-piazza-moderno/'
            ]
        ];

        public static function get_share_token_from_db($wpdb) {

            // Get a share_token from the database to use in the test
            $table = \TMWishlist\TMWL_DB::get_table_name();

            // Extract share token from database to test with.
            return $wpdb->get_var( "SELECT share_token FROM $table LIMIT 1" );

        }

        /**
        * Set up test data in the database before any tests run
        *
        * @return void
        */
        public static function setUpBeforeClass(): void {
            
            global $wpdb;

            // Ensure $wpdb is available
            if ( ! isset( $wpdb ) || ! $wpdb instanceof \wpdb ) {
                // Optionally log or skip setup
                return;
            }

            // Ensure required constants are defined
            if (!defined('TMWL_URL')) {
                define('TMWL_URL', '/assets/');
            }
            if (!defined('TMWL_VERSION')) {
                define('TMWL_VERSION', '1.0.0');
            }

            // Initialize the database table and insert test data
            $table_name = \TMWishlist\TMWL_DB::get_table_name();

            // User tokens, not randomly generated to ensure user token occurs in multiple rows in data
            $userTokens = [
                'user-4g7k2b1x',
                'user-9zq3w8e2',
                'user-5m1c7a6d',
                'user-x2v8p4r3',
                'user-0b6n5y7q',
                'user-t3s9w1k8',
                'user-8f2d6h5j',
                'user-7a4l3c9m',
                'user-q1w2e3r4',
                'user-z8x7c6v5',
                'user-2b3n4m5k',
                'user-6d7f8g9h',
                'user-1j2k3l4m',
                'user-5p6o7i8u',
                'user-3s4d5f6g',
            ];

            // Insert 100 test rows with random user_tokens and share_tokens
            for ($i = 0; $i < 100; $i++) {

                // Generate share token (20 chars, letters and numbers)
                $chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                $share_token = '';
                for ($c = 0; $c < 20; $c++) {
                    $share_token .= $chars[random_int(0, strlen($chars) - 1)];
                }

                // 1-3 items per data array
                $itemCount = rand(1, 3); 

                // Array to hold randomly generated items
                $items = [];

                // Generate random items for the current row
                for ($j = 0; $j < $itemCount; $j++) {

                    // Generate random product data in correct format
                    $items[] = [
                        'product_id'   => (string)(4800 + rand(1, 10)),
                        'productName'  => self::DATA['productNames'][array_rand(self::DATA['productNames'])],
                        'price'        => '\u00a3' . (string)(rand(2000, 9000)) . '.00',
                        'colour'       => self::DATA['colours'][array_rand(self::DATA['colours'])],
                        'base'         => self::DATA['bases'][array_rand(self::DATA['bases'])],
                        'model'        => self::DATA['models'][array_rand(self::DATA['models'])],
                        'layerIds'     => [ (string)(5300 + rand(1, 99)), (string)(5300 + rand(100, 199)) ],
                        'url'          => self::DATA['urls'][array_rand(self::DATA['urls'])],
                    ];
                    
                }

                // Insert row with random user_token and generated share_token
                $wpdb->insert(
                    $table_name,
                    [
                        'user_token'   => $userTokens[array_rand($userTokens)],
                        'share_token'  => $share_token,
                        'data'         => wp_json_encode($items),
                        'updated_at'   => current_time('mysql'),
                    ],
                    ['%s', '%s', '%s', '%s']
                );
            }
        }

        /**
         * Empty the wishlist table after tests have run to clean up test data
         *
         * @return void
         */
        // public static function tearDownAfterClass(): void {

        //     global $wpdb;
            
        //     // Ensure $wpdb is available
        //     if ( ! isset( $wpdb ) || ! $wpdb instanceof \wpdb ) {
        //         // Optionally log or skip cleanup
        //         return;
        //     }

        //     // Get table name
        //     $table_name = \TMWishlist\TMWL_DB::get_table_name();

        //     // Delete all rows from the table to clean up test data
        //     $wpdb->query("DELETE FROM $table_name");

        // }

        /**
         * Generate a flat array of product items
         *
         * @param int $count
         * @return array
         */
        protected static function generate_items(int $count = 3): array {

            // Array to hold randomly generated items
            $items = [];

            // Generate random items for the current row
            for ($i = 0; $i < $count; $i++) {

                // Generate random product data in correct format
                $items[] = [
                    'product_id'   => (string)(4800 + rand(1, 10)),
                    'productName'  => self::DATA['productNames'][array_rand(self::DATA['productNames'])],
                    'price'        => '\u00a3' . (string)(rand(2000, 9000)) . '.00',
                    'colour'       => self::DATA['colours'][array_rand(self::DATA['colours'])],
                    'base'         => self::DATA['bases'][array_rand(self::DATA['bases'])],
                    'model'        => self::DATA['models'][array_rand(self::DATA['models'])],
                    'layerIds'     => [ (string)(5300 + rand(1, 99)), (string)(5300 + rand(100, 199)) ],
                    'url'          => self::DATA['urls'][array_rand(self::DATA['urls'])],
                ];

            }

            // Return the generated items
            return $items;

        }

         /**
         * This test verifies that the save_comparison method creates a new list and returns the expected response structure
         *
         * @return void
         */
        public function test_save_comparison_creates_new_list() {
            
            // Initialize the API class
            $api = new \TMWishlist\TMWL_API();

            // Generate sample data for products
            $data = self::generate_items(5);

            // Create a mock WP_REST_Request with the sample data
            $request = new \WP_REST_Request('POST', '/tm-wishlist/v1/lists');
            $request->set_body(json_encode([
                'share_token' => '',
                'data' => $data,
            ]));

            // Set content type header for JSON
            $request->set_header('Content-Type', 'application/json');

            // Call the method
            $response = $api->save_comparison($request);

            // Check response structure
            $this->assertIsArray($response);
            $this->assertTrue($response['success']);
            $this->assertArrayHasKey('share_token', $response);
            $this->assertArrayHasKey('share_url', $response);

            // Check DB for the new row
            global $wpdb;
            
            // Ensure $wpdb is available
            if ( ! isset( $wpdb ) || ! $wpdb instanceof \wpdb ) {
                $this->fail('$wpdb is not available for DB assertions');
                return;
            }
            
            // Get the row with the share_token returned in the response. Use this as share_token is unique 
            //and is generated in the save_comparison method, so we can be sure this is the correct row.
            $table = \TMWishlist\TMWL_DB::get_table_name();
            $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE share_token = %s", $response['share_token']));
            
            // Check that the data in the DB matches the data we sent in the request
            $this->assertNotNull($row);
            $this->assertEquals(json_encode($data), $row->data);

        }

        /**
         * Test that the /lists endpoint returns data in the expected format
         *
         * @return void
         */
        public function test_get_all_lists_returns_data() {

            // Initialize the API class
            new TMWL_API();

            // Trigger REST API initialization
            do_action('rest_api_init');

            // Make a GET request to the /lists endpoint 
            // (leave wp-json prefix out since rest_do_request expects the route to start with the namespace)
            $request = new WP_REST_Request('GET', '/tm-wishlist/v1/lists');

            // Simulate the REST API request
            $response = rest_do_request($request);

            // Get the response data
            $data = $response->get_data();

            // Assert that the response is successful (200)
            $this->assertEquals(200, $response->get_status());

            // Check data structure
            $this->assertIsArray($data);

            // Ensure 'lists' array key exists in $data array and is an array
            $this->assertArrayHasKey('lists', $data);

            // Ensure 'user_token' array key exists in $data array and is an array
            $this->assertArrayHasKey('user_token', $data);

            // Check that 'lists' is an array
            $this->assertIsArray($data['lists']);

            // Check the structure of the first item:
            $this->assertArrayHasKey('user_token', $data['lists'][0]);
            $this->assertArrayHasKey('edit_allowed', $data['lists'][0]);
            $this->assertArrayHasKey('data', $data['lists'][0]);

        }

        /**
         * Test that the /generate_user_token endpoint returns a valid user token
         *
         * @return void
         */
        public function test_generate_user_token() {

            // Initialize the API class
            new TMWL_API();

            // Trigger REST API initialization
            do_action('rest_api_init');

            // Make a GET request to the /generate_user_token endpoint 
            // (leave wp-json prefix out since rest_do_request expects the route to start with the namespace)
            $request = new WP_REST_Request('POST', '/tm-wishlist/v1/user-token');

            // Simulate the REST API request
            $response = rest_do_request($request);

            // Get the response data
            $data = $response->get_data();

            // Assert that the response is successful (200)
            $this->assertEquals(200, $response->get_status());

            // Check data structure
            $this->assertIsArray($data);

            // Ensure 'user_token' array key exists in $data array
            $this->assertArrayHasKey('user_token', $data);
            
             // Assert the user_token matches the expected format: user-xxxxxxxx (8 alphanumeric)
            $this->assertMatchesRegularExpression('/^user-[a-z0-9]{8}$/i', $data['user_token']);

        }

        /**
        * Verify that the rename list endpoint updates the list name and returns expected response structure
        *
        * @return void
        */
        public function test_rename_list_updates() {

            global $wpdb;

            // Ensure $wpdb is available
            if ( ! isset( $wpdb ) || ! $wpdb instanceof \wpdb ) {
                // Optionally log or skip setup
                return;
            }

            // Extract share token from database to test with.
            $share_token = self::get_share_token_from_db($wpdb);

            // Generate a random list name in 'Test List Name' format
            $randomWord = ucfirst(substr(str_shuffle('abcdefghijklmnopqrstuvwxyz'), 0, 5));
            $list_name = "Test List $randomWord";

            // Initialize the API class
            new TMWL_API();

            // Trigger REST API initialization
            do_action('rest_api_init');

            // Make a PUT request to the /lists/{share_token} endpoint 
            $request = new WP_REST_Request('PUT', '/tm-wishlist/v1/lists/' . $share_token);

            // Set request body with new name for the list
            $request->set_body(json_encode([
                'list_name' => $list_name,
            ]));

            // Set content type header for JSON
            $request->set_header('Content-Type', 'application/json');

            // Simulate the REST API request
            $response = rest_do_request($request);

            // Get the response data
            $data = $response->get_data();

            // Assert that the response is successful (200)
            $this->assertEquals(200, $response->get_status());

            // Check data structure
            $this->assertIsArray($data);

            // Ensure 'success', 'share_token', and 'list_name' array keys exist in $data array
            $this->assertArrayHasKey('success', $data);
            $this->assertArrayHasKey('share_token', $data);
            $this->assertArrayHasKey('list_name', $data);

            // Assert the returned list_name matches what we sent
            $this->assertEquals($list_name, $data['list_name']);

        }

        public function test_delete_list() {

            global $wpdb;

            // Ensure $wpdb is available
            if ( ! isset( $wpdb ) || ! $wpdb instanceof \wpdb ) {
                // Optionally log or skip setup
                return;
            }

            // Extract share token from database to test with.
            $share_token = self::get_share_token_from_db($wpdb);

            // Initialize the API class
            new TMWL_API();

            // Trigger REST API initialization
            do_action('rest_api_init');

            // Make a DELETE request to the /lists/{share_token} endpoint 
            // (leave wp-json prefix out since rest_do_request expects the route to start with the namespace)
            $request = new WP_REST_Request('DELETE', '/tm-wishlist/v1/lists/' . $share_token);

            // Simulate the REST API request
            $response = rest_do_request($request);

            // Get the response data
            $data = $response->get_data();

            // Assert that the response is successful (200)
            $this->assertEquals(200, $response->get_status());

            // Check data structure
            $this->assertIsArray($data);

            // Ensure 'success' and 'share_token' array keys exist in $data array
            $this->assertArrayHasKey('success', $data);
            $this->assertArrayHasKey('share_token', $data);

        }

        public function test_clear_list_items() {

            global $wpdb;

            // Ensure $wpdb is available
            if ( ! isset( $wpdb ) || ! $wpdb instanceof \wpdb ) {
                // Optionally log or skip setup
                return;
            }

            // Extract share token from database to test with.
            $share_token = self::get_share_token_from_db($wpdb);

            // Initialize the API class
            new TMWL_API();

            // Trigger REST API initialization
            do_action('rest_api_init');

            // Make a DELETE request to the /lists/{share_token}/items endpoint 
            // (leave wp-json prefix out since rest_do_request expects the route to start with the namespace)
            $request = new WP_REST_Request('DELETE', '/tm-wishlist/v1/lists/' . $share_token . '/items');

            // Simulate the REST API request
            $response = rest_do_request($request);

            // Get the response data
            $data = $response->get_data();

            // Assert that the response is successful (200)
            $this->assertEquals(200, $response->get_status());

            // Check data structure
            $this->assertIsArray($data);

            // Ensure 'success' and 'share_token' array keys exist in $data array
            $this->assertArrayHasKey('success', $data);
            $this->assertArrayHasKey('share_token', $data);

        }

    }