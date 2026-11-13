<?php
/**
 * NanoDigest Backend - Security hardening
 *
 * Small, low-risk measures that apply to the whole WordPress site.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// No theme or plugin code editing from wp-admin: a stolen admin login must
// not be enough to run arbitrary PHP.
if ( ! defined( 'DISALLOW_FILE_EDIT' ) ) {
	define( 'DISALLOW_FILE_EDIT', true );
}

// XML-RPC is an old remote-publishing interface, mostly used today for
// password-guessing and pingback attacks.
add_filter( 'xmlrpc_enabled', '__return_false' );
add_filter(
	'wp_headers',
	function ( $headers ) {
		unset( $headers['X-Pingback'] );
		return $headers;
	}
);
add_filter(
	'xmlrpc_methods',
	function ( $methods ) {
		unset( $methods['pingback.ping'], $methods['pingback.extensions.getPingbacks'] );
		return $methods;
	}
);

// Do not advertise the WordPress version.
remove_action( 'wp_head', 'wp_generator' );
add_filter( 'the_generator', '__return_empty_string' );

/**
 * Browser security headers for public pages.
 */
function nanodigest_backend_security_headers( $headers ) {
	if ( is_admin() ) {
		return $headers;
	}

	$headers['X-Content-Type-Options'] = 'nosniff';
	$headers['X-Frame-Options']        = 'SAMEORIGIN';
	$headers['Referrer-Policy']        = 'strict-origin-when-cross-origin';
	$headers['Permissions-Policy']     = 'camera=(), microphone=(), geolocation=(), usb=(), interest-cohort=()';

	// Kept deliberately narrow: it blocks clickjacking, <base> hijacking and
	// plugins/Flash without restricting the scripts other plugins rely on.
	$headers['Content-Security-Policy'] = "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; upgrade-insecure-requests";

	if ( is_ssl() ) {
		$headers['Strict-Transport-Security'] = 'max-age=31536000';
	}

	return $headers;
}
add_filter( 'wp_headers', 'nanodigest_backend_security_headers' );

/**
 * Stop visitors listing account names, which are half of a login.
 */
function nanodigest_backend_block_author_scan() {
	if ( is_admin() || is_user_logged_in() ) {
		return;
	}
	// phpcs:ignore WordPress.Security.NonceVerification.Recommended
	if ( isset( $_GET['author'] ) || is_author() ) {
		wp_safe_redirect( home_url( '/' ), 301 );
		exit;
	}
}
add_action( 'template_redirect', 'nanodigest_backend_block_author_scan', 1 );

add_filter(
	'rest_endpoints',
	function ( $endpoints ) {
		if ( is_user_logged_in() ) {
			return $endpoints;
		}
		unset( $endpoints['/wp/v2/users'], $endpoints['/wp/v2/users/(?P<id>[\d]+)'] );
		return $endpoints;
	}
);

add_filter(
	'wp_sitemaps_add_provider',
	function ( $provider, $name ) {
		return 'users' === $name ? false : $provider;
	},
	10,
	2
);

// One message for a wrong username and a wrong password, so the login form
// does not reveal which accounts exist. Other messages (lockouts, two-factor
// prompts from security plugins) are left alone.
add_filter(
	'login_errors',
	function ( $message ) {
		global $errors;
		if ( is_wp_error( $errors ) && array_intersect( $errors->get_error_codes(), array( 'invalid_username', 'invalid_email', 'incorrect_password', 'invalidcombo' ) ) ) {
			return __( 'The login details are not correct.', 'nanodigest-backend' );
		}
		return $message;
	}
);
