<?php

    namespace TMWishlist;

    if ( ! defined( 'ABSPATH' ) ) exit;

    class TMWL_DB {

        /**
         * Get the table name with prefix, ensures consistent table naming across the plugin
         *
         * @return string
         */
        public static function get_table_name() {

            return 'wp_tm_wishlist';
            
        }

        /**
         * Create DB table (called on activation)
         */
        public static function create_table() {

            // Access the database object
            global $wpdb;

            // Ensure $wpdb is available
            if ( ! isset( $wpdb ) || ! $wpdb instanceof \wpdb ) {
                return;
            }
        
            // Database table name to be created
            $table_name = self::get_table_name();

            // Get the correct charset collate for the DB
            $charset_collate = $wpdb->get_charset_collate();

            // SQL to create the table
            $sql = "CREATE TABLE {$table_name} (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                user_id BIGINT UNSIGNED DEFAULT NULL,
                list_name VARCHAR(64) DEFAULT 'My Wishlist',
                user_token VARCHAR(36) DEFAULT NULL,
                share_token VARCHAR(64) DEFAULT NULL,
                data LONGTEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY  (id),
                KEY user_id (user_id),
                UNIQUE KEY share_token (share_token)
            ) $charset_collate;";

            // Include the upgrade functions for dbDelta
            require_once ABSPATH . 'wp-admin/includes/upgrade.php';
            dbDelta( $sql );
        }

    }