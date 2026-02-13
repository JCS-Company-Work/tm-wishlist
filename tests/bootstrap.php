<?php

// Load .env variables
if (file_exists(__DIR__ . '/../vendor/autoload.php')) {
    require_once __DIR__ . '/../vendor/autoload.php';
    if (class_exists('Dotenv\\Dotenv')) {
        Dotenv\Dotenv::createImmutable(dirname(__DIR__), '.env')->load();
        echo ".env loaded\n";
    } else {
        echo "Dotenv not found\n";
    }
} else {
    echo "vendor/autoload.php not found\n";
}

// Now load the WP test suite bootstrap
require_once '/tmp/wordpress-tests-lib/includes/bootstrap.php';