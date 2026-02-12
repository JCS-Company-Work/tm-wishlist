<?php

    namespace TMWishlist;

    use TMWishlist\TMWL_Assets;
    use TMWishlist\TMWL_Main;
    use TMWishlist\TMWL_ComparisonManager;

    if ( ! defined( 'ABSPATH' ) ) exit;

    /**
     * Main plugin initializer class
     */
    class TMWL_Init {
        public static function init() {
            TMWL_Assets::init();
            TMWL_Main::init();
            TMWL_ComparisonManager::init();
        }
    }