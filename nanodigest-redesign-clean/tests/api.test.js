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

async function postJson(baseUrl, route, payload) {
  return fetch(`${baseUrl}/api/${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
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
      assert.equal(body.record.paymentStatus, 'not_processed');
      assert.equal(body.record.items[0].quantity, 2);

      const saved = JSON.parse(await readFile(submissionsFile, 'utf8'));
      assert.equal(saved.orders.length, 1);
      assert.equal(saved.orders[0].email, 'buyer@example.com');
    }, { submissionsFile });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
