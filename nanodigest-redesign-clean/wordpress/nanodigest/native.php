<?php
/**
 * Pages WordPress draws itself: the WooCommerce account area (sign in,
 * register, order history) and the order links sent in WooCommerce emails.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo( 'charset' ); ?>" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<?php wp_head(); ?>
<style>
body { margin: 0; background: #faf6f6; color: #2b2323; font: 16px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif; }
.nd-bar { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 20px; background: #fff; border-bottom: 1px solid #eadada; }
.nd-bar img { display: block; height: 52px; width: auto; }
.nd-bar a { color: #c91212; font-weight: 600; text-decoration: none; }
.nd-main { max-width: 960px; margin: 32px auto; padding: 28px 24px; background: #fff; border: 1px solid #eadada; border-radius: 16px; }
.nd-main h1 { margin-top: 0; font-size: 1.8rem; }
.nd-main a { color: #c91212; }
.nd-main input[type="text"], .nd-main input[type="email"], .nd-main input[type="password"], .nd-main input[type="tel"], .nd-main textarea, .nd-main select { max-width: 100%; padding: 10px 12px; border: 1px solid #d9c9c9; border-radius: 8px; font: inherit; }
.nd-main button, .nd-main .button { padding: 10px 18px; border: 0; border-radius: 999px; background: #c91212; color: #fff; font: inherit; font-weight: 600; cursor: pointer; }
.nd-foot { padding: 0 20px 32px; text-align: center; font-size: 13px; color: #6b6262; }
@media (max-width: 600px) { .nd-main { margin: 16px 12px; padding: 20px 16px; } }
</style>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>
<header class="nd-bar">
	<a href="<?php echo esc_url( home_url( '/' ) ); ?>" aria-label="<?php echo esc_attr( get_bloginfo( 'name' ) ); ?>">
		<img src="<?php echo esc_url( get_theme_file_uri( 'screenshot.png' ) ); ?>" alt="<?php echo esc_attr( get_bloginfo( 'name' ) ); ?>" />
	</a>
	<a href="<?php echo esc_url( home_url( '/' ) ); ?>">&larr; <?php esc_html_e( 'Back to Nano Digest', 'nanodigest' ); ?></a>
</header>
<main class="nd-main">
	<?php
	while ( have_posts() ) :
		the_post();
		?>
		<h1><?php the_title(); ?></h1>
		<?php the_content(); ?>
	<?php endwhile; ?>
</main>
<footer class="nd-foot">&copy; <?php echo esc_html( gmdate( 'Y' ) ); ?> <?php bloginfo( 'name' ); ?></footer>
<?php wp_footer(); ?>
</body>
</html>
