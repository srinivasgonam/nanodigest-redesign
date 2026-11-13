<?php
/**
 * Plugin Name: NanoDigest Backend
 * Description: Forms, orders, settings and security hardening for the Nano Digest website. Stores newsletter, contact, advertise and order submissions in WordPress and emails the team about each one.
 * Version: 2.0.0
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * Author: NanoDigest
 * Text Domain: nanodigest-backend
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'NANODIGEST_BACKEND_VERSION', '2.0.0' );
define( 'NANODIGEST_BACKEND_PATH', plugin_dir_path( __FILE__ ) );
define( 'NANODIGEST_BACKEND_URL', plugin_dir_url( __FILE__ ) );
define( 'NANODIGEST_BACKEND_REST_NAMESPACE', 'nanodigest/v1' );

require_once NANODIGEST_BACKEND_PATH . 'includes/helpers.php';
require_once NANODIGEST_BACKEND_PATH . 'includes/settings.php';
require_once NANODIGEST_BACKEND_PATH . 'includes/security.php';
require_once NANODIGEST_BACKEND_PATH . 'includes/post-types.php';
require_once NANODIGEST_BACKEND_PATH . 'includes/meta-fields.php';
require_once NANODIGEST_BACKEND_PATH . 'includes/rest-api.php';
require_once NANODIGEST_BACKEND_PATH . 'includes/rest-handlers.php';
require_once NANODIGEST_BACKEND_PATH . 'includes/admin-ui.php';

function nanodigest_backend_init() {
	nanodigest_backend_register_post_types();
	nanodigest_backend_register_meta_fields();
}
add_action( 'init', 'nanodigest_backend_init' );

function nanodigest_backend_rest_init() {
	nanodigest_backend_register_rest_routes();
}
add_action( 'rest_api_init', 'nanodigest_backend_rest_init' );

add_action( 'admin_menu', 'nanodigest_backend_admin_setup' );
