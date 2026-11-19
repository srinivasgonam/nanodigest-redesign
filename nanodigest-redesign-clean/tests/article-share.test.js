import test from 'node:test';
import assert from 'node:assert/strict';
import { buildShareLinks, formatCount } from '../src/lib/articleShare.js';

test('totals use the short form the old site showed', () => {
  assert.equal(formatCount(0), '0');
  assert.equal(formatCount(504), '504');
  assert.equal(formatCount(999), '999');
  assert.equal(formatCount(1000), '1k');
  assert.equal(formatCount(1400), '1.4k');
  assert.equal(formatCount(1499), '1.4k', 'never rounds a total up');
  assert.equal(formatCount(12500), '12.5k');
  assert.equal(formatCount(2000000), '2M');
});

test('bad totals never show NaN or negative numbers', () => {
  assert.equal(formatCount(undefined), '0');
  assert.equal(formatCount('abc'), '0');
  assert.equal(formatCount(-5), '0');
  assert.equal(formatCount(12.9), '12');
});

test('share links carry the article address and title for every network', () => {
  const url = 'https://nanodigest.in/helium-3-and-nanotechnology/';
  const title = 'Helium-3 & Nanotechnology';
  const links = buildShareLinks({ url, title });

  assert.deepEqual(
    links.map((link) => link.network),
    ['facebook', 'x', 'whatsapp', 'linkedin'],
  );
  for (const link of links) {
    assert.match(link.href, /^https:\/\//);
    assert.ok(link.href.includes(encodeURIComponent(url)), `${link.network} link carries the address`);
  }
  const x = links.find((link) => link.network === 'x');
  const xParams = new URL(x.href).searchParams;
  assert.equal(xParams.get('text'), title, 'the "&" in the title stays part of the title');
  assert.equal(xParams.get('url'), url);
  const whatsapp = links.find((link) => link.network === 'whatsapp');
  assert.ok(whatsapp.href.includes(encodeURIComponent(`${title}\n${url}`)));
});

test('only plain web addresses can be shared', () => {
  assert.deepEqual(buildShareLinks({ url: 'javascript:alert(1)', title: 'x' }), []);
  assert.deepEqual(buildShareLinks({ url: '', title: 'x' }), []);
  assert.deepEqual(buildShareLinks({ url: undefined, title: 'x' }), []);
});
