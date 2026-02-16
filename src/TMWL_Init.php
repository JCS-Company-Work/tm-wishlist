<?php

    namespace TMWishlist;

    use TMWishlist\TMWL_API;
    use TMWishlist\TMWL_Assets;
    use TMWishlist\TMWL_Main;
    use TMWishlist\TMWL_Compare;

    if ( ! defined( 'ABSPATH' ) ) exit;

    /**
     * Main plugin initializer class
     */
    class TMWL_Init {

        /**
         * Initialize all core components and API routes
         *
         * @return void
         */
        public static function init() {
            
            // Initialize main class
            new TMWL_Main();

            // Initialize API routes
            new TMWL_API();
            
            // Initialize compare functionality
            new TMWL_Compare();

            // Initialize core components
            TMWL_Assets::init();

        }
        
    }