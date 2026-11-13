<?php
/**
 * NanoDigest Backend - REST Handlers
 *
 * Responses never echo the submitted personal details back: the browser
 * already has them, and a reply that repeats them is one more place for them
 * to leak (logs, caches, browser extensions).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function nanodigest_backend_handle_health() {
	return rest_ensure_response( array( 'status' => 'ok' ) );
}

function nanodigest_backend_param( $params, $key ) {
	if ( ! is_array( $params ) || ! isset( $params[ $key ] ) || ! is_scalar( $params[ $key ] ) ) {
		return '';
	}
	return (string) $params[ $key ];
}

function nanodigest_backend_success( $message, $extra = array() ) {
	$response = rest_ensure_response( array_merge( array( 'message' => $message ), $extra ) );
	$response->set_status( 201 );
	return $response;
}

/**
 * Shared gate for the public forms: spam trap first, then the rate limit.
 *
 * @return true|WP_REST_Response|WP_Error True to continue.
 */
function nanodigest_backend_gate( $bucket, $params, $spam_message ) {
	if ( nanodigest_backend_is_spam( $params ) ) {
		// Tell the bot it worked so it does not adapt; store nothing.
		return nanodigest_backend_success( $spam_message );
	}
	return nanodigest_backend_rate_limit_check( $bucket );
}

function nanodigest_backend_handle_newsletter( WP_REST_Request $request ) {
	$params  = $request->get_params();
	$message = 'Subscription saved successfully.';

	$gate = nanodigest_backend_gate( 'newsletter', $params, $message );
	if ( true !== $gate ) {
		return $gate;
	}

	$name     = nanodigest_backend_sanitize_text( nanodigest_backend_param( $params, 'name' ), 100 );
	$email    = nanodigest_backend_validate_email( nanodigest_backend_param( $params, 'email' ) );
	$interest = nanodigest_backend_sanitize_text( nanodigest_backend_param( $params, 'interest' ), 100 );

	if ( ! $email ) {
		return nanodigest_backend_format_error( 'A valid email address is required.' );
	}

	// Already subscribed: answer exactly as for a new subscriber, so the form
	// cannot be used to find out who is on the list.
	$existing = get_posts(
		array(
			'post_type'      => 'nd_newsletter',
			'post_status'    => 'any',
			'posts_per_page' => 1,
			'fields'         => 'ids',
			'meta_key'       => '_nd_email', // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key
			'meta_value'     => $email, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_value
		)
	);
	if ( $existing ) {
		return nanodigest_backend_success( $message );
	}

	$record_name = $name ? $name : 'Anonymous subscriber';

	$post_id = nanodigest_backend_create_submission_post(
		'nd_newsletter',
		'Newsletter: ' . $email,
		'',
		array(
			'_nd_email'    => $email,
			'_nd_name'     => $record_name,
			'_nd_interest' => $interest ? $interest : 'General updates',
		)
	);

	if ( is_wp_error( $post_id ) ) {
		return nanodigest_backend_format_error( 'Unable to save subscription.', 500, 'create_failed' );
	}

	return nanodigest_backend_success( $message );
}

function nanodigest_backend_handle_contact( WP_REST_Request $request ) {
	$params       = $request->get_params();
	$done_message = 'Message sent successfully. We will reply shortly.';

	$gate = nanodigest_backend_gate( 'contact', $params, $done_message );
	if ( true !== $gate ) {
		return $gate;
	}

	$name    = nanodigest_backend_sanitize_text( nanodigest_backend_param( $params, 'name' ), 100 );
	$email   = nanodigest_backend_validate_email( nanodigest_backend_param( $params, 'email' ) );
	$company = nanodigest_backend_sanitize_text( nanodigest_backend_param( $params, 'company' ), 150 );
	$message = nanodigest_backend_sanitize_textarea( nanodigest_backend_param( $params, 'message' ) );

	if ( ! $name || ! $message ) {
		return nanodigest_backend_format_error( 'Name, email, and message are required.' );
	}
	if ( ! $email ) {
		return nanodigest_backend_format_error( 'Please provide a valid email address.' );
	}

	$company = $company ? $company : 'Not provided';

	$post_id = nanodigest_backend_create_submission_post(
		'nd_contact',
		'Contact: ' . $name . ' (' . $email . ')',
		$message,
		array(
			'_nd_name'    => $name,
			'_nd_email'   => $email,
			'_nd_company' => $company,
			'_nd_message' => $message,
		)
	);

	if ( is_wp_error( $post_id ) ) {
		return nanodigest_backend_format_error( 'Unable to send message.', 500, 'create_failed' );
	}

	nanodigest_backend_notify(
		'Contact message from ' . $name,
		array(
			'Name'    => $name,
			'Email'   => $email,
			'Company' => $company,
			'Message' => "\n" . $message,
		),
		$email
	);

	return nanodigest_backend_success( $done_message );
}

function nanodigest_backend_handle_advertise( WP_REST_Request $request ) {
	$params       = $request->get_params();
	$done_message = 'Partnership request saved successfully.';

	$gate = nanodigest_backend_gate( 'advertise', $params, $done_message );
	if ( true !== $gate ) {
		return $gate;
	}

	$company = nanodigest_backend_sanitize_text( nanodigest_backend_param( $params, 'company' ), 150 );
	$contact = nanodigest_backend_sanitize_text( nanodigest_backend_param( $params, 'contact' ), 100 );
	$email   = nanodigest_backend_validate_email( nanodigest_backend_param( $params, 'email' ) );
	$website = nanodigest_backend_sanitize_url( nanodigest_backend_param( $params, 'website' ) );
	$budget  = nanodigest_backend_sanitize_text( nanodigest_backend_param( $params, 'budget' ), 100 );
	$goal    = nanodigest_backend_sanitize_text( nanodigest_backend_param( $params, 'goal' ), 100 );
	$message = nanodigest_backend_sanitize_textarea( nanodigest_backend_param( $params, 'message' ) );

	if ( ! $company || ! $contact || ! $goal || ! $message ) {
		return nanodigest_backend_format_error( 'Company, contact, email, goal, and message are required.' );
	}
	if ( ! $email ) {
		return nanodigest_backend_format_error( 'Please provide a valid email address.' );
	}

	$website = $website ? $website : 'Not provided';
	$budget  = $budget ? $budget : 'Not provided';

	$post_id = nanodigest_backend_create_submission_post(
		'nd_advertise',
		'Advertise: ' . $company,
		$message,
		array(
			'_nd_company' => $company,
			'_nd_contact' => $contact,
			'_nd_email'   => $email,
			'_nd_website' => $website,
			'_nd_budget'  => $budget,
			'_nd_goal'    => $goal,
			'_nd_message' => $message,
		)
	);

	if ( is_wp_error( $post_id ) ) {
		return nanodigest_backend_format_error( 'Unable to save partnership request.', 500, 'create_failed' );
	}

	nanodigest_backend_notify(
		'Advertising enquiry from ' . $company,
		array(
			'Company' => $company,
			'Contact' => $contact,
			'Email'   => $email,
			'Website' => $website,
			'Budget'  => $budget,
			'Goal'    => $goal,
			'Message' => "\n" . $message,
		),
		$email
	);

	return nanodigest_backend_success( $done_message );
}

function nanodigest_backend_handle_orders( WP_REST_Request $request ) {
	$params       = $request->get_params();
	$done_message = 'Order received. Nano Digest will confirm it once your bank transfer is verified.';

	$gate = nanodigest_backend_gate( 'orders', $params, $done_message );
	if ( true !== $gate ) {
		return $gate;
	}

	$name      = nanodigest_backend_sanitize_text( nanodigest_backend_param( $params, 'name' ), 100 );
	$email     = nanodigest_backend_validate_email( nanodigest_backend_param( $params, 'email' ) );
	$phone     = nanodigest_backend_sanitize_text( nanodigest_backend_param( $params, 'phone' ), 30 );
	$address   = nanodigest_backend_sanitize_textarea( nanodigest_backend_param( $params, 'address' ), 500 );
	$reference = nanodigest_backend_sanitize_text( nanodigest_backend_param( $params, 'paymentReference' ), 40 );
	$items     = isset( $params['items'] ) && is_array( $params['items'] ) ? $params['items'] : array();

	if ( ! $name || ! $address || empty( $items ) ) {
		return nanodigest_backend_format_error( 'Name, email, delivery address, and cart items are required.' );
	}
	if ( ! $email ) {
		return nanodigest_backend_format_error( 'Please provide a valid email address.' );
	}
	if ( count( $items ) > 10 ) {
		return nanodigest_backend_format_error( 'Cart items must include a valid product and quantity.' );
	}

	$clean_items = array();
	foreach ( $items as $item ) {
		$product_id = is_array( $item ) && isset( $item['productId'] ) ? filter_var( $item['productId'], FILTER_VALIDATE_INT ) : false;
		$quantity   = is_array( $item ) && isset( $item['quantity'] ) ? filter_var( $item['quantity'], FILTER_VALIDATE_INT ) : false;
		$item_name  = is_array( $item ) && isset( $item['name'] ) ? nanodigest_backend_sanitize_text( $item['name'], 200 ) : '';

		if ( false === $product_id || $product_id <= 0 || false === $quantity || $quantity < 1 || $quantity > 20 ) {
			return nanodigest_backend_format_error( 'Cart items must include a valid product and quantity.' );
		}

		$clean_items[] = array(
			'productId' => $product_id,
			'name'      => $item_name,
			'quantity'  => $quantity,
		);
	}

	$phone     = $phone ? $phone : 'Not provided';
	$customer  = compact( 'name', 'email', 'phone', 'address', 'reference' );
	$has_store = function_exists( 'wc_create_order' ) && function_exists( 'wc_get_product' );

	$result = $has_store
		? nanodigest_backend_create_store_order( $customer, $clean_items )
		: nanodigest_backend_create_order_request( $customer, $clean_items );

	if ( is_wp_error( $result ) ) {
		return $result;
	}

	nanodigest_backend_notify(
		'New order ' . $result['number'] . ' from ' . $name,
		array(
			'Order'             => $result['number'],
			'Items'             => "\n" . implode( "\n", $result['lines'] ),
			'Total'             => $result['total'],
			'Payment reference' => $reference ? $reference : 'Not provided',
			'Name'              => $name,
			'Email'             => $email,
			'Phone'             => $phone,
			'Delivery address'  => "\n" . $address,
		),
		$email
	);

	if ( ! $reference ) {
		$done_message = 'Order request received. No payment has been taken; Nano Digest will contact you to complete it.';
	}

	return nanodigest_backend_success( $done_message, array( 'orderNumber' => $result['number'] ) );
}

/**
 * Creates a real WooCommerce order, on hold until the transfer is verified.
 * Products and prices come from the store, never from the browser.
 *
 * @return array|WP_Error number, total and item lines.
 */
function nanodigest_backend_create_store_order( $customer, $items ) {
	$products = array();
	foreach ( $items as $item ) {
		$product = wc_get_product( $item['productId'] );
		if ( ! $product || 'publish' !== $product->get_status() || ! $product->is_purchasable() || ! $product->is_in_stock() ) {
			return nanodigest_backend_format_error( 'One of the items in your cart is no longer available.' );
		}
		if ( ! $product->has_enough_stock( $item['quantity'] ) ) {
			return nanodigest_backend_format_error( 'There is not enough stock for the quantity you asked for.' );
		}
		$products[] = array( $product, $item['quantity'] );
	}

	try {
		$order = wc_create_order( array( 'created_via' => 'nanodigest' ) );
		if ( is_wp_error( $order ) ) {
			throw new Exception( $order->get_error_message() );
		}

		$lines = array();
		foreach ( $products as $entry ) {
			$order->add_product( $entry[0], $entry[1] );
			$lines[] = $entry[1] . ' x ' . $entry[0]->get_name();
		}

		$name_parts = explode( ' ', $customer['name'], 2 );
		$address    = array(
			'first_name' => $name_parts[0],
			'last_name'  => isset( $name_parts[1] ) ? $name_parts[1] : '',
			'email'      => $customer['email'],
			'phone'      => 'Not provided' === $customer['phone'] ? '' : $customer['phone'],
			'address_1'  => preg_replace( '/\s*[\r\n]+\s*/', ', ', $customer['address'] ),
		);
		$order->set_address( $address, 'billing' );
		unset( $address['email'], $address['phone'] );
		$order->set_address( $address, 'shipping' );

		// Not a registered gateway id on purpose: WooCommerce's own "Direct
		// bank transfer" gateway would add its separately configured account
		// details to the customer email.
		$order->set_payment_method( 'nanodigest_bank' );
		$order->set_payment_method_title( 'Bank transfer (NEFT / IMPS / UPI)' );
		if ( $customer['reference'] ) {
			$order->update_meta_data( '_nd_payment_reference', $customer['reference'] );
		}
		$order->calculate_totals();

		$note = $customer['reference']
			? 'Bank transfer reference (UTR) given by the customer: ' . $customer['reference'] . '. Check the bank statement before marking this order as Processing.'
			: 'Placed without a payment reference. Contact the customer to arrange payment.';
		$order->update_status( 'on-hold', $note );

		return array(
			'number' => '#' . $order->get_order_number(),
			'total'  => html_entity_decode( wp_strip_all_tags( $order->get_formatted_order_total() ), ENT_QUOTES, 'UTF-8' ),
			'lines'  => $lines,
		);
	} catch ( Exception $e ) {
		return nanodigest_backend_format_error( 'Unable to save your order request.', 500, 'create_failed' );
	}
}

/**
 * Fallback when WooCommerce is not active: keep the order as a submission.
 *
 * @return array|WP_Error number, total and item lines.
 */
function nanodigest_backend_create_order_request( $customer, $items ) {
	$lines = array();
	foreach ( $items as $item ) {
		if ( ! $item['name'] ) {
			return nanodigest_backend_format_error( 'Cart items must include a valid product and quantity.' );
		}
		$lines[] = $item['quantity'] . ' x ' . $item['name'] . ' (product #' . $item['productId'] . ')';
	}

	$content = implode( "\n", array( $customer['name'], $customer['email'], $customer['phone'], $customer['address'], '', implode( "\n", $lines ) ) );

	$post_id = nanodigest_backend_create_submission_post(
		'nd_order',
		'Order: ' . $customer['name'],
		$content,
		array(
			'_nd_name'              => $customer['name'],
			'_nd_email'             => $customer['email'],
			'_nd_phone'             => $customer['phone'],
			'_nd_address'           => $customer['address'],
			'_nd_items'             => wp_json_encode( $items ),
			'_nd_status'            => 'request_received',
			'_nd_payment_reference' => $customer['reference'] ? $customer['reference'] : 'Not provided',
			'_nd_payment_status'    => $customer['reference'] ? 'awaiting_verification' : 'not_processed',
		)
	);

	if ( is_wp_error( $post_id ) ) {
		return nanodigest_backend_format_error( 'Unable to save your order request.', 500, 'create_failed' );
	}

	return array(
		'number' => 'R' . $post_id,
		'total'  => 'To be confirmed',
		'lines'  => $lines,
	);
}

function nanodigest_backend_handle_summary() {
	return rest_ensure_response( nanodigest_backend_submission_counts() );
}
