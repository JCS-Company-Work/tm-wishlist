<?php

    // Buffer all output and prevent header errors during tests.
    ob_start();

    // Load .env variables
    if (file_exists(__DIR__ . '/../vendor/autoload.php')) {

        // Load Composer autoload
        require_once __DIR__ . '/../vendor/autoload.php';

        // Load .env variables if Dotenv is available
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
    require_once '/Users/neilwilliams/wordpress-test-suite/wordpress-tests-lib/tests/phpunit/includes/bootstrap.php';