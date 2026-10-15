import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const appSource = await readFile(path.join(here, '..', 'src', 'App.tsx'), 'utf8')

test('article REST requests embed featured media with _links so source_url is returned', () => {
  const embeddedLines = appSource
    .split('\n')
    .filter((line) => line.includes('_fields:') && line.includes('_embedded'))
  assert.ok(embeddedLines.length >= 3, 'expected at least three embedded article queries')
  for (const line of embeddedLines) {
    assert.ok(
      line.includes('_links'),
      `_fields with _embedded must also request _links (without it WordPress omits _embedded): ${line.trim()}`,
    )
  }
})

test('article images resolve to the WordPress featured media source', () => {
  assert.match(appSource, /_embedded\?\.\['wp:featuredmedia'\]\?\.\[0\]\?\.source_url/)
})

test('editor picks use the article title as alt text (no hardcoded alts)', () => {
  assert.ok(
    !appSource.includes('Intricate blue and coral material textures'),
    'hardcoded pick alt must be removed so alt matches the actual article image',
  )
  assert.ok(
    !appSource.includes('A precision laboratory microscope'),
    'hardcoded pick alt must be removed so alt matches the actual article image',
  )
})

test('latest-articles filter recomputes when live articles load', () => {
  const start = appSource.indexOf('const filtered = useMemo(')
  assert.ok(start !== -1, 'filtered useMemo not found')
  const chunk = appSource.slice(start, start + 400)
  assert.ok(
    chunk.includes('[articles, topic]'),
    'filtered must depend on articles so live content replaces the sample fallback',
  )
})
