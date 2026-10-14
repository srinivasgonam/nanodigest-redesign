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

## Content and routes

The Express API reads published articles, categories, pages, and shop products from Nano Digest's public WordPress/WooCommerce APIs. Article and category lists are paginated; article, category, CMS page, product, cart, checkout, and account URLs resolve locally. Content updates require network access to `nanodigest.in`.

Order checkout currently records an order request in `server/data/submissions.json`; it does not collect payment or create an order in WooCommerce. Connect a payment provider and the WooCommerce order API before accepting real purchases.
