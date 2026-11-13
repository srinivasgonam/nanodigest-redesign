<?php
/**
 * Nano Digest theme.
 *
 * Every public page is answered by index.php, which prints the page's real
 * content (for search engines, link previews and visitors without JavaScript)
 * and then starts the website app from dist/. The app reads articles, pages
 * and products from this site's own REST API.
 *
 * The WooCommerce account pages are the exception: WordPress renders those
 * itself through native.php.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'NANODIGEST_THEME_VERSION', '2.0.0' );

/** Addresses that exist only inside the app, not as WordPress content. */
function nanodigest_app_only_routes() {
	return array( 'pages' );
}

function nanodigest_setup() {
	add_theme_support( 'title-tag' );
	// Without this WordPress hides featured images in the editor and the API.
	add_theme_support( 'post-thumbnails' );
	add_theme_support( 'post-formats', array( 'video', 'gallery' ) );
	add_theme_support( 'automatic-feed-links' );
	add_theme_support( 'html5', array( 'search-form', 'gallery', 'caption', 'style', 'script' ) );
	add_theme_support( 'woocommerce' );
}
add_action( 'after_setup_theme', 'nanodigest_setup' );

/**
 * True when WordPress itself should draw the page instead of the app.
 */
function nanodigest_is_native_page() {
	if ( function_exists( 'is_account_page' ) && is_account_page() ) {
		return true;
	}
	// "Pay for order" and "Order received" links sent in WooCommerce emails.
	if ( function_exists( 'is_wc_endpoint_url' ) && ( is_wc_endpoint_url( 'order-pay' ) || is_wc_endpoint_url( 'order-received' ) ) ) {
		return true;
	}
	return false;
}

/**
 * WooCommerce and other plugins bring their own page templates. Send every
 * public page through this theme instead.
 */
function nanodigest_template( $template ) {
	if ( is_embed() ) {
		return $template;
	}
	return get_theme_file_path( nanodigest_is_native_page() ? 'native.php' : 'index.php' );
}
add_filter( 'template_include', 'nanodigest_template', 999 );

function nanodigest_request_path() {
	$request = isset( $_SERVER['REQUEST_URI'] ) ? wp_unslash( $_SERVER['REQUEST_URI'] ) : ''; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
	$path    = (string) wp_parse_url( $request, PHP_URL_PATH );
	$base    = (string) wp_parse_url( home_url( '/' ), PHP_URL_PATH );
	if ( '' !== $base && 0 === strpos( $path, $base ) ) {
		$path = substr( $path, strlen( $base ) );
	}
	return trim( $path, '/' );
}

function nanodigest_is_app_only_route() {
	return in_array( nanodigest_request_path(), nanodigest_app_only_routes(), true );
}

/**
 * App-only addresses are real pages, not "404 Not Found".
 */
function nanodigest_app_route_status( $handled ) {
	if ( nanodigest_is_app_only_route() ) {
		global $wp_query;
		$wp_query->is_404 = false;
		status_header( 200 );
		return true;
	}
	return $handled;
}
add_filter( 'pre_handle_404', 'nanodigest_app_route_status' );

// WordPress would otherwise "guess" a similarly named article and redirect.
add_filter(
	'do_redirect_guess_404_permalink',
	function ( $guess ) {
		return nanodigest_is_app_only_route() ? false : $guess;
	}
);

add_filter(
	'pre_get_document_title',
	function ( $title ) {
		return nanodigest_is_app_only_route() ? __( 'All pages', 'nanodigest' ) . ' — ' . get_bloginfo( 'name' ) : $title;
	}
);

// The app has its own cart, so WooCommerce's cart is always empty. Without
// this WooCommerce bounces visitors from /checkout/ back to /cart/.
add_filter( 'woocommerce_checkout_redirect_empty_cart', '__return_false' );

/**
 * Finds the built app files listed in dist/.vite/manifest.json.
 *
 * @return array{js:string,css:string[]}|null
 */
function nanodigest_app_files() {
	static $files = false;
	if ( false !== $files ) {
		return $files;
	}

	$files    = null;
	$manifest = get_theme_file_path( 'dist/.vite/manifest.json' );
	if ( ! is_readable( $manifest ) ) {
		return $files;
	}

	$data = json_decode( (string) file_get_contents( $manifest ), true ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
	if ( ! is_array( $data ) ) {
		return $files;
	}

	foreach ( $data as $entry ) {
		if ( ! empty( $entry['isEntry'] ) && ! empty( $entry['file'] ) ) {
			$files = array(
				'js'  => get_theme_file_uri( 'dist/' . $entry['file'] ),
				'css' => array(),
			);
			foreach ( isset( $entry['css'] ) ? (array) $entry['css'] : array() as $css ) {
				$files['css'][] = get_theme_file_uri( 'dist/' . $css );
			}
			break;
		}
	}

	return $files;
}

/**
 * Settings handed to the app. Everything here is public information.
 */
function nanodigest_app_config() {
	$active_plugins = implode( ' ', (array) get_option( 'active_plugins', array() ) );

	return array(
		'restUrl'              => untrailingslashit( rest_url() ),
		'basePath'             => untrailingslashit( (string) wp_parse_url( home_url( '/' ), PHP_URL_PATH ) ),
		'accountUrl'           => function_exists( 'wc_get_page_permalink' ) ? wc_get_page_permalink( 'myaccount' ) : wp_login_url(),
		'bank'                 => function_exists( 'nanodigest_backend_bank_details' ) ? nanodigest_backend_bank_details() : null,
		'externalCookieBanner' => false !== strpos( $active_plugins, 'cookie-law-info' ) || false !== strpos( $active_plugins, 'cookieyes' ),
	);
}

function nanodigest_head() {
	echo '<meta name="theme-color" content="#faf6f6" />' . "\n";

	if ( ! has_site_icon() ) {
		echo '<link rel="icon" href="' . esc_url( get_theme_file_uri( 'screenshot.png' ) ) . '" />' . "\n";
	}

	if ( nanodigest_is_native_page() ) {
		return;
	}

	$files = nanodigest_app_files();
	if ( ! $files ) {
		return;
	}

	echo '<link rel="preconnect" href="https://fonts.googleapis.com" />' . "\n";
	echo '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />' . "\n";

	// JSON_HEX_* keeps "</script>" or "<!--" inside a value from ending the block.
	echo '<script>window.__NANODIGEST__ = ' . wp_json_encode( nanodigest_app_config(), JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT ) . ';</script>' . "\n";

	foreach ( $files['css'] as $css ) {
		echo '<link rel="stylesheet" href="' . esc_url( $css ) . '" />' . "\n"; // phpcs:ignore WordPress.WP.EnqueuedResources.NonEnqueuedStylesheet
	}
	echo '<script type="module" crossorigin src="' . esc_url( $files['js'] ) . '"></script>' . "\n"; // phpcs:ignore WordPress.WP.EnqueuedResources.NonEnqueuedScript
}
add_action( 'wp_head', 'nanodigest_head', 5 );

/**
 * Basic description and sharing tags when no SEO plugin provides them.
 */
function nanodigest_fallback_meta() {
	if ( defined( 'WPSEO_VERSION' ) || defined( 'RANK_MATH_VERSION' ) || defined( 'AIOSEO_VERSION' ) || defined( 'SEOPRESS_VERSION' ) ) {
		return;
	}

	$title       = wp_get_document_title();
	$description = get_bloginfo( 'description' );
	$image       = '';
	$url         = home_url( '/' );

	if ( is_singular() ) {
		$post        = get_queried_object();
		$description = wp_trim_words( wp_strip_all_tags( get_the_excerpt( $post ) ), 40, '…' );
		$image       = (string) get_the_post_thumbnail_url( $post, 'large' );
		$url         = get_permalink( $post );
		echo '<link rel="canonical" href="' . esc_url( $url ) . '" />' . "\n";
	}

	echo '<meta name="description" content="' . esc_attr( $description ) . '" />' . "\n";
	echo '<meta property="og:site_name" content="' . esc_attr( get_bloginfo( 'name' ) ) . '" />' . "\n";
	echo '<meta property="og:type" content="' . ( is_singular( 'post' ) ? 'article' : 'website' ) . '" />' . "\n";
	echo '<meta property="og:title" content="' . esc_attr( $title ) . '" />' . "\n";
	echo '<meta property="og:description" content="' . esc_attr( $description ) . '" />' . "\n";
	echo '<meta property="og:url" content="' . esc_url( $url ) . '" />' . "\n";
	if ( $image ) {
		echo '<meta property="og:image" content="' . esc_url( $image ) . '" />' . "\n";
		echo '<meta name="twitter:card" content="summary_large_image" />' . "\n";
	}
}
add_action( 'wp_head', 'nanodigest_fallback_meta', 6 );

/**
 * The app draws the shop, cart and checkout itself, so WooCommerce's own
 * page scripts and styles are dead weight there (and its checkout script
 * expects a form that is not on the page).
 */
function nanodigest_trim_assets() {
	if ( nanodigest_is_native_page() ) {
		return;
	}

	$pattern = '/^(wc-|wc_|woocommerce|jquery-blockui|js-cookie|select2|selectWoo|sourcebuster|razorpay|1cc)/i';

	foreach ( array( wp_scripts(), wp_styles() ) as $registry ) {
		foreach ( (array) $registry->queue as $handle ) {
			if ( preg_match( $pattern, $handle ) ) {
				$registry->dequeue( $handle );
			}
		}
	}
}
add_action( 'wp_enqueue_scripts', 'nanodigest_trim_assets', 999 );

/**
 * Remind administrators when a required piece is missing.
 */
function nanodigest_admin_notices() {
	if ( ! current_user_can( 'activate_plugins' ) ) {
		return;
	}
	if ( ! nanodigest_app_files() ) {
		echo '<div class="notice notice-error"><p>' . esc_html__( 'Nano Digest theme: the website files (the "dist" folder) are missing. Upload the complete theme zip again.', 'nanodigest' ) . '</p></div>';
	}
	if ( ! defined( 'NANODIGEST_BACKEND_VERSION' ) ) {
		echo '<div class="notice notice-warning"><p>' . esc_html__( 'Nano Digest theme: activate the "NanoDigest Backend" plugin so the newsletter, contact, advertise and order forms work.', 'nanodigest' ) . '</p></div>';
	}
}
add_action( 'admin_notices', 'nanodigest_admin_notices' );
