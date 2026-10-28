import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  curatedHomepageStories,
  matchSampleArticle,
  resolveArticleImage,
  sampleArticles,
} from '../src/lib/homepageContent.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const appSource = await readFile(path.join(here, '..', 'src', 'App.tsx'), 'utf8')
const placeholder = '/nanodigest-placeholder.png'

const expectedStories = [
  {
    position: 'hero',
    slug: 'helium-3-and-nanotechnology',
    title: 'Helium-3 and Nanotechnology',
  },
  {
    position: 'first editor pick',
    slug: 'ethanol-vs-gasoline-a-balanced-look',
    title: 'Ethanol vs Gasoline, A Balanced Look',
  },
  {
    position: 'second editor pick',
    slug: 'smallest-semiconducting-nanotubes',
    title: 'Smallest Semiconducting Nanotubes',
  },
]

function curatedSnapshot() {
  return {
    hero: {
      slug: curatedHomepageStories.hero.slug,
      title: curatedHomepageStories.hero.title,
      image: curatedHomepageStories.hero.image,
    },
    picks: curatedHomepageStories.picks.map((article) => ({
      slug: article.slug,
      title: article.title,
      image: article.image,
    })),
  }
}

function wpPost({ id, slug, title, featuredMedia, date = '2026-06-25T00:00:00' }) {
  return {
    id,
    slug,
    date,
    link: `https://nanodigest.in/${slug}/`,
    title: { rendered: title },
    excerpt: { rendered: '' },
    categories: [],
    ...(featuredMedia
      ? { _embedded: { 'wp:featuredmedia': [{ source_url: featuredMedia }] } }
      : {}),
  }
}

function mapFeed(payload) {
  return payload.map((post) => ({
    id: post.id,
    slug: post.slug,
    title: post.title.rendered,
    image: resolveArticleImage(post, {
      placeholder,
      title: post.title.rendered,
    }),
  }))
}

const wordPressStories = [
  wpPost({
    id: 101,
    slug: 'helium-3-and-nanotechnology',
    title: 'Helium-3 and Nanotechnology',
    featuredMedia: 'https://nanodigest.in/wp-content/uploads/helium-3.jpg',
  }),
  wpPost({
    id: 102,
    slug: 'ethanol-vs-gasoline-a-balanced-look',
    title: 'Ethanol vs Gasoline, A Balanced Look',
    featuredMedia: 'https://nanodigest.in/wp-content/uploads/ethanol.jpg',
  }),
  wpPost({
    id: 103,
    slug: 'smallest-semiconducting-nanotubes',
    title: 'Smallest Semiconducting Nanotubes',
    featuredMedia: 'https://nanodigest.in/wp-content/uploads/nanotubes.jpg',
  }),
]

test('homepage starts with the three intended curated stories and local images', () => {
  const curated = [
    curatedHomepageStories.hero,
    ...curatedHomepageStories.picks,
  ]

  assert.equal(curated.length, expectedStories.length)
  expectedStories.forEach((expected, index) => {
    const article = curated[index]
    const localRecord = sampleArticles.find((item) => item.slug === expected.slug)
    assert.ok(localRecord, `missing local record for ${expected.slug}`)
    assert.equal(article.slug, expected.slug, `${expected.position} slug`)
    assert.equal(article.title, expected.title, `${expected.position} title`)
    assert.equal(article.image, localRecord.image, `${expected.position} image`)
  })
})

test('reordered WordPress stories, re-renders, and state updates do not change curated positions', () => {
  const initial = curatedSnapshot()
  let feed = mapFeed(wordPressStories)

  assert.equal(feed.length, 3)
  assert.equal(
    feed.find((article) => article.slug === 'helium-3-and-nanotechnology').image,
    'https://nanodigest.in/wp-content/uploads/helium-3.jpg',
    'dynamic feed should keep WordPress featured media',
  )
  assert.notEqual(
    curatedHomepageStories.hero.image,
    'https://nanodigest.in/wp-content/uploads/helium-3.jpg',
    'curated hero must keep its local image, not the WordPress image',
  )
  assert.deepEqual(curatedSnapshot(), initial)

  feed = mapFeed([...wordPressStories].reverse())
  assert.deepEqual(curatedSnapshot(), initial)

  feed = [...feed]
  feed = feed.map((article) => ({ ...article }))
  assert.deepEqual(curatedSnapshot(), initial)
})

test('a later WordPress response without featured media keeps article-specific local fallbacks', () => {
  const initial = curatedSnapshot()
  const feed = mapFeed([
    wpPost({
      id: 201,
      slug: 'helium-3-and-nanotechnology',
      title: 'Helium-3 and Nanotechnology',
    }),
    wpPost({
      id: 202,
      slug: 'ethanol-vs-gasoline-a-balanced-look',
      title: 'Ethanol vs Gasoline, A Balanced Look',
    }),
    wpPost({
      id: 203,
      slug: 'smallest-semiconducting-nanotubes',
      title: 'Smallest Semiconducting Nanotubes',
    }),
    wpPost({
      id: 204,
      slug: 'a-new-unrelated-story',
      title: 'A New Unrelated Story',
    }),
  ])

  assert.equal(
    feed[0].image,
    sampleArticles.find((article) => article.slug === 'helium-3-and-nanotechnology').image,
  )
  assert.equal(
    feed[1].image,
    sampleArticles.find((article) => article.slug === 'ethanol-vs-gasoline-a-balanced-look').image,
  )
  assert.equal(
    feed[2].image,
    sampleArticles.find((article) => article.slug === 'smallest-semiconducting-nanotubes').image,
  )
  assert.equal(feed[3].image, placeholder, 'unknown posts must not borrow sample images')
  assert.deepEqual(curatedSnapshot(), initial)
})

test('additional WordPress articles update only the feed, not the curated positions', () => {
  const initial = curatedSnapshot()
  const feed = mapFeed([
    ...wordPressStories,
    wpPost({
      id: 301,
      slug: 'another-new-story',
      title: 'Another New Story',
      featuredMedia: 'https://nanodigest.in/wp-content/uploads/another.jpg',
    }),
  ])

  assert.equal(feed.length, 4)
  assert.equal(feed[3].image, 'https://nanodigest.in/wp-content/uploads/another.jpg')
  assert.deepEqual(curatedSnapshot(), initial)
})

test('known articles match by stable slug or exact title, never by ID modulo', () => {
  assert.equal(
    matchSampleArticle({
      slug: 'smallest-semiconducting-nanotubes',
      title: 'Different display title',
    }).title,
    'Smallest Semiconducting Nanotubes',
  )
  assert.equal(
    matchSampleArticle({
      slug: 'unknown-slug',
      title: 'Ethanol vs Gasoline, A Balanced Look',
    }).slug,
    'ethanol-vs-gasoline-a-balanced-look',
  )
  assert.equal(
    matchSampleArticle({ slug: 'unknown-slug', title: 'An unknown story' }),
    null,
  )
})

test('featured homepage JSX is bound to the static curated configuration', () => {
  const featuredStart = appSource.indexOf('<section className="featured-grid"')
  const leaderboardStart = appSource.indexOf(
    '<AdSlot placement="home-leaderboard"',
    featuredStart,
  )
  assert.ok(featuredStart !== -1 && leaderboardStart > featuredStart)
  const featuredBlock = appSource.slice(featuredStart, leaderboardStart)

  assert.match(featuredBlock, /curatedHomepageStories\.hero\.image/)
  assert.match(featuredBlock, /curatedHomepageStories\.hero\.title/)
  assert.match(featuredBlock, /curatedHomepageStories\.picks\.map/)
  assert.ok(!featuredBlock.includes('articles[0]'))
  assert.ok(!featuredBlock.includes('articles.slice(1, 3)'))
})

test('WordPress mapping uses verified images and the dynamic feed still updates', () => {
  assert.match(appSource, /resolveArticleImage\(post,/)
  assert.ok(!appSource.includes('post.id % sampleArticles.length'))
  assert.ok(!appSource.includes('sampleArticles[post.id'))
  assert.match(appSource, /setArticles\(/)
  assert.match(appSource, /payload\.map\(\(post\) => mapWordPressPost\(post, contentCategories\)\)/)
})
