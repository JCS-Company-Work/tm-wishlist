<?php

    use PHPUnit\Framework\TestCase;

    class TMWL_DBTest extends TestCase {

        /**
         * Test get_table_name returns correct value
         */
        public function testGetTableNameReturnsCorrectValue() {

            // Expected table name based on the prefix
            $expected = 'wp_tm_wishlist';

            // Call the method and check the result
            $actual = \TMWishlist\TMWL_DB::get_table_name();

            // Assert that the actual table name matches the expected value
            $this->assertEquals($expected, $actual);

        }

        public function testCreateTableCreatesTable() {

            // Call the function to create the table (no return value)
            \TMWishlist\TMWL_DB::create_table();

            // Assert the table exists in the database
            global $wpdb;

            // Ensure $wpdb is available
            if ($wpdb === null) {
                $this->fail('$wpdb is null. WordPress environment not loaded.');
            }

            // Get the full table name with prefix
            $table_name = $wpdb->prefix . 'tm_wishlist';

            // Check if the table exists
            $exists = $wpdb->get_var("SHOW TABLES LIKE '$table_name'");

            // Assert that the table exists
            $this->assertEquals($table_name, $exists);

        }

    }