import express from 'express';
import cors from 'cors';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, 'data');
const dataFile = path.join(dataDir, 'submissions.json');
const clientDir = path.join(__dirname, '..', 'dist');
const wordpressApi = 'https://nanodigest.in/wp-json/wp/v2';
const wordpressStoreApi = 'https://nanodigest.in/wp-json/wc/store/v1';

const defaultData = {
  newsletters: [],
  contacts: [],
  advertise: [],
  orders: [],
};

async function ensureDataFile(filePath = dataFile) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, JSON.stringify(defaultData, null, 2), 'utf8');
  }
}

async function readData(filePath = dataFile) {
  await ensureDataFile(filePath);
  const raw = await fs.readFile(filePath, 'utf8');
  const data = JSON.parse(raw || JSON.stringify(defaultData));
  return Object.fromEntries(
    Object.entries(defaultData).map(([key, fallback]) => [
      key,
      Array.isArray(data[key]) ? data[key] : fallback,
    ]),
  );
}

async function writeData(payload, filePath = dataFile) {
  await ensureDataFile(filePath);
  // Write to a temporary file first, so a crash mid-write cannot leave a
  // half-written (unreadable) submissions file behind.
  const temporary = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(payload, null, 2), { encoding: 'utf8', mode: 0o600 });
  await fs.rename(temporary, filePath);
}

// Two submissions arriving together must not overwrite each other: run every
// read-change-write of the submissions file one after another.
let writeQueue = Promise.resolve();
function saveRecord(filePath, collection, record) {
  const task = writeQueue.then(async () => {
    const data = await readData(filePath);
    data[collection].push(record);
    await writeData(data, filePath);
  });
  writeQueue = task.catch(() => {});
  return task;
}

function sanitizeString(value, max = 200) {
  if (typeof value !== 'string') return '';
  // Strip control characters (except tab/newline) and cap the length.
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max);
}

function validateEmail(value) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Websites whose pages may call this API from a browser. Set ALLOWED_ORIGINS
 * to a comma-separated list (e.g. "https://nanodigest.in"). Requests from the
 * site's own pages, and local development, are always allowed.
 */
function allowedOrigins() {
  return (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, '').toLowerCase())
    .filter(Boolean);
}

function isLocalOrigin(origin) {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(origin);
}

/** Fixed-window limit per visitor address, kept in memory. */
function createRateLimiter({ limit, windowMs }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    if (hits.size > 10000) {
      for (const [key, entry] of hits) if (entry.expires <= now) hits.delete(key);
    }
    const key = `${req.ip}|${req.path}`;
    let entry = hits.get(key);
    if (!entry || entry.expires <= now) {
      entry = { count: 0, expires: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > limit) {
      res.set('Retry-After', String(Math.ceil((entry.expires - now) / 1000)));
      return res.status(429).json({ message: 'Too many requests. Please try again in a few minutes.' });
    }
    return next();
  };
}

async function proxyWordPress(res, resource, query) {
  const url = new URL(`${wordpressApi}/${resource}`);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') url.searchParams.set(key, value);
  }

  try {
    const response = await fetch(url);
    const payload = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ message: 'Unable to fetch Nano Digest content.' });
    }

    res.set('X-Content-Total', response.headers.get('X-WP-Total') || '0');
    res.set('X-Content-Pages', response.headers.get('X-WP-TotalPages') || '0');
    return res.json(payload);
  } catch (error) {
    return res.status(502).json({ message: 'Nano Digest content is temporarily unavailable.' });
  }
}

async function proxyStoreProducts(res) {
  try {
    const response = await fetch(`${wordpressStoreApi}/products?per_page=100`)
    const payload = await response.json()
    if (!response.ok) {
      return res.status(response.status).json({ message: 'Unable to fetch shop products.' })
    }
    return res.json(payload)
  } catch (error) {
    return res.status(502).json({ message: 'Shop products are temporarily unavailable.' })
  }
}

function pageNumber(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : '1';
}

export function createServer({ submissionsFile = dataFile, rateLimit = 5 } = {}) {
  const app = express();

  app.disable('x-powered-by');
  // Behind a hosting proxy the visitor's address arrives in X-Forwarded-For.
  // Trust exactly one proxy hop, and only when the host says there is one.
  if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);

  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Content-Security-Policy': "frame-ancestors 'self'; base-uri 'self'; object-src 'none'",
    });
    if (req.secure) res.set('Strict-Transport-Security', 'max-age=31536000');
    next();
  });

  const originAllowed = (origin) =>
    isLocalOrigin(origin) || allowedOrigins().includes(origin.toLowerCase());

  app.use(
    cors({
      origin(origin, callback) {
        // No Origin header: same-site navigation or a non-browser client.
        callback(null, !origin || originAllowed(origin));
      },
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type'],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: '20kb' }));

  // Reject browser form posts coming from websites that are not on the list.
  app.post(/^\/api\//, (req, res, next) => {
    const origin = req.get('origin');
    const sameSite = origin && origin.toLowerCase() === `${req.protocol}://${req.get('host')}`.toLowerCase();
    if (origin && !sameSite && !originAllowed(origin)) {
      return res.status(403).json({ message: 'This website is not allowed to submit forms here.' });
    }
    return next();
  });
  app.post(/^\/api\//, createRateLimiter({ limit: rateLimit, windowMs: 10 * 60 * 1000 }));

  // Spam trap: the hidden "website_url" field is only ever filled in by bots.
  // Answer as if it worked and store nothing.
  app.post(/^\/api\//, (req, res, next) => {
    if (req.body && req.body.website_url) {
      return res.status(201).json({ message: 'Received.' });
    }
    return next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/content/categories', (_req, res) =>
    proxyWordPress(res, 'categories', {
      per_page: '100',
      hide_empty: 'true',
      _fields: 'id,name,slug,count,link',
    }),
  );

  app.get('/api/content/posts', (req, res) =>
    proxyWordPress(res, 'posts', {
      page: pageNumber(req.query.page),
      per_page: '24',
      categories: /^\d+$/.test(String(req.query.category || '')) ? String(req.query.category) : undefined,
      search: typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : undefined,
      _embed: '1',
      _fields: 'id,date,slug,link,title,excerpt,categories,featured_media,_embedded',
    }),
  );

  app.get('/api/content/posts/:slug', (req, res) =>
    proxyWordPress(res, 'posts', {
      slug: String(req.params.slug).slice(0, 200),
      _embed: '1',
      _fields: 'id,date,slug,link,title,excerpt,content,categories,featured_media,_embedded',
    }),
  );

  app.get('/api/content/pages', (_req, res) =>
    proxyWordPress(res, 'pages', {
      per_page: '100',
      _fields: 'id,date,slug,link,title,excerpt',
    }),
  );

  app.get('/api/content/pages/:slug', (req, res) =>
    proxyWordPress(res, 'pages', {
      slug: String(req.params.slug).slice(0, 200),
      _fields: 'id,date,slug,link,title,excerpt,content',
    }),
  );

  app.get('/api/content/products', (_req, res) =>
    proxyWordPress(res, 'product', {
      per_page: '100',
      _fields: 'id,date,slug,link,title,excerpt,content,featured_media',
    }),
  );

  app.get('/api/content/store-products', (_req, res) => proxyStoreProducts(res));

  app.get('/api/content/products/:slug', (req, res) =>
    proxyWordPress(res, 'product', {
      slug: String(req.params.slug).slice(0, 200),
      _fields: 'id,date,slug,link,title,excerpt,content,featured_media',
    }),
  );

  // Submission counts are for the site owner only. Set ADMIN_TOKEN on the
  // server and send it as "Authorization: Bearer <token>".
  app.get('/api/summary', async (req, res) => {
    const token = process.env.ADMIN_TOKEN || '';
    const given = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const matches =
      token.length >= 16 &&
      Buffer.byteLength(given) === Buffer.byteLength(token) &&
      crypto.timingSafeEqual(Buffer.from(given), Buffer.from(token));
    if (!matches) {
      return res.status(404).json({ message: 'API route not found.' });
    }
    try {
      const data = await readData(submissionsFile);
      res.json({
        newsletters: data.newsletters.length,
        contacts: data.contacts.length,
        advertise: data.advertise.length,
        orders: data.orders.length,
      });
    } catch (error) {
      res.status(500).json({ message: 'Unable to fetch summary data.' });
    }
  });

  app.post('/api/newsletter', async (req, res) => {
    const { name, email, interest } = req.body || {};
    const cleanName = sanitizeString(name);
    const cleanEmail = sanitizeString(email, 254);
    const cleanInterest = sanitizeString(interest) || 'General updates';

    if (!cleanEmail || !validateEmail(cleanEmail)) {
      return res.status(400).json({ message: 'A valid email address is required.' });
    }

    try {
      const record = {
        id: crypto.randomUUID(),
        name: cleanName || 'Anonymous subscriber',
        email: cleanEmail,
        interest: cleanInterest,
        createdAt: new Date().toISOString(),
      };

      await saveRecord(submissionsFile, 'newsletters', record);
      return res.status(201).json({ message: 'Subscription saved successfully.' });
    } catch (error) {
      return res.status(500).json({ message: 'Unable to save subscription.' });
    }
  });

  app.post('/api/contact', async (req, res) => {
    const { name, email, company, message } = req.body || {};
    const cleanName = sanitizeString(name);
    const cleanEmail = sanitizeString(email, 254);
    const cleanCompany = sanitizeString(company);
    const cleanMessage = sanitizeString(message, 5000);

    if (!cleanName || !cleanEmail || !cleanMessage) {
      return res.status(400).json({ message: 'Name, email, and message are required.' });
    }

    if (!validateEmail(cleanEmail)) {
      return res.status(400).json({ message: 'Please provide a valid email address.' });
    }

    try {
      const record = {
        id: crypto.randomUUID(),
        name: cleanName,
        email: cleanEmail,
        company: cleanCompany || 'Not provided',
        message: cleanMessage,
        createdAt: new Date().toISOString(),
      };

      await saveRecord(submissionsFile, 'contacts', record);
      return res.status(201).json({ message: 'Message sent successfully. We will reply shortly.' });
    } catch (error) {
      return res.status(500).json({ message: 'Unable to send message.' });
    }
  });

  app.post('/api/advertise', async (req, res) => {
    const { company, contact, email, website, budget, goal, message } = req.body || {};
    const cleanCompany = sanitizeString(company);
    const cleanContact = sanitizeString(contact);
    const cleanEmail = sanitizeString(email, 254);
    const cleanWebsite = sanitizeString(website);
    const cleanBudget = sanitizeString(budget);
    const cleanGoal = sanitizeString(goal);
    const cleanMessage = sanitizeString(message, 5000);

    if (!cleanCompany || !cleanContact || !cleanEmail || !cleanGoal || !cleanMessage) {
      return res.status(400).json({ message: 'Company, contact, email, goal, and message are required.' });
    }

    if (!validateEmail(cleanEmail)) {
      return res.status(400).json({ message: 'Please provide a valid email address.' });
    }

    try {
      const record = {
        id: crypto.randomUUID(),
        company: cleanCompany,
        contact: cleanContact,
        email: cleanEmail,
        website: cleanWebsite || 'Not provided',
        budget: cleanBudget || 'Not provided',
        goal: cleanGoal,
        message: cleanMessage,
        createdAt: new Date().toISOString(),
      };

      await saveRecord(submissionsFile, 'advertise', record);
      return res.status(201).json({ message: 'Partnership request saved successfully.' });
    } catch (error) {
      return res.status(500).json({ message: 'Unable to save partnership request.' });
    }
  });

  app.post('/api/orders', async (req, res) => {
    const { name, email, phone, address, items, paymentReference } = req.body || {};
    const cleanReference = sanitizeString(paymentReference).slice(0, 40);
    const cleanName = sanitizeString(name);
    const cleanEmail = sanitizeString(email, 254);
    const cleanPhone = sanitizeString(phone, 30);
    const cleanAddress = sanitizeString(address, 500);

    if (!cleanName || !cleanEmail || !cleanAddress || !Array.isArray(items) || !items.length || items.length > 10) {
      return res.status(400).json({ message: 'Name, email, delivery address, and cart items are required.' });
    }
    if (!validateEmail(cleanEmail)) {
      return res.status(400).json({ message: 'Please provide a valid email address.' });
    }

    const cleanItems = items.map((item) => ({
      productId: Number(item?.productId),
      name: sanitizeString(item?.name),
      quantity: Number(item?.quantity),
    }));
    if (cleanItems.some((item) =>
      !Number.isInteger(item.productId) ||
      !item.name ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 20
    )) {
      return res.status(400).json({ message: 'Cart items must include a valid product and quantity.' });
    }

    try {
      const record = {
        id: crypto.randomUUID(),
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone || 'Not provided',
        address: cleanAddress,
        items: cleanItems,
        status: 'request_received',
        paymentMethod: cleanReference ? 'bank_transfer' : 'not_selected',
        paymentReference: cleanReference || 'Not provided',
        paymentStatus: cleanReference ? 'awaiting_verification' : 'not_processed',
        createdAt: new Date().toISOString(),
      };
      await saveRecord(submissionsFile, 'orders', record);
      return res.status(201).json({
        message: cleanReference
          ? 'Order received. Nano Digest will confirm it once your bank transfer is verified.'
          : 'Order request received. No payment has been taken; Nano Digest will contact you to complete it.',
        orderNumber: record.id.slice(0, 8).toUpperCase(),
      });
    } catch (error) {
      return res.status(500).json({ message: 'Unable to save your order request.' });
    }
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ message: 'API route not found.' });
  });

  app.use(express.static(clientDir, { dotfiles: 'ignore' }));
  app.get(/.*/, (_req, res, next) => {
    res.sendFile(path.join(clientDir, 'index.html'), (error) => {
      if (error) next(error);
    });
  });

  // Never send stack traces or internal paths to visitors.
  app.use((error, _req, res, _next) => {
    const status = error && (error.status === 400 || error.status === 413) ? error.status : 500;
    res.status(status).json({
      message: status === 500 ? 'Something went wrong. Please try again.' : 'The request could not be read.',
    });
  });

  return app;
}

const directEntry = process.argv[1]?.replace(/\\/g, '/');
if (process.env.NODE_ENV !== 'test' && directEntry && directEntry.endsWith('/server/index.js')) {
  const app = createServer();
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`Nano Digest backend listening on http://localhost:${PORT}`);
  });
}
