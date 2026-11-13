<?php
/**
 * NanoDigest Backend - Helper Functions
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Cuts a string to a maximum number of characters (multibyte safe).
 */
function nanodigest_backend_limit( $value, $max ) {
	if ( function_exists( 'mb_substr' ) ) {
		return mb_substr( $value, 0, $max );
	}
	return substr( $value, 0, $max );
}

function nanodigest_backend_sanitize_text( $value, $max = 200 ) {
	if ( ! is_scalar( $value ) ) {
		return '';
	}
	return nanodigest_backend_limit( trim( sanitize_text_field( (string) $value ) ), $max );
}

function nanodigest_backend_sanitize_textarea( $value, $max = 5000 ) {
	if ( ! is_scalar( $value ) ) {
		return '';
	}
	return nanodigest_backend_limit( trim( sanitize_textarea_field( (string) $value ) ), $max );
}

function nanodigest_backend_sanitize_url( $value ) {
	if ( ! is_scalar( $value ) ) {
		return '';
	}
	$value = trim( (string) $value );
	if ( '' === $value || strlen( $value ) > 300 ) {
		return '';
	}
	if ( ! preg_match( '#^https?://#i', $value ) ) {
		$value = 'https://' . $value;
	}
	return esc_url_raw( $value, array( 'http', 'https' ) );
}

/**
 * @return string|false The sanitized email, or false when invalid.
 */
function nanodigest_backend_validate_email( $value ) {
	$email = nanodigest_backend_sanitize_text( $value, 254 );
	if ( '' === $email || ! is_email( $email ) ) {
		return false;
	}
	return sanitize_email( $email );
}

function nanodigest_backend_get_current_datetime() {
	return gmdate( 'c' );
}

function nanodigest_backend_format_error( $message, $status = 400, $code = 'nanodigest_error' ) {
	return new WP_Error( $code, $message, array( 'status' => $status ) );
}

/**
 * The visitor's address as seen by the web server.
 *
 * Forwarded headers are deliberately not trusted: a visitor can set them to
 * any value, which would let them dodge the rate limit.
 */
function nanodigest_backend_client_ip() {
	$ip = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '';
	return filter_var( $ip, FILTER_VALIDATE_IP ) ? $ip : 'unknown';
}

/**
 * Fixed-window rate limit for public form endpoints, stored in transients.
 *
 * @param string $bucket Route name (newsletter, contact, ...).
 * @param int    $limit  Maximum submissions allowed per window.
 * @param int    $window Window length in seconds.
 * @return true|WP_Error True when allowed, WP_Error 429 when limited.
 */
function nanodigest_backend_rate_limit_check( $bucket, $limit = 5, $window = 600 ) {
	$ip   = nanodigest_backend_client_ip();
	$key  = 'nd_rl_' . md5( $bucket . '|' . $ip );
	$data = get_transient( $key );

	if ( ! is_array( $data ) || ! isset( $data['count'], $data['expires'] ) || $data['expires'] <= time() ) {
		$data = array(
			'count'   => 0,
			'expires' => time() + $window,
		);
	}

	if ( $data['count'] >= $limit ) {
		return new WP_Error(
			'too_many_requests',
			'Too many requests. Please try again in a few minutes.',
			array( 'status' => 429 )
		);
	}

	$data['count']++;
	set_transient( $key, $data, max( 1, $data['expires'] - time() ) );

	return true;
}

/**
 * Bots fill every field they find. The forms carry a hidden "website_url"
 * field that people never see, so any value in it marks the request as spam.
 */
function nanodigest_backend_is_spam( $params ) {
	return is_array( $params ) && ! empty( $params['website_url'] );
}

/**
 * Creates a private submission post holding the form record.
 *
 * @return int|WP_Error Post ID or error.
 */
function nanodigest_backend_create_submission_post( $post_type, $title, $content = '', $meta = array() ) {
	if ( ! isset( $meta['_nd_submitted_at'] ) ) {
		$meta['_nd_submitted_at'] = nanodigest_backend_get_current_datetime();
	}

	return wp_insert_post(
		array(
			'post_type'    => $post_type,
			'post_title'   => $title,
			'post_content' => $content,
			'post_status'  => 'private',
			'meta_input'   => $meta,
		),
		true
	);
}

/**
 * Emails the team about a new submission.
 *
 * @param string $subject  Subject line (plain text).
 * @param array  $lines    Label => value pairs for the body.
 * @param string $reply_to A validated email address, or ''.
 */
function nanodigest_backend_notify( $subject, $lines, $reply_to = '' ) {
	$to = nanodigest_backend_setting( 'notify_email' );
	if ( ! $to || ! is_email( $to ) ) {
		$to = get_option( 'admin_email' );
	}
	if ( ! $to ) {
		return;
	}

	$body = '';
	foreach ( $lines as $label => $value ) {
		$body .= $label . ': ' . $value . "\n";
	}
	$body .= "\n" . 'Manage submissions: ' . admin_url( 'admin.php?page=nanodigest-admin' ) . "\n";

	$headers = array();
	if ( $reply_to && is_email( $reply_to ) ) {
		// is_email() rejects line breaks, so this cannot inject extra headers.
		$headers[] = 'Reply-To: ' . $reply_to;
	}

	// Subjects must be a single line.
	$subject = preg_replace( '/[\r\n]+/', ' ', $subject );

	wp_mail( $to, '[Nano Digest] ' . $subject, $body, $headers );
}
