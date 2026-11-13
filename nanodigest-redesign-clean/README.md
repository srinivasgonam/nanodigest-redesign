# Nano Digest website

The redesigned Nano Digest website: a React app that reads its articles, pages and shop products from WordPress.

There are three ways to run it:

| Where | Command | What it is |
| --- | --- | --- |
| **nanodigest.in (live)** | `npm run build:wp` | A WordPress theme and plugin, uploaded in wp-admin. The existing WordPress stays as the admin area. |
| GitHub Pages preview | `npm run build` | Static copy under `/nanodigest-redesign/`. Forms are not connected. |
| Your computer | `npm run dev` | Vite + the bundled Express API on `http://localhost:5173`. |

## Publishing on nanodigest.in

nanodigest.in is a WordPress site. The redesign goes live as a **theme**, so nothing moves: the same wp-admin, the same articles, images, addresses, WooCommerce products and SEO plugin. Switching back is one click (re-activate the old theme).

### What the administrator can do afterwards

Everything is done at `nanodigest.in/wp-admin`, as before:

| Task | Where in wp-admin |
| --- | --- |
| Write, edit, schedule and delete articles; set the featured image and category | Posts |
| Add a Nano TV video | Posts → new post in the "Nano TV" category, format "Video" |
| Edit About, Advertise (rate card), Contact, Privacy Policy, Terms | Pages |
| Change the book, its price or stock | Products |
| See shop orders and mark them paid / shipped | WooCommerce → Orders |
| Read contact messages and advertising enquiries | NanoDigest → Contacts / Advertise |
| See and download newsletter subscribers (CSV) | NanoDigest → Newsletter / Dashboard |
| Change the bank details on the checkout page, and who gets notification emails | NanoDigest → Settings |
| Customer accounts | Users, and `nanodigest.in/my-account/` for customers |

Each contact message, advertising enquiry and order is also emailed to the address set in NanoDigest → Settings.

### Steps

1. **Build the two zip files**

   ```bash
   npm install
   npm test
   npm run build:wp
   ```

   This creates `release/nanodigest-theme.zip` and `release/nanodigest-backend.zip`.

2. **Take a backup first.** In Hostinger hPanel: Files → Backups → generate a new backup (files and database). Do not skip this.

3. **Try it on a staging copy** if your Hostinger plan has one (hPanel → WordPress → Staging). Do steps 4–7 there first.

4. **Install the plugin.** wp-admin → Plugins → Add New → Upload Plugin → `nanodigest-backend.zip` → Activate.

5. **Fill in the settings.** wp-admin → NanoDigest → Settings: the email address that should receive submissions, and the bank details for the checkout page.

6. **Install the theme.** wp-admin → Appearance → Themes → Add New → Upload Theme → `nanodigest-theme.zip`. Use **Live Preview** to look at it, then **Activate**.

7. **Clear caches.** Hostinger: hPanel → Cache Manager → Purge all. Also purge any caching plugin.

8. **Check the live site** with the list below.

To update the site later, run `npm run build:wp` again and upload the new theme zip (WordPress asks to replace the existing one).

### Checks after going live

- [ ] Home page, a category page, an article and a Nano TV article open; refresh works on each.
- [ ] Search finds articles.
- [ ] Newsletter, contact and advertise forms show a success message, the entry appears under NanoDigest in wp-admin, and the notification email arrives.
- [ ] Shop → add to cart → checkout shows the right bank details. Place a test order: it appears in WooCommerce → Orders as "On hold" with the UTR, and the emails arrive. Cancel the test order afterwards.
- [ ] `nanodigest.in/my-account/` shows the sign-in page.
- [ ] `nanodigest.in/sitemap_index.xml` still works, and a shared article link shows its title and image (test with a WhatsApp message to yourself).
- [ ] Only one cookie banner appears.
- [ ] If emails do not arrive, install an SMTP plugin (for example WP Mail SMTP) with the Hostinger mailbox; shared hosts often block unauthenticated mail.

### What changes compared with the old theme

- The pop-up login / register box and "Sign in with Google" belonged to the old theme and are gone. Customers sign in at `/my-account/`.
- Forms on the Contact and Advertise pages are the new built-in ones. Any old Contact Form 7 shortcode in those pages should be removed from the page text.
- Checkout is by bank transfer with a manually verified reference (UTR). The Razorpay checkout from the old site is not used by the new checkout page.
- Old home page layouts built for the previous theme (pages "Home 1" … "Home 5", "Sample Page") are unused and can be deleted.

## Security

What is built in:

- **Article content is cleaned in the browser** (DOMPurify) before display: scripts and event handlers are removed, and embedded players are allowed only from YouTube and Vimeo.
- **Forms**: server-side validation and length limits, a hidden spam-trap field, 5 submissions per 10 minutes per visitor and form, and only this website (plus any address listed in NanoDigest → Settings) may post them from a browser. Replies never repeat the visitor's details.
- **Orders**: products and prices are read from WooCommerce on the server; the browser only sends a product id and quantity. No card or banking credentials are collected.
- **Submissions** are private records that only administrators can open; they are not available through the REST API.
- **Site hardening** (plugin): security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`, a clickjacking-blocking CSP), XML-RPC off, the theme/plugin code editor in wp-admin off, account-name listing blocked, WordPress version hidden, one message for wrong username and wrong password.
- **Bank details on the checkout page are public** by nature. Only enter details that may be shown to everyone.

What the site owner must do (code cannot do these):

- [ ] Use a long unique password and two-factor login for every administrator (Wordfence Login Security is already installed), and remove administrator accounts nobody uses.
- [ ] Keep WordPress, WooCommerce and every plugin updated; delete plugins and themes that are not in use, including the old theme once the new one has been live for a while.
- [ ] Remove the **File Manager Advanced** plugin unless it is really needed. File-manager plugins let anyone who gets into wp-admin change any file on the server and are a common way sites get taken over.
- [ ] Keep automatic backups on in Hostinger and download one occasionally.
- [ ] Make sure the site redirects to HTTPS (hPanel → SSL → Force HTTPS).
- [ ] Update the Privacy Policy page: it is dated 2022 and lists a different address and email from the Contact page. Mention the newsletter, the order form and the cookie choices.

## Run locally

Requirements: Node.js 20+ (Node 22 recommended).

```bash
npm install
npm run dev
```

Open the URL Vite prints, normally `http://localhost:5173`. The development server starts both the frontend and the Express API; form requests are proxied to Express automatically and saved in `server/data/submissions.json`.

Other commands:

```bash
npm test            # API and content tests
npm run typecheck   # TypeScript
npm run build       # GitHub Pages preview build (dist/)
npm run preview     # root-path build served by Express on http://localhost:4000
```

### The Express server (optional alternative to WordPress forms)

`server/index.js` can serve the site and store form submissions on a Node.js host. Environment variables:

| Variable | Purpose |
| --- | --- |
| `PORT` | Port to listen on (default 4000). |
| `ALLOWED_ORIGINS` | Comma-separated websites allowed to post forms from a browser, e.g. `https://nanodigest.in`. |
| `TRUST_PROXY` | Set to `1` when the host puts a proxy in front of the app, so rate limiting sees the visitor's real address. |
| `ADMIN_TOKEN` | At least 16 characters. Required to read `/api/summary` (`Authorization: Bearer <token>`). |

It has no admin screen and does not email anyone, which is why the live site uses the WordPress plugin instead.

## Content and routes

Articles, categories, pages and shop products come from WordPress's REST API (`/wp-json/wp/v2` and `/wp-json/wc/store/v1`). Article and category lists are paginated; article, category, page, product, cart and checkout addresses are the same as on the old site, so existing links and search results keep working.

On WordPress the theme (`wordpress/nanodigest/`) prints each page's real title and text into the HTML before the app starts, so search engines and link previews see the content, and the SEO plugin keeps writing the page titles, descriptions and sitemaps.

## Forms on the preview site

The GitHub Pages preview has no backend. Set `VITE_FORMS_API_URL` at build time to the base URL of a backend exposing `POST /newsletter`, `/contact`, `/advertise` and `/orders`, and add the preview's address under NanoDigest → Settings → "Other websites allowed to send forms". When it is not set, the preview shows a clear "not connected" message rather than failing silently.

## Cookie notice and ads

A cookie notice stores the visitor's choice (`nano-digest-cookie-choice`) in their browser. On WordPress, if the CookieYes plugin is active its banner is used instead and the built-in notice is hidden. Google AdSense is loaded only after the visitor accepts advertising cookies.

### Google AdSense ad spaces

Ad spaces appear on the homepage (top banner and a mid-page banner), category pages (banner) and articles (inside the text, plus a sidebar on wide screens).

- **Preview the spaces:** add `?ads=preview` to any page URL (use `?ads=off` to hide them). Or set `VITE_SHOW_AD_PLACEHOLDERS=true` at build time. Without either, the public site shows no empty boxes.
- **Show real ads:** before running `npm run build:wp`, put `VITE_ADSENSE_CLIENT` (your `ca-pub-…` publisher id) and the ad-unit ids `VITE_ADSENSE_SLOT_LEADERBOARD`, `VITE_ADSENSE_SLOT_IN_ARTICLE` and `VITE_ADSENSE_SLOT_SIDEBAR` in a `.env` file (see `.env.example`).
- **AdSense requires your own domain** and an `ads.txt` file at its root; AdSense shows you the exact line to use.
