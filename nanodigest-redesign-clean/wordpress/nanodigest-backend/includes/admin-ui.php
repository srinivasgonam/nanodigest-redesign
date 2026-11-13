<?php
/**
 * NanoDigest Backend - Admin UI
 *
 * Adds a top-level "NanoDigest" menu: a dashboard, one list per submission
 * type, a subscriber export and the settings page.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function nanodigest_backend_submission_types() {
	return array(
		'newsletters' => array( 'nd_newsletter', __( 'Newsletter', 'nanodigest-backend' ) ),
		'contacts'    => array( 'nd_contact', __( 'Contacts', 'nanodigest-backend' ) ),
		'advertise'   => array( 'nd_advertise', __( 'Advertise', 'nanodigest-backend' ) ),
		'orders'      => array( 'nd_order', __( 'Order requests', 'nanodigest-backend' ) ),
	);
}

function nanodigest_backend_submission_counts() {
	$counts = array();
	foreach ( nanodigest_backend_submission_types() as $key => $type ) {
		$total = 0;
		foreach ( (array) wp_count_posts( $type[0] ) as $status => $count ) {
			if ( 'trash' !== $status && 'auto-draft' !== $status ) {
				$total += (int) $count;
			}
		}
		$counts[ $key ] = $total;
	}
	return $counts;
}

function nanodigest_backend_admin_setup() {
	add_menu_page(
		__( 'NanoDigest', 'nanodigest-backend' ),
		__( 'NanoDigest', 'nanodigest-backend' ),
		'manage_options',
		'nanodigest-admin',
		'nanodigest_backend_admin_dashboard',
		'dashicons-analytics',
		30
	);

	add_submenu_page(
		'nanodigest-admin',
		__( 'Dashboard', 'nanodigest-backend' ),
		__( 'Dashboard', 'nanodigest-backend' ),
		'manage_options',
		'nanodigest-admin',
		'nanodigest_backend_admin_dashboard'
	);

	foreach ( nanodigest_backend_submission_types() as $type ) {
		add_submenu_page(
			'nanodigest-admin',
			$type[1],
			$type[1],
			'manage_options',
			'edit.php?post_type=' . $type[0]
		);
	}

	add_submenu_page(
		'nanodigest-admin',
		__( 'NanoDigest Settings', 'nanodigest-backend' ),
		__( 'Settings', 'nanodigest-backend' ),
		'manage_options',
		'nanodigest-settings',
		'nanodigest_backend_settings_page'
	);
}

function nanodigest_backend_admin_dashboard() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$counts     = nanodigest_backend_submission_counts();
	$export_url = wp_nonce_url( admin_url( 'admin-post.php?action=nanodigest_export_newsletter' ), 'nanodigest_export_newsletter' );
	?>
	<div class="wrap">
		<h1><?php esc_html_e( 'NanoDigest Submissions', 'nanodigest-backend' ); ?></h1>
		<p><?php esc_html_e( 'Everything visitors send through the website forms.', 'nanodigest-backend' ); ?></p>
		<table class="widefat striped" style="max-width: 640px;">
			<thead>
				<tr>
					<th><?php esc_html_e( 'Type', 'nanodigest-backend' ); ?></th>
					<th><?php esc_html_e( 'Submissions', 'nanodigest-backend' ); ?></th>
					<th><?php esc_html_e( 'Manage', 'nanodigest-backend' ); ?></th>
				</tr>
			</thead>
			<tbody>
				<?php foreach ( nanodigest_backend_submission_types() as $key => $type ) : ?>
					<tr>
						<td><?php echo esc_html( $type[1] ); ?></td>
						<td><?php echo esc_html( (string) $counts[ $key ] ); ?></td>
						<td><a href="<?php echo esc_url( admin_url( 'edit.php?post_type=' . $type[0] ) ); ?>"><?php esc_html_e( 'View', 'nanodigest-backend' ); ?></a></td>
					</tr>
				<?php endforeach; ?>
			</tbody>
		</table>

		<?php if ( function_exists( 'wc_get_orders' ) ) : ?>
			<p>
				<?php esc_html_e( 'Shop orders placed on the website are WooCommerce orders. Each one stays "On hold" until you have checked the bank transfer.', 'nanodigest-backend' ); ?>
				<a href="<?php echo esc_url( admin_url( 'admin.php?page=wc-orders' ) ); ?>"><?php esc_html_e( 'Open WooCommerce orders', 'nanodigest-backend' ); ?></a>
			</p>
		<?php endif; ?>

		<p>
			<a class="button button-secondary" href="<?php echo esc_url( $export_url ); ?>"><?php esc_html_e( 'Download newsletter subscribers (CSV)', 'nanodigest-backend' ); ?></a>
			<a class="button button-secondary" href="<?php echo esc_url( admin_url( 'admin.php?page=nanodigest-settings' ) ); ?>"><?php esc_html_e( 'Settings', 'nanodigest-backend' ); ?></a>
		</p>
	</div>
	<?php
}

/**
 * Spreadsheet programs run cells that start with = + - or @ as formulas.
 * Prefix those with a quote so a subscriber's "name" cannot become one.
 */
function nanodigest_backend_csv_cell( $value ) {
	$value = (string) $value;
	if ( '' !== $value && false !== strpos( "=+-@\t\r", $value[0] ) ) {
		$value = "'" . $value;
	}
	return $value;
}

function nanodigest_backend_export_newsletter() {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( esc_html__( 'You are not allowed to export subscribers.', 'nanodigest-backend' ), 403 );
	}
	check_admin_referer( 'nanodigest_export_newsletter' );

	$ids = get_posts(
		array(
			'post_type'      => 'nd_newsletter',
			'post_status'    => array( 'private', 'publish', 'draft' ),
			'posts_per_page' => -1,
			'fields'         => 'ids',
			'orderby'        => 'date',
			'order'          => 'ASC',
		)
	);

	nocache_headers();
	header( 'Content-Type: text/csv; charset=utf-8' );
	header( 'Content-Disposition: attachment; filename="nanodigest-subscribers-' . gmdate( 'Y-m-d' ) . '.csv"' );

	$out = fopen( 'php://output', 'w' );
	fputcsv( $out, array( 'Email', 'Name', 'Interest', 'Subscribed at' ) );
	foreach ( $ids as $id ) {
		fputcsv(
			$out,
			array_map(
				'nanodigest_backend_csv_cell',
				array(
					get_post_meta( $id, '_nd_email', true ),
					get_post_meta( $id, '_nd_name', true ),
					get_post_meta( $id, '_nd_interest', true ),
					get_post_meta( $id, '_nd_submitted_at', true ),
				)
			)
		);
	}
	fclose( $out ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
	exit;
}
add_action( 'admin_post_nanodigest_export_newsletter', 'nanodigest_backend_export_newsletter' );

/**
 * Show useful columns in each submission list table.
 */
function nanodigest_backend_submission_columns( $columns ) {
	$new = array();
	foreach ( $columns as $key => $label ) {
		$new[ $key ] = $label;
		if ( 'title' === $key ) {
			$new['nd_email']   = __( 'Email', 'nanodigest-backend' );
			$new['nd_details'] = __( 'Details', 'nanodigest-backend' );
		}
	}
	return $new;
}

function nanodigest_backend_submission_column_content( $column, $post_id ) {
	if ( 'nd_email' === $column ) {
		echo esc_html( (string) get_post_meta( $post_id, '_nd_email', true ) );
		return;
	}

	if ( 'nd_details' !== $column ) {
		return;
	}

	$labels = array(
		'nd_newsletter' => array(
			'Name'     => '_nd_name',
			'Interest' => '_nd_interest',
		),
		'nd_contact'    => array(
			'Name'    => '_nd_name',
			'Company' => '_nd_company',
		),
		'nd_advertise'  => array(
			'Company' => '_nd_company',
			'Contact' => '_nd_contact',
			'Goal'    => '_nd_goal',
			'Budget'  => '_nd_budget',
			'Website' => '_nd_website',
		),
		'nd_order'      => array(
			'Name'    => '_nd_name',
			'Phone'   => '_nd_phone',
			'Status'  => '_nd_status',
			'UTR'     => '_nd_payment_reference',
			'Payment' => '_nd_payment_status',
		),
	);

	$post_type = get_post_type( $post_id );
	$parts     = array();
	foreach ( isset( $labels[ $post_type ] ) ? $labels[ $post_type ] : array() as $label => $key ) {
		$value = (string) get_post_meta( $post_id, $key, true );
		if ( '' !== $value && 'Not provided' !== $value ) {
			$parts[] = $label . ': ' . $value;
		}
	}
	echo esc_html( implode( ' · ', $parts ) );
}

foreach ( array( 'nd_newsletter', 'nd_contact', 'nd_advertise', 'nd_order' ) as $nanodigest_backend_type ) {
	add_filter( 'manage_' . $nanodigest_backend_type . '_posts_columns', 'nanodigest_backend_submission_columns' );
	add_action( 'manage_' . $nanodigest_backend_type . '_posts_custom_column', 'nanodigest_backend_submission_column_content', 10, 2 );
}
unset( $nanodigest_backend_type );

/**
 * Show the customer's transfer reference on the WooCommerce order screen.
 */
function nanodigest_backend_order_reference( $order ) {
	$reference = $order->get_meta( '_nd_payment_reference' );
	if ( $reference ) {
		echo '<p><strong>' . esc_html__( 'Bank transfer reference (UTR):', 'nanodigest-backend' ) . '</strong><br />' . esc_html( $reference ) . '</p>';
	}
}
add_action( 'woocommerce_admin_order_data_after_billing_address', 'nanodigest_backend_order_reference' );
