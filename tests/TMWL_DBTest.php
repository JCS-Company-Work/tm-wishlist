<?php

    use PHPUnit\Framework\TestCase;

    class TMWL_DBTest extends TestCase {

        /**
         * Test get_table_name returns correct value
         */
        public function testGetTableNameReturnsCorrectValue() {
    echo "Before calling get_table_name\n";

            // Expected table name based on the prefix
            $expected = 'wp_tm_wishlist';

            // Call the method and check the result
            $actual = \TMWishlist\TMWL_DB::get_table_name();
    echo "After calling get_table_name: $actual\n";

            // Assert that the actual table name matches the expected value
            $this->assertEquals($expected, $actual);

        }

    }