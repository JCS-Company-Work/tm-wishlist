<?php

    use PHPUnit\Framework\TestCase;
    use TMWishlist\TMWL_Init;

    class TMWL_InitTest extends TestCase {
        public function testInitMethodExists() {
            $this->assertTrue(
                method_exists(TMWL_Init::class, 'init'),
                'init method should exist in TMWL_Init class.'
            );
        }
    }
