<?php

    namespace TMWishlist;

    class TMWL_Compare {
        
        public function __construct() {

            // Remove native canonical tag on share pages to allow custom share URL
            add_filter('wpseo_canonical', [ $this, 'removeShareCanonical' ]);
            
        }

        /**
         * Remove native canonoical tag on share pages to allow custom share url
         *
         * @param string $canonical
         * @return string|false
         */
        public function removeShareCanonical($canonical) {
            
            // Disable Yoast canonical tag for /wishlist/share/* URLs
            if (isset($_SERVER['REQUEST_URI']) && preg_match('#/wishlist/share/#', $_SERVER['REQUEST_URI'])) {
                return false;
            }

            // Otherwise return original canonical
            return $canonical;

        }

    }
