<?php
/**
 * NanoDigest Backend - Article views and shares
 *
 * The article page shows how many times it was read and shared:
 *   POST /wp-json/nanodigest/v1/views   { id }            counts one reading
 *   POST /wp-json/nanodigest/v1/shares  { id, network }   counts one share
 * Both answer with the current totals: { views, shares }.
 *
 * Totals are kept in the post meta fields _nd_views and _nd_shares. If the
 * old theme's totals should carry over, enter its meta field names at
 * NanoDigest > Settings; they are added to the new totals when shown.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Share buttons that are counted (copy = the "Copy link" button).
 */
function nanodigest_backend_share_networks() {
	return array( 'facebook', 'x', 'whatsapp', 'linkedin', 'copy' );
}

/**
 * The published article for an id, or null. Only public articles are counted,
 * so ids of drafts, pages or private records cannot be probed.
 */
function nanodigest_backend_countable_post( $post_id ) {
	$post = $post_id ? get_post( $post_id ) : null;
	if ( ! $post || 'post' !== $post->post_type || 'publish' !== $post->post_status || ! empty( $post->post_password ) ) {
		return null;
	}
	return $post;
}

/**
 * Article id from the request body: digits only, at most nine of them.
 */
function nanodigest_backend_counter_post_id( $params ) {
	$id = nanodigest_backend_param( $params, 'id' );
	return ( '' !== $id && ctype_digit( $id ) && strlen( $id ) <= 9 ) ? (int) $id : 0;
}

/**
 * Search engines and other robots must not inflate the totals.
 */
function nanodigest_backend_is_robot() {
	$agent = isset( $_SERVER['HTTP_USER_AGENT'] ) ? strtolower( sanitize_text_field( wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) ) ) : '';
	if ( '' === $agent ) {
		return true;
	}
	return (bool) preg_match( '/bot|crawl|spider|slurp|facebookexternalhit|headlesschrome|curl\/|wget\/|python-requests/', $agent );
}

/**
 * True when this reader (address + browser) already counted the same thing
 * recently; otherwise remembers it for $ttl seconds.
 */
function nanodigest_backend_already_counted( $what, $post_id, $ttl ) {
	$agent = isset( $_SERVER['HTTP_USER_AGENT'] ) ? sanitize_text_field( wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) ) : '';
	$key   = 'nd_ctr_' . md5( $what . '|' . $post_id . '|' . nanodigest_backend_client_ip() . '|' . $agent );
	if ( false !== get_transient( $key ) ) {
		return true;
	}
	set_transient( $key, 1, $ttl );
	return false;
}

/**
 * Total shown for one article: the new counter plus the old theme's, if its
 * meta field name was entered in the settings.
 *
 * @param string $type 'views' or 'shares'.
 */
function nanodigest_backend_counter_total( $post_id, $type ) {
	$total = absint( get_post_meta( $post_id, '_nd_' . $type, true ) );

	$legacy_key = nanodigest_backend_setting( 'legacy_' . $type . '_key' );
	if ( '' !== $legacy_key ) {
		$total += absint( get_post_meta( $post_id, $legacy_key, true ) );
	}

	return $total;
}

/**
 * Adds one to a counter. Uses a single UPDATE so two readers arriving
 * together are both counted.
 */
function nanodigest_backend_counter_increment( $post_id, $type ) {
	global $wpdb;

	$key     = '_nd_' . $type;
	$updated = $wpdb->query( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$wpdb->prepare(
			"UPDATE {$wpdb->postmeta} SET meta_value = meta_value + 1 WHERE post_id = %d AND meta_key = %s",
			$post_id,
			$key
		)
	);

	if ( ! $updated ) {
		// First count for this article.
		add_post_meta( $post_id, $key, 1, true );
	}

	wp_cache_delete( $post_id, 'post_meta' );
}

function nanodigest_backend_counts_response( $post_id ) {
	$response = rest_ensure_response(
		array(
			'views'  => nanodigest_backend_counter_total( $post_id, 'views' ),
			'shares' => nanodigest_backend_counter_total( $post_id, 'shares' ),
		)
	);
	// Totals change with every reading; never serve a cached copy.
	$response->header( 'Cache-Control', 'no-store' );
	return $response;
}

function nanodigest_backend_handle_views( WP_REST_Request $request ) {
	$post_id = nanodigest_backend_counter_post_id( $request->get_params() );
	if ( ! nanodigest_backend_countable_post( $post_id ) ) {
		return nanodigest_backend_format_error( 'Article not found.', 404, 'not_found' );
	}

	// A reader who opens very many articles quickly still gets the totals, but
	// stops adding to them.
	$within_limit = ( true === nanodigest_backend_rate_limit_check( 'views', 120, 600 ) );

	if ( $within_limit && ! nanodigest_backend_is_robot() && ! nanodigest_backend_already_counted( 'views', $post_id, 30 * MINUTE_IN_SECONDS ) ) {
		nanodigest_backend_counter_increment( $post_id, 'views' );
	}

	return nanodigest_backend_counts_response( $post_id );
}

function nanodigest_backend_handle_shares( WP_REST_Request $request ) {
	$params  = $request->get_params();
	$post_id = nanodigest_backend_counter_post_id( $params );
	$network = strtolower( nanodigest_backend_param( $params, 'network' ) );

	if ( ! in_array( $network, nanodigest_backend_share_networks(), true ) ) {
		return nanodigest_backend_format_error( 'A valid share network is required.' );
	}
	if ( ! nanodigest_backend_countable_post( $post_id ) ) {
		return nanodigest_backend_format_error( 'Article not found.', 404, 'not_found' );
	}

	$within_limit = ( true === nanodigest_backend_rate_limit_check( 'shares', 120, 600 ) );

	// One share per reader, article and button per minute: a double click counts once.
	if ( $within_limit && ! nanodigest_backend_is_robot() && ! nanodigest_backend_already_counted( 'shares-' . $network, $post_id, MINUTE_IN_SECONDS ) ) {
		nanodigest_backend_counter_increment( $post_id, 'shares' );
	}

	return nanodigest_backend_counts_response( $post_id );
}
