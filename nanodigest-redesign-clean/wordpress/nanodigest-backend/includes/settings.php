<?php
/**
 * NanoDigest Backend - Settings
 *
 * One option (nanodigest_backend_settings) edited at NanoDigest > Settings.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function nanodigest_backend_setting_defaults() {
	return array(
		'notify_email'        => '',
		'allowed_origins'     => '',
		'bank_account_name'   => '',
		'bank_account_number' => '',
		'bank_ifsc'           => '',
		'bank_name'           => '',
		'bank_branch'         => '',
		'bank_account_type'   => '',
		'bank_upi'            => '',
	);
}

function nanodigest_backend_settings() {
	$saved = get_option( 'nanodigest_backend_settings', array() );
	return array_merge( nanodigest_backend_setting_defaults(), is_array( $saved ) ? $saved : array() );
}

function nanodigest_backend_setting( $key ) {
	$settings = nanodigest_backend_settings();
	return isset( $settings[ $key ] ) ? (string) $settings[ $key ] : '';
}

/**
 * Bank transfer details for the checkout page, or null when the account
 * number or IFSC is missing (the website then uses its built-in details).
 */
function nanodigest_backend_bank_details() {
	$settings = nanodigest_backend_settings();
	if ( '' === $settings['bank_account_number'] || '' === $settings['bank_ifsc'] ) {
		return null;
	}
	return array(
		'accountName'   => $settings['bank_account_name'],
		'accountNumber' => $settings['bank_account_number'],
		'ifsc'          => $settings['bank_ifsc'],
		'bankName'      => $settings['bank_name'],
		'branch'        => $settings['bank_branch'],
		'accountType'   => $settings['bank_account_type'],
		'upiId'         => $settings['bank_upi'],
	);
}

/**
 * Website addresses allowed to post the forms from a browser: this site,
 * plus any extra addresses entered in the settings (one per line).
 */
function nanodigest_backend_allowed_origins() {
	$origins = array();
	foreach ( array( home_url(), site_url() ) as $url ) {
		$parts = wp_parse_url( $url );
		if ( ! empty( $parts['scheme'] ) && ! empty( $parts['host'] ) ) {
			$origins[] = $parts['scheme'] . '://' . $parts['host'] . ( isset( $parts['port'] ) ? ':' . $parts['port'] : '' );
		}
	}

	$extra = preg_split( '/\s+/', nanodigest_backend_setting( 'allowed_origins' ) );
	foreach ( (array) $extra as $origin ) {
		$origin = untrailingslashit( trim( $origin ) );
		if ( preg_match( '#^https?://[a-z0-9.\-]+(:\d+)?$#i', $origin ) ) {
			$origins[] = $origin;
		}
	}

	return array_unique( array_map( 'strtolower', apply_filters( 'nanodigest_backend_allowed_origins', $origins ) ) );
}

function nanodigest_backend_sanitize_settings( $input ) {
	$input = is_array( $input ) ? $input : array();
	$clean = nanodigest_backend_setting_defaults();

	$email                 = isset( $input['notify_email'] ) ? sanitize_email( $input['notify_email'] ) : '';
	$clean['notify_email'] = is_email( $email ) ? $email : '';

	$clean['allowed_origins'] = isset( $input['allowed_origins'] ) ? sanitize_textarea_field( $input['allowed_origins'] ) : '';

	foreach ( array( 'bank_account_name', 'bank_account_number', 'bank_ifsc', 'bank_name', 'bank_branch', 'bank_account_type', 'bank_upi' ) as $key ) {
		$clean[ $key ] = isset( $input[ $key ] ) ? nanodigest_backend_sanitize_text( $input[ $key ], 120 ) : '';
	}

	return $clean;
}

function nanodigest_backend_register_settings() {
	register_setting(
		'nanodigest_backend',
		'nanodigest_backend_settings',
		array(
			'type'              => 'array',
			'sanitize_callback' => 'nanodigest_backend_sanitize_settings',
			'default'           => nanodigest_backend_setting_defaults(),
		)
	);
}
add_action( 'admin_init', 'nanodigest_backend_register_settings' );

function nanodigest_backend_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$settings = nanodigest_backend_settings();
	$fields   = array(
		'bank_account_name'   => __( 'Account name', 'nanodigest-backend' ),
		'bank_account_number' => __( 'Account number', 'nanodigest-backend' ),
		'bank_ifsc'           => __( 'IFSC', 'nanodigest-backend' ),
		'bank_name'           => __( 'Bank', 'nanodigest-backend' ),
		'bank_branch'         => __( 'Branch', 'nanodigest-backend' ),
		'bank_account_type'   => __( 'Account type', 'nanodigest-backend' ),
		'bank_upi'            => __( 'UPI ID', 'nanodigest-backend' ),
	);
	?>
	<div class="wrap">
		<h1><?php esc_html_e( 'NanoDigest Settings', 'nanodigest-backend' ); ?></h1>
		<form method="post" action="options.php">
			<?php settings_fields( 'nanodigest_backend' ); ?>

			<h2><?php esc_html_e( 'Notifications', 'nanodigest-backend' ); ?></h2>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><label for="nd_notify_email"><?php esc_html_e( 'Send submissions to', 'nanodigest-backend' ); ?></label></th>
					<td>
						<input type="email" class="regular-text" id="nd_notify_email" name="nanodigest_backend_settings[notify_email]" value="<?php echo esc_attr( $settings['notify_email'] ); ?>" />
						<p class="description">
							<?php
							printf(
								/* translators: %s: site administrator email address */
								esc_html__( 'Contact messages, advertising enquiries and orders are emailed here. Leave empty to use the site administrator address (%s).', 'nanodigest-backend' ),
								esc_html( get_option( 'admin_email' ) )
							);
							?>
						</p>
					</td>
				</tr>
			</table>

			<h2><?php esc_html_e( 'Bank transfer details', 'nanodigest-backend' ); ?></h2>
			<p><?php esc_html_e( 'Shown to every customer on the checkout page. Enter only details that may be public. While the account number or IFSC is empty, the website shows the details built into it.', 'nanodigest-backend' ); ?></p>
			<table class="form-table" role="presentation">
				<?php foreach ( $fields as $key => $label ) : ?>
					<tr>
						<th scope="row"><label for="nd_<?php echo esc_attr( $key ); ?>"><?php echo esc_html( $label ); ?></label></th>
						<td><input type="text" class="regular-text" id="nd_<?php echo esc_attr( $key ); ?>" name="nanodigest_backend_settings[<?php echo esc_attr( $key ); ?>]" value="<?php echo esc_attr( $settings[ $key ] ); ?>" autocomplete="off" /></td>
					</tr>
				<?php endforeach; ?>
			</table>

			<h2><?php esc_html_e( 'Other websites allowed to send forms', 'nanodigest-backend' ); ?></h2>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><label for="nd_allowed_origins"><?php esc_html_e( 'Extra addresses', 'nanodigest-backend' ); ?></label></th>
					<td>
						<textarea class="large-text code" rows="3" id="nd_allowed_origins" name="nanodigest_backend_settings[allowed_origins]"><?php echo esc_textarea( $settings['allowed_origins'] ); ?></textarea>
						<p class="description"><?php esc_html_e( 'One per line, for example https://preview.example.com. This website is always allowed. Leave empty unless a preview copy of the site is hosted elsewhere.', 'nanodigest-backend' ); ?></p>
					</td>
				</tr>
			</table>

			<?php submit_button(); ?>
		</form>
	</div>
	<?php
}
