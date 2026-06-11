<?php

    namespace TMWishlist;

    use TMWishlist\TMWL_DB;

    class TMWL_Compare {

        // Variable to hold empty message for reuse
        private $empty_message = '<p>Your designs list is empty. To start, view our products pages.</p>';
        
        public function __construct() {

            // Remove native canonical tag on share pages to allow custom share URL
            add_filter('wpseo_canonical', [ $this, 'removeShareCanonical' ]);

            // Shortcode for compare page
            add_shortcode( 'compare_products', [ $this, 'compare_shortcode' ] );
            
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

        /**
         * Shortcode handler for [compare_products], renders the compare page based on share token in URL
         *
         * @return void
         */
        public function compare_shortcode() {

            // Check if page is /wishlist or /wishlist/share/* and get share token from URL
            if (preg_match('#^/wishlist/share/#', $_SERVER['REQUEST_URI'])) {

                return $this->shareTokenList();
                    

            } else if(isset($_SERVER['REQUEST_URI']) && (rtrim($_SERVER['REQUEST_URI'], '/') === '/wishlist')) {
                
                return $this->getUserLists();
                
            }

        }

        /**
         * Helper function to retrieve wishlist data based on share token, used in shortcode rendering
         *
         * @param string $share_token
         * @return array|string
         */
        public function getWishlistData($share_token) {

            // Access global database object
            global $wpdb;
            if ( ! isset( $wpdb ) || ! $wpdb instanceof \wpdb ) {
                return '<p>Database not available.</p>';
            }

            // Set table name
            $table_name = TMWL_DB::get_table_name();

            // Prepare and execute query
            $sql = $wpdb->prepare(
                "SELECT * FROM $table_name WHERE share_token = %s",
                $share_token
            );

            // Get row as associative array
            $row = $wpdb->get_row( $sql, ARRAY_A );

            // Verify ownership based on user token in cookie matching row's user token
            $user_token_cookie = $_COOKIE['tm_wishlist_user_token'] ?? '';

            // If user token cookie exists and matches row's user token, mark as owner
            if ( $user_token_cookie && $row && isset($row['user_token']) && $user_token_cookie === $row['user_token'] ) {
                $row['is_owner'] = true;
            } else {
                $row['is_owner'] = false;
            }

            // If no row or no data, return message
            if ( ! $row || empty( $row['data'] ) ) {
                return $this->empty_message;
            }

            // Return row
            return $row;

        }

        public function getUserLists() {

            // Check for user token in cookie
            if ( isset($_COOKIE['tm_wishlist_user_token']) && !empty($_COOKIE['tm_wishlist_user_token']) ) {
                
                global $wpdb;
                
                // Sanitize user token from cookie
                $user_token = sanitize_text_field($_COOKIE['tm_wishlist_user_token']);
                
                // Set table name
                $table_name = TMWL_DB::get_table_name();
                
                // Fetch all lists for this user
                $sql = $wpdb->prepare("SELECT * FROM $table_name WHERE user_token = %s", $user_token);
                $lists = $wpdb->get_results($sql, ARRAY_A);

                // If no lists, return message
                if (empty($lists)) {
                    return $this->empty_message;
                }

                // Output buffer for rendering lists
                ob_start();

                // Prepare lists for rendering (decode data)
                $render_lists = [];
                foreach ($lists as $list) {
                    $list['data'] = !empty($list['data']) ? json_decode($list['data'], true) : [];
                    $render_lists[] = $list;
                }

                // Determine active list based on cookie and available lists
                $active_list_name = $this->determineActiveList($render_lists);

                // Render active list controls with active list name
                echo $this->activeWishlistControls('multi-list', $active_list_name);

                echo '<div class="tm-wishlist-lists">';

                // Loop through lists and render each one
                foreach ($render_lists as $list) {
                    $products = $list['data'];
                    $user_token = $list['user_token'] ?? '';
                    $share_token = $list['share_token'] ?? '';
                    $list_name = $list['list_name'];
                    echo '<div class="tm-compare-list-wrapper" data-share-token="' . esc_attr($share_token) . '">';
                    echo $this->openCloseActive();
                    echo '<div class="tm-compare-list-header"><h3 class="tm-compare-list-name">' . esc_html($list_name) . '</h3>';
                    if ($user_token && isset($_COOKIE['tm_wishlist_user_token']) && $_COOKIE['tm_wishlist_user_token'] === $user_token) {
                        echo '<button type="button" class="edit-list-name" aria-label="Edit list name"><i class="fa-light fa-pen"></i></button>';
                    }
                    echo '</div>';
                    // If no items in this list, show message, control buttons, close wrapper, and skip to next list
                    if (empty($products) || !is_array($products)) {
                        echo '<div class="tm-compare-list tm-compare-list-multi">';
                        echo $this->empty_message;
                        echo '</div>'; // Close .tm-compare-list-multi
                        // Show control buttons even for empty lists
                        if ($user_token) {
                            echo $this->listControlButtons($share_token);
                        }
                        echo '</div>'; // Close .tm-compare-list-wrapper
                        continue;
                    }

                    echo '<div class="tm-compare-list tm-compare-grid tm-compare-list-multi">';
                    foreach ($products as $item) {
                        $url = self::setUrl($item);
                        ?>
                        <div class="tm-compare-item" data-product-id="<?php echo esc_attr( $item['product_id'] ); ?>">
                            <a href="<?php echo esc_url( $url ); ?>">
                                <img src="<?php echo esc_url( $item['image'] ); ?>" alt="<?php echo esc_attr( $item['productName'] ); ?>">
                                <h2 class="woocommerce-loop-product__title"><?php echo esc_html( $item['productName'] ); ?></h2>
                            </a>
                            <?php if ( ! empty( $item['price'] ) ) : ?>
                                <p class="price"><strong>Price: </strong><?php echo esc_html( $item['price'] ); ?></p>
                            <?php endif; ?>
                            <?php if ( ! empty( $item['colour'] ) ) : ?>
                                <p class="colour"><strong>Top Colour: </strong><?php echo esc_html( $item['colour'] ); ?></p>
                            <?php endif; ?>
                            <?php if ( ! empty( $item['base'] ) ) : ?>
                                <p class="base"><strong>Base: </strong><?php echo esc_html( $item['base'] ); ?></p>
                            <?php endif; ?>
                            <?php if ( ! empty( $item['veneer'] ) ) : ?>
                                <p class="veneer"><strong>Metal Edge Veneer: </strong><?php echo esc_html( $item['veneer'] ); ?></p>
                            <?php endif; ?>
                            <?php if ( ! empty( $item['model'] ) ) : ?>
                                <p class="model"><strong>Model: </strong><?php echo esc_html( $item['model'] ); ?></p>
                            <?php endif; ?>
                            <!--<i class="remove-from-compare fa-solid fa-xmark" data-product-id="<?php echo esc_attr( $item['product_id'] ); ?>"
                                data-layers-ids="<?php echo isset($item['layerIds']) && is_array($item['layerIds']) ? esc_attr( implode(',', array_map('intval', $item['layerIds']) ) ) : ''; ?>"></i>-->
                            <span 
                                class="remove-from-compare" 
                                data-product-id="<?php echo esc_attr( $item['product_id'] ); ?>"
                                data-layers-ids="<?php echo isset($item['layerIds']) && is_array($item['layerIds']) ? esc_attr( implode(',', array_map('intval', $item['layerIds']) ) ) : ''; ?>">
                                
                                
                            </span>
                        </div>
                        <?php
                    }
                    echo '</div>';
                    if ( $user_token ) {
                        echo $this->listControlButtons($share_token);
                    }
                    echo '</div>';
                }
                echo '</div>';
                return ob_get_clean();
            } else {
                return $this->empty_message;
            }
        }

        public function shareTokenList() {

            // Check for share token (rewrite path OR query string)
            $share_token_param = get_query_var( 'tm_compare_key' );

            // Early return if no share token
            if ( empty( $share_token_param ) ) {
                return $this->empty_message;
            }

            // Fetch comparison data based on share token
            $row = $this->getWishlistData($share_token_param);

            // Early return if no data
            if ( ! $row || empty( $row['data'] ) ) {
                return $this->empty_message;
            }

            // Decode product data
            $products = json_decode( $row['data'], true );

            // Early return if no products
            if ( ! is_array( $products ) || empty( $products ) ) {
                return $this->empty_message;
            }

            // Render comparison table
            ob_start();

            // If user is not owner, show message about view only design list
            if(!$row['is_owner']) {
                echo '<p>This is a view only designs list. To create your own designs list, please add products from the product pages.</p>';
            }

            // Render active list controls with active list name is user is list owner
            if($row['is_owner']) {
                
                echo $this->activeWishlistControls('single-list', $row['list_name']);

            }

            echo '<div class="tm-wishlist-lists">';

                echo '<div class="tm-compare-list-wrapper" data-share-token="' . esc_attr($share_token_param) . '">';

                    echo '<div class="tm-compare-list-header"><h3 class="tm-compare-list-name">' . esc_html($row['list_name']) . '</h3>';
                    if ($row['is_owner']) {
                        echo '<button type="button" class="edit-list-name" aria-label="Edit list name"><i class="fa-light fa-pen"></i></button>';
                    }
                    echo '</div>';                

                    echo '<div class="tm-compare-list tm-compare-grid">';

                        // Loop through products and display details
                        foreach ( $products as $item ) {

                            // Create data config key to identify config for removals etc
                            $config_key = self::generateConfigKey($item);

                            // Check if URL has params; if not, build from attributes
                            $url = self::setUrl($item);

                            ?>

                            <div class="tm-compare-item" data-product-id="<?php echo esc_attr( $item['product_id'] ); ?>">
                                <a href="<?php echo esc_url( $url ); ?>">
                                    <img src="<?php echo esc_url( $item['image'] ); ?>" alt="<?php echo esc_attr( $item['productName'] ); ?>">
                                    <h2 class="woocommerce-loop-product__title"><?php echo esc_html( $item['productName'] ); ?></h2>
                                </a>
                                <?php if ( ! empty( $item['price'] ) ) : ?>
                                    <p class="price"><strong>Price: </strong><?php echo esc_html( $item['price'] ); ?></p>
                                <?php endif; ?>
                                <?php if ( ! empty( $item['colour'] ) ) : ?>
                                    <p class="colour"><strong>Top Colour: </strong><?php echo esc_html( ucwords($item['colour']) ); ?></p>
                                <?php endif; ?>
                                <?php if ( ! empty( $item['base'] ) ) : ?>
                                    <p class="base"><strong>Base: </strong><?php echo esc_html( ucwords($item['base']) ); ?></p>
                                <?php endif; ?>
                                <?php if ( ! empty( $item['veneer'] ) ) : ?>
                                    <p class="veneer"><strong>Metal Edge Veneer: </strong><?php echo esc_html( ucwords($item['veneer']) ); ?></p>
                                <?php endif; ?>
                                <?php if ( ! empty( $item['model'] ) ) : ?>
                                    <p class="model"><strong>Model: </strong><?php echo esc_html( ucwords($item['model']) ); ?></p>
                                <?php endif; ?>
                                <?php if ( $row['is_owner'] ) : ?>
                                    <!--<i class="remove-from-compare fa-solid fa-xmark" data-product-id="<?php echo esc_attr( $item['product_id'] ); ?>"
                                        data-layers-ids="<?php echo isset($item['layerIds']) && is_array($item['layerIds']) ? esc_attr( implode(',', array_map('intval', $item['layerIds']) ) ) : ''; ?>"></i>-->
                                    <span 
                                        class="remove-from-compare" 
                                        data-product-id="<?php echo esc_attr( $item['product_id'] ); ?>"
                                        data-config-key="<?php echo esc_attr( $config_key ); ?>">
                                    </span>
                                <?php endif; ?>
                            </div>

                            <?php
                        }

                    echo '</div>';
                
                    // If owner, show control buttons (share, clear, delete)
                    if ( $row['is_owner'] ) {
                        echo $this->listControlButtons($share_token_param);
                    }

                echo '</div>';

            echo '</div>';

            return ob_get_clean();

        }

        /**
         * Gneerate config key
         *
         * @param array $item
         * @return void
         */
        public static function generateConfigKey($item) {

            $data_config_key = implode('|', [
                $item['product_id'],
                $item['base'] ?? '',
                $item['colour'] ?? '',
                $item['veneer'] ?? '',
                $item['model'] ?? ''
            ]);

            return $data_config_key;

        }

        /**
         * Output active wishlist controls with dynamic buttons based on whether it's single list or multi list view
         *
         * @param string $type
         * @param string $active_list_name
         * @return string
         */
        public function activeWishlistControls($type, $active_list_name) {

            $active_list_html = !empty($active_list_name)
                ? '<p class="active-list-name">Active list: </p><span class="active-list-span">' . esc_html($active_list_name) . '</span>'
                : '';

            // Build buttons HTML based on type (single-list or multi-list)
            $buttons_html = '<button id="create_list" class="tm-add-to-compare btn btn-outline-secondary btn-sm button level-02" data-product-id="6779" role="button" aria-pressed="false">Create New List</button>';

            // For single list view, also show manage lists button to navigate back to multi-list view
            if ($type !== 'multi-list') {
                $buttons_html .= '<a href="/wishlist" id="manage_lists" class="tm-add-to-compare btn btn-outline-secondary btn-sm button level-02" data-product-id="6779" role="button" aria-pressed="false">Manage Lists</a>';
            }

            // For multi-list, show active list name; for single-list, omit it
            $final_html = ($type === 'multi-list' ? $active_list_html : '') . $buttons_html;

            // Return combined HTML
            return '<div class="active-list-controls">' . $final_html . '</div>';
            
        }

        /**
         * Determine the active list based on the share token in cookies
         *
         * @param array $data (array of lists with share tokens and names)
         * @return string
         */
        public function determineActiveList($data) {

            // Get active share token from cookie
            $active_share_token = $_COOKIE['tm_wishlist_share_token'] ?? '';

            // Initialize active list name
            $active_list_name = '';

            // Loop through lists to find the one that matches the active share token
            if (!empty($active_share_token) && !empty($data) && is_array($data)) {

                foreach ($data as $list) {
                    if (
                        isset($list['share_token']) &&
                        $list['share_token'] === $active_share_token
                    ) {
                        $active_list_name = $list['list_name'] ?? '';
                        break;
                    }
                }
            }

            // Return the active list name
            return $active_list_name;

        }

        /**
         * List control buttons (share, clear, delete) with dynamic data-url for share button
         *
         * @param string $share_token
         * @return string
         */
        public function listControlButtons($share_token) {

            $buttonData = [
                'share_wishllist' => [
                    'label' => 'Share',
                    'action' => 'share_wishlist',
                ],
                'clear_wishlist' => [
                    'label' => 'Clear',
                    'action' => 'clear_wishlist',
                ],
                'delete_list_all' => [
                    'label' => 'Delete',
                    'action' => 'delete_list_all',
                ],
                'delete_list_me' => [
                    'label' => 'Remove From My Lists',
                    'action' => 'delete_list_me',
                ],
            ];

            // Loop over data and create buttons
            $buttons = array_map(function($button) use($share_token) {

                // Add wrapper to share wishlist button
                if($button['action'] === 'share_wishlist') {

                    return '<button id="' . esc_attr($button['action']) . '" class="tm-add-to-compare btn btn-outline-secondary btn-sm button level-02" data-url="' . esc_url(trailingslashit( home_url( 'wishlist' ) ) . 'share/' . rawurlencode( $share_token ) . '/') . '" role="button" aria-pressed="false">' . esc_html($button['label']) . '</button>';

                }

                return '<button id="' . esc_attr($button['action']) . '" class="tm-add-to-compare btn btn-outline-secondary btn-sm button level-02" role="button" aria-pressed="false">' . esc_html($button['label']) . '</button>';
            
            }, $buttonData);

            return '<div class="list-control-buttons">' . implode(' ', $buttons) . '</div>';
        }

        /**
         * Open/Close toggle and active indicator HTML for compare lists
         *
         * @return string
         */
        public function openCloseActive( $status = ''){

            // This function returns HTML for the open/close toggle and active indicator for compare lists
            return '<div class="list-controls"><span class="wish-switch list-active"><span class="wish-slider"></span></span><span class="list-toggle ' . $status . '"></span></div>';

        }

        /**
         * Check if url already has query params and adds them if not, based on available attributes
         * This is to ensure that even default configuartions have parsable url parameters for sharing and comparison
         * 
         * @param array $item
         * @return string
         */
        public static function setUrl($item) {

            // Check if URL already has query parameters
            $url = $item['url'];

            // If not, build URL with available attributes
            $parsed_url = parse_url($url);

            // Only append parameters if there are none in the URL already to avoid conflicts
            if (empty($parsed_url['query'])) {

                // Initialize parameters array
                $params = [];
                
                // Build query parameters based on available attributes
                if (!empty($item['colour'])) $params['colour'] = $item['colour'];
                if (!empty($item['base'])) $params['base'] = $item['base'];
                if (!empty($item['veneer'])) $params['veneer'] = $item['veneer'];
                if (!empty($item['model'])) $params['model'] = $item['model'];

                // Append parameters to URL
                if (!empty($params)) {
                    $url .= (strpos($url, '?') === false ? '?' : '&') . http_build_query($params);
                }

            }

            // Return the final URL
            return $url;

        }

    }
