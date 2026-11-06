# Nano Digest Full-Stack Website

React and Express run as one website. In development, Vite forwards `/api` requests to Express. In production, Express serves the built frontend and API from the same origin.

## Run locally

Requirements:
- Node.js 18+ (Node 22 recommended)

Install dependencies:

```bash
npm install
```

Start development server:

```bash
npm run dev
```

Open the local URL shown by Vite, normally:

```text
http://localhost:5173
```

The development server starts both the frontend and backend. Use the Vite URL for the whole website; form requests are proxied to Express automatically.

Create a production build:

```bash
npm run build
```

Run the complete production website locally:

```bash
npm start
```

Build and start in one step:

```bash
npm run preview
```

The production website is served at `http://localhost:4000`. Form submissions are stored in `server/data/submissions.json`. Deploy to a Node.js host; static-only hosting will not run the API or save form submissions.

For the GitHub Pages project site, production assets use the `/nanodigest-redesign/` base path, and the generated `404.html` restores client-side routes on direct visits or refreshes. GitHub Pages serves only static files, so API-backed form submissions still require a separate backend.

## Content and routes

The Express API reads published articles, categories, pages, and shop products from Nano Digest's public WordPress/WooCommerce APIs. Article and category lists are paginated; article, category, CMS page, product, cart, checkout, and account URLs resolve locally. Content updates require network access to `nanodigest.in`.

## Forms on the deployed site

Newsletter, contact, advertise and order-request forms need a backend. Set `VITE_FORMS_API_URL` at build time (for GitHub Pages, add it as a repository variable and pass it to the build step) to the base URL of a backend that exposes `POST /newsletter`, `/contact`, `/advertise` and `/orders` — the bundled Express API works if deployed to a Node host. When it is not set, the static site shows a clear "not connected" message rather than failing silently. Local hosts such as `http://nano-digest.local` are ignored in production builds.

## Cookie notice and ads

A cookie notice stores the visitor's choice (`nano-digest-cookie-choice`) in their browser. Google AdSense is loaded only when the visitor chooses "Accept all".

### Google AdSense ad spaces

Ad spaces appear on the homepage (top banner and a mid-page banner), category pages (banner) and articles (inside the text, plus a sidebar on wide screens).

- **Preview the spaces:** add `?ads=preview` to any page URL (use `?ads=off` to hide them). Or set `VITE_SHOW_AD_PLACEHOLDERS=true` at build time. Without either, the public site shows no empty boxes.
- **Show real ads:** set `VITE_ADSENSE_CLIENT` (your `ca-pub-…` publisher id) and the ad-unit ids `VITE_ADSENSE_SLOT_LEADERBOARD`, `VITE_ADSENSE_SLOT_IN_ARTICLE` and `VITE_ADSENSE_SLOT_SIDEBAR`. In GitHub, add them as repository variables (Settings → Secrets and variables → Actions → Variables); the deploy workflow passes them to the build.
- **AdSense requires your own domain.** Google approves a site by its domain, so real ads will only serve once this site runs on a domain you have added to AdSense (for example nanodigest.in), not on a github.io address. That domain also needs an `ads.txt` file at its root; AdSense shows you the exact line to use.

Order checkout currently records an order request in `server/data/submissions.json`; it does not collect payment or create an order in WooCommerce. Connect a payment provider and the WooCommerce order API before accepting real purchases.
