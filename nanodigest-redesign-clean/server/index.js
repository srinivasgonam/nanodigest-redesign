import express from 'express';
import cors from 'cors';
import fs from 'node:fs/promises';
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
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
}

function sanitizeString(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function validateEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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

export function createServer({ submissionsFile = dataFile } = {}) {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
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
      categories: req.query.category ? String(req.query.category) : undefined,
      search: typeof req.query.search === 'string' ? req.query.search.trim() : undefined,
      _embed: '1',
      _fields: 'id,date,slug,link,title,excerpt,categories,featured_media,_embedded',
    }),
  );

  app.get('/api/content/posts/:slug', (req, res) =>
    proxyWordPress(res, 'posts', {
      slug: req.params.slug,
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
      slug: req.params.slug,
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
      slug: req.params.slug,
      _fields: 'id,date,slug,link,title,excerpt,content,featured_media',
    }),
  );

  app.get('/api/summary', async (_req, res) => {
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
    const cleanEmail = sanitizeString(email);
    const cleanInterest = sanitizeString(interest) || 'General updates';

    if (!cleanEmail || !validateEmail(cleanEmail)) {
      return res.status(400).json({ message: 'A valid email address is required.' });
    }

    try {
      const data = await readData(submissionsFile);
      const record = {
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        name: cleanName || 'Anonymous subscriber',
        email: cleanEmail,
        interest: cleanInterest,
        createdAt: new Date().toISOString(),
      };

      data.newsletters.push(record);
      await writeData(data, submissionsFile);
      return res.status(201).json({ message: 'Subscription saved successfully.', record });
    } catch (error) {
      return res.status(500).json({ message: 'Unable to save subscription.' });
    }
  });

  app.post('/api/contact', async (req, res) => {
    const { name, email, company, message } = req.body || {};
    const cleanName = sanitizeString(name);
    const cleanEmail = sanitizeString(email);
    const cleanCompany = sanitizeString(company);
    const cleanMessage = sanitizeString(message);

    if (!cleanName || !cleanEmail || !cleanMessage) {
      return res.status(400).json({ message: 'Name, email, and message are required.' });
    }

    if (!validateEmail(cleanEmail)) {
      return res.status(400).json({ message: 'Please provide a valid email address.' });
    }

    try {
      const data = await readData(submissionsFile);
      const record = {
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        name: cleanName,
        email: cleanEmail,
        company: cleanCompany || 'Not provided',
        message: cleanMessage,
        createdAt: new Date().toISOString(),
      };

      data.contacts.push(record);
      await writeData(data, submissionsFile);
      return res.status(201).json({ message: 'Message sent successfully. We will reply shortly.', record });
    } catch (error) {
      return res.status(500).json({ message: 'Unable to send message.' });
    }
  });

  app.post('/api/advertise', async (req, res) => {
    const { company, contact, email, website, budget, goal, message } = req.body || {};
    const cleanCompany = sanitizeString(company);
    const cleanContact = sanitizeString(contact);
    const cleanEmail = sanitizeString(email);
    const cleanWebsite = sanitizeString(website);
    const cleanBudget = sanitizeString(budget);
    const cleanGoal = sanitizeString(goal);
    const cleanMessage = sanitizeString(message);

    if (!cleanCompany || !cleanContact || !cleanEmail || !cleanGoal || !cleanMessage) {
      return res.status(400).json({ message: 'Company, contact, email, goal, and message are required.' });
    }

    if (!validateEmail(cleanEmail)) {
      return res.status(400).json({ message: 'Please provide a valid email address.' });
    }

    try {
      const data = await readData(submissionsFile);
      const record = {
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        company: cleanCompany,
        contact: cleanContact,
        email: cleanEmail,
        website: cleanWebsite || 'Not provided',
        budget: cleanBudget || 'Not provided',
        goal: cleanGoal,
        message: cleanMessage,
        createdAt: new Date().toISOString(),
      };

      data.advertise.push(record);
      await writeData(data, submissionsFile);
      return res.status(201).json({ message: 'Partnership request saved successfully.', record });
    } catch (error) {
      return res.status(500).json({ message: 'Unable to save partnership request.' });
    }
  });

  app.post('/api/orders', async (req, res) => {
    const { name, email, phone, address, items } = req.body || {};
    const cleanName = sanitizeString(name);
    const cleanEmail = sanitizeString(email);
    const cleanPhone = sanitizeString(phone);
    const cleanAddress = sanitizeString(address);

    if (!cleanName || !cleanEmail || !cleanAddress || !Array.isArray(items) || !items.length) {
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
      const data = await readData(submissionsFile);
      const record = {
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone || 'Not provided',
        address: cleanAddress,
        items: cleanItems,
        status: 'request_received',
        paymentStatus: 'not_processed',
        createdAt: new Date().toISOString(),
      };
      data.orders.push(record);
      await writeData(data, submissionsFile);
      return res.status(201).json({
        message: 'Order request received. No payment has been taken; Nano Digest will contact you to complete it.',
        record,
      });
    } catch (error) {
      return res.status(500).json({ message: 'Unable to save your order request.' });
    }
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ message: 'API route not found.' });
  });

  app.use(express.static(clientDir));
  app.get(/.*/, (_req, res, next) => {
    res.sendFile(path.join(clientDir, 'index.html'), (error) => {
      if (error) next(error);
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
