<?php
/**
 * The page every public address is served through.
 *
 * The content printed inside #root is what search engines, link previews and
 * visitors without JavaScript read. The app replaces it as soon as it starts.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$nanodigest_is_store_page = ( function_exists( 'is_cart' ) && ( is_cart() || is_checkout() ) ) || ( function_exists( 'is_shop' ) && is_shop() );
?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo( 'charset' ); ?>" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<?php wp_head(); ?>
<style>
.nd-static { max-width: 760px; margin: 0 auto; padding: 32px 16px; font: 17px/1.7 system-ui, sans-serif; color: #2b2323; }
.nd-static h1 { font-size: 2rem; line-height: 1.2; }
.nd-static img { max-width: 100%; height: auto; }
.nd-static a { color: #c91212; }
.nd-static ul { padding-left: 1.2em; }
</style>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>
<div id="root">
	<div class="nd-static">
		<p><a href="<?php echo esc_url( home_url( '/' ) ); ?>"><?php bloginfo( 'name' ); ?></a></p>
		<?php if ( is_singular() && have_posts() && ! is_front_page() ) : ?>
			<?php
			while ( have_posts() ) :
				the_post();
				?>
				<article>
					<h1><?php the_title(); ?></h1>
					<?php if ( 'post' === get_post_type() ) : ?>
						<p><time datetime="<?php echo esc_attr( get_the_date( 'c' ) ); ?>"><?php echo esc_html( get_the_date() ); ?></time></p>
						<?php the_post_thumbnail( 'large' ); ?>
					<?php endif; ?>
					<?php
					// Shop pages are WooCommerce shortcodes; the app draws those.
					if ( ! $nanodigest_is_store_page && ! post_password_required() ) {
						the_content();
					}
					?>
				</article>
			<?php endwhile; ?>
		<?php elseif ( is_404() ) : ?>
			<h1><?php esc_html_e( 'This page could not be found.', 'nanodigest' ); ?></h1>
		<?php else : ?>
			<h1>
				<?php
				if ( is_category() || is_tag() || is_tax() ) {
					single_term_title();
				} else {
					bloginfo( 'description' );
				}
				?>
			</h1>
			<?php
			// The home page is drawn by the app; list recent stories for crawlers.
			$nanodigest_list = ( is_front_page() || $nanodigest_is_store_page || nanodigest_is_app_only_route() )
				? new WP_Query(
					array(
						'post_type'           => 'post',
						'posts_per_page'      => 24,
						'ignore_sticky_posts' => true,
						'no_found_rows'       => true,
					)
				)
				: $GLOBALS['wp_query'];
			?>
			<?php if ( $nanodigest_list->have_posts() ) : ?>
				<ul>
					<?php
					while ( $nanodigest_list->have_posts() ) :
						$nanodigest_list->the_post();
						?>
						<li><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></li>
					<?php endwhile; ?>
				</ul>
			<?php endif; ?>
			<?php wp_reset_postdata(); ?>
		<?php endif; ?>
		<noscript><p><?php esc_html_e( 'Turn on JavaScript to use the full Nano Digest website, including search and the shop.', 'nanodigest' ); ?></p></noscript>
	</div>
</div>
<?php wp_footer(); ?>
</body>
</html>
