<?php
/**
 * NanoDigest Backend - Custom Post Types
 *
 * Submission storage replacing server/data/submissions.json.
 * Private, non-public post types managed through the NanoDigest admin menu.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function nanodigest_backend_submission_post_types() {
	return array(
		'nd_newsletter' => array(
			'name'          => __( 'Newsletter Subscribers', 'nanodigest-backend' ),
			'singular_name' => __( 'Newsletter Subscriber', 'nanodigest-backend' ),
			'menu_name'     => __( 'Newsletter', 'nanodigest-backend' ),
			'add_new_item'  => __( 'Add New Subscriber', 'nanodigest-backend' ),
			'edit_item'     => __( 'Edit Subscriber', 'nanodigest-backend' ),
			'search_items'  => __( 'Search Subscribers', 'nanodigest-backend' ),
			'not_found'     => __( 'No subscribers found', 'nanodigest-backend' ),
		),
		'nd_contact'    => array(
			'name'          => __( 'Contact Messages', 'nanodigest-backend' ),
			'singular_name' => __( 'Contact Message', 'nanodigest-backend' ),
			'menu_name'     => __( 'Contacts', 'nanodigest-backend' ),
			'add_new_item'  => __( 'Add New Message', 'nanodigest-backend' ),
			'edit_item'     => __( 'Edit Message', 'nanodigest-backend' ),
			'search_items'  => __( 'Search Messages', 'nanodigest-backend' ),
			'not_found'     => __( 'No messages found', 'nanodigest-backend' ),
		),
		'nd_advertise'  => array(
			'name'          => __( 'Advertise Inquiries', 'nanodigest-backend' ),
			'singular_name' => __( 'Advertise Inquiry', 'nanodigest-backend' ),
			'menu_name'     => __( 'Advertise', 'nanodigest-backend' ),
			'add_new_item'  => __( 'Add New Inquiry', 'nanodigest-backend' ),
			'edit_item'     => __( 'Edit Inquiry', 'nanodigest-backend' ),
			'search_items'  => __( 'Search Inquiries', 'nanodigest-backend' ),
			'not_found'     => __( 'No inquiries found', 'nanodigest-backend' ),
		),
		'nd_order'      => array(
			'name'          => __( 'Order Requests', 'nanodigest-backend' ),
			'singular_name' => __( 'Order Request', 'nanodigest-backend' ),
			'menu_name'     => __( 'Orders', 'nanodigest-backend' ),
			'add_new_item'  => __( 'Add New Order Request', 'nanodigest-backend' ),
			'edit_item'     => __( 'Edit Order Request', 'nanodigest-backend' ),
			'search_items'  => __( 'Search Order Requests', 'nanodigest-backend' ),
			'not_found'     => __( 'No order requests found', 'nanodigest-backend' ),
		),
	);
}

function nanodigest_backend_register_post_types() {
	foreach ( nanodigest_backend_submission_post_types() as $post_type => $labels ) {
		register_post_type(
			$post_type,
			array(
				'labels'             => array(
					'name'               => $labels['name'],
					'singular_name'      => $labels['singular_name'],
					'menu_name'          => $labels['menu_name'],
					'add_new'            => __( 'Add New', 'nanodigest-backend' ),
					'add_new_item'       => $labels['add_new_item'],
					'edit_item'          => $labels['edit_item'],
					'new_item'           => $labels['edit_item'],
					'view_item'          => $labels['edit_item'],
					'search_items'       => $labels['search_items'],
					'not_found'          => $labels['not_found'],
					'not_found_in_trash' => $labels['not_found'],
				),
				'public'             => false,
				'publicly_queryable' => false,
				'exclude_from_search' => true,
				'show_ui'            => true,
				'show_in_menu'       => false,
				'show_in_rest'       => false,
				'query_var'          => false,
				'rewrite'            => false,
				// Submissions hold personal details: administrators only, and
				// nobody creates one by hand.
				'map_meta_cap'       => false,
				'capabilities'       => array(
					'edit_post'              => 'manage_options',
					'read_post'              => 'manage_options',
					'delete_post'            => 'manage_options',
					'edit_posts'             => 'manage_options',
					'edit_others_posts'      => 'manage_options',
					'edit_private_posts'     => 'manage_options',
					'edit_published_posts'   => 'manage_options',
					'delete_posts'           => 'manage_options',
					'delete_others_posts'    => 'manage_options',
					'delete_private_posts'   => 'manage_options',
					'delete_published_posts' => 'manage_options',
					'publish_posts'          => 'manage_options',
					'read_private_posts'     => 'manage_options',
					'create_posts'           => 'do_not_allow',
				),
				'has_archive'        => false,
				'hierarchical'       => false,
				'supports'           => array( 'title', 'editor' ),
			)
		);
	}
}
