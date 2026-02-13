<?php

    namespace TMWishlist;

    use TMWishlist\TMWL_API;
    use TMWishlist\TMWL_Assets;
    use TMWishlist\TMWL_Main;
    use TMWishlist\TMWL_ComparisonManager;

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

            // Initialize core components
            TMWL_Assets::init();
            TMWL_Main::init();
            TMWL_ComparisonManager::init();

            // Initialize API routes
            new TMWL_API();

        }
    }