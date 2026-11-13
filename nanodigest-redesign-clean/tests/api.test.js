import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from '../server/index.js';

async function withServer(callback, options) {
  const app = createServer(options);
  const server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');

  try {
    return await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function postJson(baseUrl, route, payload, headers = {}) {
  return fetch(`${baseUrl}/api/${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  });
}

async function withSubmissionsFile(callback) {
  const directory = await mkdtemp(path.join(tmpdir(), 'nanodigest-test-'));
  try {
    return await callback(path.join(directory, 'submissions.json'));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('health endpoint is available', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.status, 'ok');
  });
});

test('newsletter endpoint rejects invalid email addresses', async () => {
  await withServer(async (baseUrl) => {
    const response = await postJson(baseUrl, 'newsletter', { email: 'invalid' });
    assert.equal(response.status, 400);
  });
});

test('contact endpoint requires name, email, and message', async () => {
  await withServer(async (baseUrl) => {
    const response = await postJson(baseUrl, 'contact', {});
    assert.equal(response.status, 400);
  });
});

test('advertise endpoint requires campaign details', async () => {
  await withServer(async (baseUrl) => {
    const response = await postJson(baseUrl, 'advertise', {});
    assert.equal(response.status, 400);
  });
});

test('orders endpoint requires customer and cart details', async () => {
  await withServer(async (baseUrl) => {
    const response = await postJson(baseUrl, 'orders', {});
    assert.equal(response.status, 400);
  });
});

test('valid order requests are saved without processing payment', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'nanodigest-orders-'));
  const submissionsFile = path.join(directory, 'submissions.json');

  try {
    await withServer(async (baseUrl) => {
      const response = await postJson(baseUrl, 'orders', {
        name: 'Test Buyer',
        email: 'buyer@example.com',
        phone: '+1 555 0100',
        address: '123 Test Street',
        items: [{ productId: 1, name: 'Nano Digest book', quantity: 2 }],
      });
      assert.equal(response.status, 201);
      const body = await response.json();
      assert.equal(body.record, undefined, 'the reply must not repeat the customer details');
      assert.ok(body.orderNumber);

      const saved = JSON.parse(await readFile(submissionsFile, 'utf8'));
      assert.equal(saved.orders.length, 1);
      assert.equal(saved.orders[0].email, 'buyer@example.com');
      assert.equal(saved.orders[0].paymentStatus, 'not_processed');
      assert.equal(saved.orders[0].items[0].quantity, 2);
    }, { submissionsFile });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('responses carry security headers and hide the server software', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('x-frame-options'), 'SAMEORIGIN');
    assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'self'/);
    assert.equal(response.headers.get('x-powered-by'), null);
  });
});

test('submission counts are hidden without the admin token', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/summary`);
    assert.equal(response.status, 404);
  });
});

test('forms posted from another website are refused', async () => {
  await withSubmissionsFile(async (submissionsFile) => {
    await withServer(async (baseUrl) => {
      const response = await postJson(
        baseUrl,
        'newsletter',
        { email: 'reader@example.com' },
        { Origin: 'https://attacker.example' },
      );
      assert.equal(response.status, 403);
      assert.equal(response.headers.get('access-control-allow-origin'), null);
    }, { submissionsFile });
  });
});

test('spam-trap submissions look successful but are not stored', async () => {
  await withSubmissionsFile(async (submissionsFile) => {
    await withServer(async (baseUrl) => {
      const response = await postJson(baseUrl, 'contact', {
        name: 'Bot',
        email: 'bot@example.com',
        message: 'Buy now',
        website_url: 'https://spam.example',
      });
      assert.equal(response.status, 201);
      await assert.rejects(readFile(submissionsFile, 'utf8'), { code: 'ENOENT' });
    }, { submissionsFile });
  });
});

test('repeated submissions from one visitor are rate limited', async () => {
  await withSubmissionsFile(async (submissionsFile) => {
    await withServer(async (baseUrl) => {
      const send = () => postJson(baseUrl, 'newsletter', { email: 'reader@example.com' });
      assert.equal((await send()).status, 201);
      assert.equal((await send()).status, 201);
      const limited = await send();
      assert.equal(limited.status, 429);
      assert.ok(limited.headers.get('retry-after'));
    }, { submissionsFile, rateLimit: 2 });
  });
});

test('over-long input is cut to a safe length and replies do not echo it', async () => {
  await withSubmissionsFile(async (submissionsFile) => {
    await withServer(async (baseUrl) => {
      const response = await postJson(baseUrl, 'contact', {
        name: 'A'.repeat(1000),
        email: 'reader@example.com',
        message: 'B'.repeat(9000),
      });
      assert.equal(response.status, 201);
      assert.deepEqual(Object.keys(await response.json()), ['message']);

      const saved = JSON.parse(await readFile(submissionsFile, 'utf8'));
      assert.equal(saved.contacts[0].name.length, 200);
      assert.equal(saved.contacts[0].message.length, 5000);
    }, { submissionsFile });
  });
});

test('simultaneous submissions are all kept', async () => {
  await withSubmissionsFile(async (submissionsFile) => {
    await withServer(async (baseUrl) => {
      const responses = await Promise.all(
        Array.from({ length: 8 }, (_, index) =>
          postJson(baseUrl, 'newsletter', { email: `reader${index}@example.com` }),
        ),
      );
      assert.ok(responses.every((response) => response.status === 201));
      const saved = JSON.parse(await readFile(submissionsFile, 'utf8'));
      assert.equal(saved.newsletters.length, 8);
    }, { submissionsFile, rateLimit: 100 });
  });
});

test('oversized request bodies are rejected without leaking details', async () => {
  await withServer(async (baseUrl) => {
    const response = await postJson(baseUrl, 'contact', { message: 'x'.repeat(50000) });
    assert.equal(response.status, 413);
    const body = await response.json();
    assert.equal(body.stack, undefined);
  });
});
