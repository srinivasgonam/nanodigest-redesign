const photo = (id, width = 900) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=85`

/**
 * @typedef {Object} HomepageArticle
 * @property {number} id
 * @property {string} slug
 * @property {string} category
 * @property {string} title
 * @property {string} description
 * @property {string} image
 * @property {string} time
 * @property {string} date
 * @property {string} sourceUrl
 */

/** @type {HomepageArticle[]} */
export const sampleArticles = [
  {
    id: 1,
    slug: 'helium-3-and-nanotechnology',
    category: 'Web Exclusive',
    title: 'Helium-3 and Nanotechnology',
    description:
      'A closer look at helium-3, clean-energy research, and the possibilities nanotechnology may offer.',
    image: photo('photo-1631556097152-c39479bbff93', 1600),
    time: '6 min read',
    date: 'June 25, 2026',
    sourceUrl: 'https://nanodigest.in/helium-3-and-nanotechnology/',
  },
  {
    id: 2,
    slug: 'ethanol-vs-gasoline-a-balanced-look',
    category: 'Web Exclusive',
    title: 'Ethanol vs Gasoline, A Balanced Look',
    description:
      'A balanced comparison of ethanol and gasoline as energy sources.',
    image: photo('photo-1629721270535-c67f2ab1243c'),
    time: '5 min read',
    date: 'June 16, 2026',
    sourceUrl: 'https://nanodigest.in/ethanol-vs-gasoline-a-balanced-look/',
  },
  {
    id: 3,
    slug: 'smallest-semiconducting-nanotubes',
    category: 'Material Science & Technology',
    title: 'Smallest Semiconducting Nanotubes',
    description:
      'A closer look at the science behind the smallest semiconducting nanotubes.',
    image: photo('photo-1614308460927-5024ba2e1dcb'),
    time: '5 min read',
    date: 'June 5, 2026',
    sourceUrl: 'https://nanodigest.in/smallest-semiconducting-nanotubes/',
  },
  {
    id: 4,
    slug: 'whisky-chemistry-could-help-power-small-machines',
    category: 'Physical Science & Technology',
    title: 'Whisky chemistry could help power small machines',
    description:
      'Researchers are exploring how chemistry found in whisky could help power small machines.',
    image: photo('photo-1606206873764-fd15e242df52'),
    time: '5 min read',
    date: 'June 4, 2026',
    sourceUrl: 'https://nanodigest.in/whisky-chemistry-could-help-power-small-machines/',
  },
  {
    id: 5,
    slug: 'moire-2d-materials-without-stacking-tiny-structures-at-the-atomic-level-that-can-give-materials-special-quantum-properties-twisting',
    category: 'Physical Science & Technology',
    title: 'Moiré 2D materials without stacking & twisting',
    description:
      'An atomic-scale approach to creating moiré materials without stacking and twisting layers.',
    image: photo('photo-1629721270535-c67f2ab1243c'),
    time: '6 min read',
    date: 'June 4, 2026',
    sourceUrl: 'https://nanodigest.in/moire-2d-materials-without-stacking-tiny-structures-at-the-atomic-level-that-can-give-materials-special-quantum-properties-twisting/',
  },
  {
    id: 6,
    slug: 'microrobots-repair-spinal-cord',
    category: 'Physical Science & Technology',
    title: 'Microrobots repair spinal cord',
    description:
      'A report on research exploring microrobots as a tool for spinal-cord repair.',
    image: photo('photo-1630959305606-3123a081dada'),
    time: '5 min read',
    date: 'June 2, 2026',
    sourceUrl: 'https://nanodigest.in/microrobots-repair-spinal-cord/',
  },
  {
    id: 7,
    slug: 'vitamin-d-analog-helps-break-down-the-protection-of-pancreatic-cancer-in-a-clinical-trial',
    category: 'Biological Sciences & Technology',
    title: 'Vitamin D analog helps break down the protection of pancreatic cancer',
    description:
      'A clinical trial investigates a vitamin D analog and the protective environment around pancreatic cancer.',
    image: photo('photo-1631556097152-c39479bbff93'),
    time: '6 min read',
    date: 'June 1, 2026',
    sourceUrl: 'https://nanodigest.in/vitamin-d-analog-helps-break-down-the-protection-of-pancreatic-cancer-in-a-clinical-trial/',
  },
  {
    id: 8,
    slug: 'nanotechnology-is-making-diabetes-care-easier',
    category: 'Biological Sciences & Technology',
    title: 'Nanotechnology is making diabetes care easier',
    description:
      'How nanotechnology research is being applied to tools and approaches for diabetes care.',
    image: photo('photo-1630959305606-3123a081dada'),
    time: '5 min read',
    date: 'May 25, 2026',
    sourceUrl: 'https://nanodigest.in/nanotechnology-is-making-diabetes-care-easier/',
  },
]

function requireSampleArticle(slug) {
  const article = sampleArticles.find((item) => item.slug === slug)
  if (!article) {
    throw new Error(`Missing curated homepage article: ${slug}`)
  }
  return article
}

/**
 * Static homepage positions. These records are intentionally not derived from
 * the WordPress feed, so API hydration cannot change the hero or Editor's Pick
 * images or identities.
 */
export const curatedHomepageStories = Object.freeze({
  hero: requireSampleArticle('helium-3-and-nanotechnology'),
  picks: Object.freeze([
    requireSampleArticle('ethanol-vs-gasoline-a-balanced-look'),
    requireSampleArticle('smallest-semiconducting-nanotubes'),
  ]),
})

export function normalizeArticleTitle(value) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/**
 * Match a WordPress post to a known local article using its stable slug first
 * and an exact normalized title second. Never falls back to array positions.
 */
export function matchSampleArticle(post, articles = sampleArticles) {
  const slug = typeof post?.slug === 'string' ? post.slug.trim() : ''
  if (slug) {
    const bySlug = articles.find((article) => article.slug === slug)
    if (bySlug) return bySlug
  }

  const title = normalizeArticleTitle(post?.title)
  if (!title) return null

  return (
    articles.find((article) => normalizeArticleTitle(article.title) === title) ??
    null
  )
}

/**
 * Preserve WordPress featured media when present. Known articles without media
 * use their own verified local image; unknown posts use the supplied neutral
 * placeholder instead of an unrelated sample image.
 *
 * @param {any} post
 * @param {{ articles?: HomepageArticle[], placeholder?: string, title?: string }} [options]
 * @returns {string}
 */
export function resolveArticleImage(
  post,
  { articles = sampleArticles, placeholder = '', title } = {},
) {
  const featuredMedia = post?._embedded?.['wp:featuredmedia']?.[0]?.source_url
  if (featuredMedia) return featuredMedia

  const matchedSample = matchSampleArticle(
    { slug: post?.slug, title: title ?? post?.title },
    articles,
  )
  return matchedSample?.image || placeholder
}
