<?php
/**
 * NanoDigest Backend - Meta Fields
 *
 * Submission details are private: none of them are exposed through the REST API.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function nanodigest_backend_register_meta_fields() {
	$fields = array(
		'nd_newsletter' => array( '_nd_email', '_nd_name', '_nd_interest', '_nd_submitted_at' ),
		'nd_contact'    => array( '_nd_name', '_nd_email', '_nd_company', '_nd_message', '_nd_submitted_at' ),
		'nd_advertise'  => array( '_nd_company', '_nd_contact', '_nd_email', '_nd_website', '_nd_budget', '_nd_goal', '_nd_message', '_nd_submitted_at' ),
		'nd_order'      => array( '_nd_name', '_nd_email', '_nd_phone', '_nd_address', '_nd_items', '_nd_status', '_nd_payment_reference', '_nd_payment_status', '_nd_submitted_at' ),
	);

	foreach ( $fields as $post_type => $keys ) {
		foreach ( $keys as $key ) {
			register_post_meta(
				$post_type,
				$key,
				array(
					'show_in_rest' => false,
					'single'       => true,
					'type'         => 'string',
				)
			);
		}
	}
}
