<?php
/**
 * NanoDigest Backend - REST API Endpoints
 *
 * Public form endpoints:
 *   POST /wp-json/nanodigest/v1/newsletter
 *   POST /wp-json/nanodigest/v1/contact
 *   POST /wp-json/nanodigest/v1/advertise
 *   POST /wp-json/nanodigest/v1/orders
 *   GET  /wp-json/nanodigest/v1/health
 * Admin-only:
 *   GET  /wp-json/nanodigest/v1/summary
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function nanodigest_backend_is_our_rest_request() {
	$request_uri = isset( $_SERVER['REQUEST_URI'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REQUEST_URI'] ) ) : '';
	return false !== strpos( $request_uri, NANODIGEST_BACKEND_REST_NAMESPACE . '/' );
}

/**
 * True when the browser's Origin header is this site or an address listed in
 * the settings. Requests without an Origin header (same-origin GETs, server
 * to server calls) are not browsers on another website, so they pass.
 */
function nanodigest_backend_origin_allowed() {
	$origin = get_http_origin();
	if ( empty( $origin ) ) {
		return true;
	}
	return in_array( strtolower( untrailingslashit( $origin ) ), nanodigest_backend_allowed_origins(), true );
}

/**
 * WordPress answers REST requests from any website by default. For this
 * plugin's routes, replace that with an allow-list.
 */
function nanodigest_backend_cors( $served ) {
	if ( ! nanodigest_backend_is_our_rest_request() ) {
		return $served;
	}

	header_remove( 'Access-Control-Allow-Origin' );
	header_remove( 'Access-Control-Allow-Credentials' );
	header_remove( 'Access-Control-Allow-Methods' );

	$origin = get_http_origin();
	if ( $origin && nanodigest_backend_origin_allowed() ) {
		header( 'Access-Control-Allow-Origin: ' . esc_url_raw( $origin ) );
		header( 'Access-Control-Allow-Methods: GET, POST, OPTIONS' );
		header( 'Access-Control-Allow-Headers: Content-Type' );
		header( 'Access-Control-Max-Age: 600' );
	}
	header( 'Vary: Origin', false );

	return $served;
}
add_filter( 'rest_pre_serve_request', 'nanodigest_backend_cors', 20 );

/**
 * Permission check shared by the public form routes.
 */
function nanodigest_backend_public_permission() {
	if ( ! nanodigest_backend_origin_allowed() ) {
		return new WP_Error( 'forbidden_origin', 'This website is not allowed to submit forms here.', array( 'status' => 403 ) );
	}
	return true;
}

function nanodigest_backend_register_rest_routes() {
	$namespace = NANODIGEST_BACKEND_REST_NAMESPACE;

	register_rest_route(
		$namespace,
		'/health',
		array(
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => 'nanodigest_backend_handle_health',
			'permission_callback' => '__return_true',
		)
	);

	$forms = array(
		'/newsletter' => 'nanodigest_backend_handle_newsletter',
		'/contact'    => 'nanodigest_backend_handle_contact',
		'/advertise'  => 'nanodigest_backend_handle_advertise',
		'/orders'     => 'nanodigest_backend_handle_orders',
	);

	foreach ( $forms as $route => $callback ) {
		register_rest_route(
			$namespace,
			$route,
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => $callback,
				'permission_callback' => 'nanodigest_backend_public_permission',
			)
		);
	}

	register_rest_route(
		$namespace,
		'/summary',
		array(
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => 'nanodigest_backend_handle_summary',
			'permission_callback' => function () {
				return current_user_can( 'manage_options' );
			},
		)
	);

	// Nano TV: the old theme kept each video's address in post meta. Expose it
	// so the website can show the player.
	register_rest_field(
		'post',
		'nd_video_url',
		array(
			'get_callback' => 'nanodigest_backend_post_video_url',
			'schema'       => array(
				'description' => 'Video address for video-format posts.',
				'type'        => 'string',
				'context'     => array( 'view' ),
			),
		)
	);
}

function nanodigest_backend_post_video_url( $post ) {
	$post_id = isset( $post['id'] ) ? (int) $post['id'] : 0;
	if ( ! $post_id || 'video' !== get_post_format( $post_id ) ) {
		return '';
	}

	$raw = (string) get_post_meta( $post_id, '_format_video_embed', true );
	if ( '' === $raw ) {
		return '';
	}
	// The field may hold a plain address or a whole <iframe> snippet.
	if ( preg_match( '#https?://[^\s"\'<>]+#i', $raw, $match ) ) {
		return esc_url_raw( $match[0], array( 'http', 'https' ) );
	}
	return '';
}
