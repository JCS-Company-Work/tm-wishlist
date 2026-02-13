<?php

    use PHPUnit\Framework\TestCase;
    use TMWishlist\TMWL_API;
    use WP_REST_Request;

    class TMWL_APITest extends TestCase {

        /**
        * Set up test data in the database before any tests run
        *
        * @return void
        */
        public static function setUpBeforeClass(): void {
            
            /** @var \wpdb $wpdb */
            global $wpdb;

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
            $colours = ['Yamuna', 'Ganges', 'Nile', 'Amazon'];
            $bases = ['Yamuna', 'Ganges', 'Nile', 'Amazon'];
            $models = ['300cm', '250cm', '200cm'];
            $productNames = ['Tavolo Piazza Alveo', 'Tavolo Piazza Classico', 'Tavolo Piazza Moderno'];
            $urls = [
                'https://tm-store-jan-26.local/product/tavolo-piazza-alveo-solido-12/',
                'https://tm-store-jan-26.local/product/tavolo-piazza-classico/',
                'https://tm-store-jan-26.local/product/tavolo-piazza-moderno/'
            ];

            //
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
                        'productName'  => $productNames[array_rand($productNames)],
                        'price'        => '\u00a3' . (string)(rand(2000, 9000)) . '.00',
                        'colour'       => $colours[array_rand($colours)],
                        'base'         => $bases[array_rand($bases)],
                        'model'        => $models[array_rand($models)],
                        'layerIds'     => [ (string)(5300 + rand(1, 99)), (string)(5300 + rand(100, 199)) ],
                        'url'          => $urls[array_rand($urls)],
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
        public static function tearDownAfterClass(): void {
            /** @var \wpdb $wpdb */
            global $wpdb;
            $table_name = \TMWishlist\TMWL_DB::get_table_name();
            $wpdb->query("DELETE FROM $table_name");
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

    }
