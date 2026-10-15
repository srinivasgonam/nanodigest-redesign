import { useEffect, useMemo, useRef, useState } from 'react'
import DOMPurify from 'dompurify'
import nanoDigestLogo from '../assets/images/nanodigest-logo.png'
import { contentUrl, formUrl } from './lib/api'
import { AdSlot, adsPreviewEnabled } from './components/AdSlot'
import { Typewriter } from './components/Typewriter'

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '')

function internalPathFromLocation(pathname: string) {
  if (!basePath) return pathname || '/'
  if (pathname === basePath) return '/'
  return pathname.startsWith(`${basePath}/`) ? pathname.slice(basePath.length) : pathname
}

function pathWithBase(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${basePath}${normalizedPath}` || '/'
}

type Article = {
  id: number
  slug?: string
  category: string
  title: string
  description: string
  image: string
  time: string
  date: string
  sourceUrl: string
}

type WordPressCategory = {
  id: number
  name: string
  slug: string
  count: number
}

type WordPressPost = {
  id: number
  date: string
  slug: string
  link: string
  title: { rendered: string }
  excerpt: { rendered: string }
  categories: number[]
  _embedded?: {
    'wp:featuredmedia'?: Array<{ source_url: string }>
  }
  content?: { rendered: string }
}

type WordPressPage = {
  id: number
  date: string
  slug: string
  link: string
  title: { rendered: string }
  excerpt: { rendered: string }
  content?: { rendered: string }
}

type WordPressProduct = WordPressPage

type StoreProduct = {
  id: number
  name: string
  slug: string
  permalink: string
  short_description: string
  description: string
  images: Array<{ src: string; alt: string }>
  prices: {
    price: string
    currency_code: string
    currency_symbol: string
    currency_minor_unit: number
  }
}

const pagePaths: Record<Exclude<PageKey, 'home'>, string> = {
  about: '/about/',
  advertise: '/advertise/',
  contact: '/contact/',
  privacy: '/privacy-policy/',
  terms: '/terms-conditions/',
}

function pageKeyFromPath(path: string): PageKey | null {
  const normalized = path.replace(/^\/+|\/+$/g, '')
  const match = Object.entries(pagePaths).find(([, route]) =>
    route.replace(/^\/+|\/+$/g, '') === normalized,
  )
  return (match?.[0] as Exclude<PageKey, 'home'> | undefined) ?? (normalized ? null : 'home')
}

type PageKey = 'home' | 'about' | 'advertise' | 'contact' | 'privacy' | 'terms'

type FormStatus = {
  type: 'success' | 'error'
  message: string
} | null

const photo = (id: string, width = 900) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=85`

const sampleArticles: Article[] = [
  {
    id: 1,
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

const topics = [
  'All stories',
  'Web Exclusive',
  'Material Science & Technology',
  'Physical Science & Technology',
  'Biological Sciences & Technology',
]

function textFromHtml(markup: string) {
  const element = document.createElement('div')
  element.innerHTML = markup
  return element.textContent?.replace(/\s+/g, ' ').trim() || ''
}

/**
 * Splits sanitized article HTML at a natural boundary so a reserved ad slot can
 * sit between two article sections. Prefers the first sub-heading past a third
 * of the content, and falls back to a paragraph break near the midpoint.
 * Returns a second (empty) string when no safe split point exists.
 */
function splitContentForAd(html: string): [string, string] {
  if (!html) return [html, '']
  const lower = html.toLowerCase()
  const threshold = html.length * 0.35
  const headingPattern = /<h2[\s>]/g
  let splitAt = -1
  let match: RegExpExecArray | null
  while ((match = headingPattern.exec(lower))) {
    if (match.index >= threshold) {
      splitAt = match.index
      break
    }
  }
  if (splitAt === -1) {
    const paragraphEnd = lower.lastIndexOf('</p>', Math.floor(html.length / 2))
    if (paragraphEnd !== -1) splitAt = paragraphEnd + 4
  }
  if (splitAt <= 0 || splitAt >= html.length) return [html, '']
  return [html.slice(0, splitAt), html.slice(splitAt)]
}


function mapWordPressPost(
  post: WordPressPost,
  categories: WordPressCategory[],
): Article {
  const categoryNames = post.categories
    .map((id) => categories.find((category) => category.id === id)?.name)
    .filter((name): name is string => Boolean(name))

  return {
    id: post.id,
    slug: post.slug,
    category: categoryNames.map(textFromHtml).join(', ') || 'Nano Digest',
    title: textFromHtml(post.title.rendered),
    description: textFromHtml(post.excerpt.rendered),
    image:
      post._embedded?.['wp:featuredmedia']?.[0]?.source_url ||
      sampleArticles[post.id % sampleArticles.length].image,
    time: 'Open story',
    date: new Intl.DateTimeFormat('en', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(post.date)),
    sourceUrl: post.link,
  }
}

const pageLabels: Record<PageKey, string> = {
  home: 'Home',
  about: 'About',
  advertise: 'Advertise',
  contact: 'Contact',
  privacy: 'Privacy Policy',
  terms: 'Terms & Conditions',
}

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === 'arrow' ? (
        <>
          <path d="M5 12h14M13 6l6 6-6 6" />
        </>
      ) : name === 'diagonal' ? (
        <>
          <path d="M6 18 18 6M6 6h12v12" />
        </>
      ) : name === 'search' ? (
        <>
          <circle cx="10.8" cy="10.8" r="6.5" />
          <path d="m16 16 4 4" />
        </>
      ) : name === 'close' ? (
        <path d="m6 6 12 12M6 18 18 6" />
      ) : name === 'menu' ? (
        <path d="M4 7h16M4 12h16M4 17h16" />
      ) : name === 'mail' ? (
        <>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 6 9 7 9-7" />
        </>
      ) : name === 'cart' ? (
        <>
          <circle cx="9" cy="20" r="1" />
          <circle cx="18" cy="20" r="1" />
          <path d="M3 4h2l2.2 11.1a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 1.9-1.4L22 8H6" />
        </>
      ) : name === 'youtube' ? (
        <path
          fill="currentColor"
          stroke="none"
          d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.2 3.6-6.2 3.6Z"
        />
      ) : name === 'whatsapp' ? (
        <path
          fill="currentColor"
          stroke="none"
          d="M12.04 2A9.9 9.9 0 0 0 2.13 11.9c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01a9.91 9.91 0 0 0 9.91-9.91 9.82 9.82 0 0 0-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 1.67a8.2 8.2 0 0 1 5.83 2.42 8.2 8.2 0 0 1 2.41 5.82c0 4.54-3.7 8.24-8.25 8.24a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24Zm-2.98 4.43c-.14 0-.37.05-.56.26-.19.21-.74.72-.74 1.75s.76 2.03.86 2.17c.11.14 1.5 2.29 3.63 3.21.51.22.9.35 1.21.45.51.16.97.14 1.34.08.41-.06 1.24-.51 1.42-1 .18-.49.18-.91.13-.99-.05-.09-.19-.14-.4-.24-.21-.11-1.24-.61-1.43-.68-.19-.07-.33-.11-.47.11-.14.21-.54.68-.66.82-.12.14-.24.16-.45.05-.21-.11-.88-.32-1.68-1.03-.62-.55-1.04-1.23-1.16-1.44-.12-.21-.01-.32.09-.43.09-.09.21-.24.32-.36.11-.12.14-.21.21-.35.07-.14.04-.26-.02-.37-.05-.11-.47-1.14-.65-1.56-.17-.41-.34-.36-.47-.36l-.4-.01Z"
        />
      ) : (
        <>
          <circle cx="12" cy="12" r="3" />
          <ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(60 12 12)" />
          <ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(-60 12 12)" />
          <ellipse cx="12" cy="12" rx="10" ry="4.5" />
        </>
      )}
    </svg>
  )
}

export default function App() {
  const [articles, setArticles] = useState<Article[]>(sampleArticles)
  const [storeProducts, setStoreProducts] = useState<StoreProduct[]>([])
  const [cartQuantity, setCartQuantity] = useState(() => {
    const stored = Number(window.localStorage.getItem('nano-digest-cart-quantity'))
    return Number.isInteger(stored) && stored > 0 ? stored : 0
  })
  const [contentCategories, setContentCategories] = useState<WordPressCategory[]>([])
  const [contentCategoriesLoaded, setContentCategoriesLoaded] = useState(false)
  const [cmsPages, setCmsPages] = useState<WordPressPage[]>([])
  const [cmsPagesLoaded, setCmsPagesLoaded] = useState(false)
  const [cmsProducts, setCmsProducts] = useState<WordPressProduct[]>([])
  const [storeProductsLoaded, setStoreProductsLoaded] = useState(false)
  const [routePath, setRoutePath] = useState(() =>
    internalPathFromLocation(window.location.pathname),
  )
  const [cmsPost, setCmsPost] = useState<WordPressPost | null>(null)
  const [cmsPage, setCmsPage] = useState<WordPressPage | null>(null)
  const [cmsProduct, setCmsProduct] = useState<WordPressProduct | null>(null)
  const [contentLoading, setContentLoading] = useState(false)
  const [contentError, setContentError] = useState('')
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [totalStories, setTotalStories] = useState(sampleArticles.length)
  const [loadingStories, setLoadingStories] = useState(false)
  const [catalogError, setCatalogError] = useState('')
  const [searchResults, setSearchResults] = useState<Article[]>(sampleArticles)
  const [searchLoading, setSearchLoading] = useState(false)
  const [page, setPage] = useState<PageKey>(
    pageKeyFromPath(internalPathFromLocation(window.location.pathname)) ?? 'home',
  )
  const [topic, setTopic] = useState('All stories')
  const [activeArticle, setActiveArticle] = useState<Article | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [newsletterForm, setNewsletterForm] = useState({
    name: '',
    email: '',
    interest: 'All stories',
  })
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    company: '',
    message: '',
  })
  const [advertiseForm, setAdvertiseForm] = useState({
    company: '',
    contact: '',
    email: '',
    website: '',
    budget: '',
    goal: '',
    message: '',
  })
  const [status, setStatus] = useState<FormStatus>(null)
  const [orderStatus, setOrderStatus] = useState<FormStatus>(null)
  const [checkoutForm, setCheckoutForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
  })
  const searchRef = useRef<HTMLInputElement>(null)

  const modalOpen = searchOpen || !!activeArticle
  const topicOptions = contentCategories.length
    ? ['All stories', ...contentCategories.map((category) => textFromHtml(category.name))]
    : topics
  const storeProduct = storeProducts[0]
  const productPrice = storeProduct
    ? Number(storeProduct.prices.price) / 10 ** storeProduct.prices.currency_minor_unit
    : 0
  const formattedProductPrice = storeProduct
    ? new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: storeProduct.prices.currency_code,
      }).format(productPrice)
    : ''

  useEffect(() => {
    window.localStorage.setItem('nano-digest-cart-quantity', String(cartQuantity))
  }, [cartQuantity])

  useEffect(() => {
    const controller = new AbortController()
    fetch(contentUrl('/wc/store/v1/products', { per_page: 100 }), { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load the Nano Digest shop.')
        return response.json()
      })
      .then((payload: StoreProduct[]) => setStoreProducts(payload))
      .catch((error: unknown) => {
        if (error instanceof Error && error.name !== 'AbortError') {
          setContentError(error.message)
        }
      })
      .finally(() => setStoreProductsLoaded(true))

    return () => controller.abort()
  }, [])

  const navigateToPath = (path: string) => {
    const internalPath = internalPathFromLocation(path)
    const nextPath = pathWithBase(internalPath)
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath)
    }
    setRoutePath(internalPath)
    setMenuOpen(false)
    setSearchOpen(false)
    setActiveArticle(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const openStory = (article: Article) => {
    if (article.slug) {
      navigateToPath(`/${article.slug}/`)
    } else {
      setActiveArticle(article)
    }
  }

  useEffect(() => {
    const onPopState = () => {
      const nextPath = internalPathFromLocation(window.location.pathname)
      setRoutePath(nextPath)
      setPage(pageKeyFromPath(nextPath) ?? 'home')
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetch(
      contentUrl('/wp/v2/categories', {
        per_page: 100,
        hide_empty: 'true',
        _fields: 'id,name,slug,count,link',
      }),
      { signal: controller.signal },
    )
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load story categories.')
        return response.json()
      })
      .then((payload: WordPressCategory[]) => setContentCategories(payload))
      .catch((error: unknown) => {
        if (error instanceof Error && error.name !== 'AbortError') {
          setCatalogError(error.message)
        }
      })
      .finally(() => setContentCategoriesLoaded(true))

    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetch(
      contentUrl('/wp/v2/product', {
        per_page: 100,
        _fields: 'id,date,slug,link,title,excerpt,content,featured_media',
      }),
      { signal: controller.signal },
    )
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load Nano Digest products.')
        return response.json()
      })
      .then((payload: WordPressProduct[]) => setCmsProducts(payload))
      .catch((error: unknown) => {
        if (error instanceof Error && error.name !== 'AbortError') {
          setContentError(error.message)
        }
      })

    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetch(
      contentUrl('/wp/v2/pages', {
        per_page: 100,
        _fields: 'id,date,slug,link,title,excerpt',
      }),
      { signal: controller.signal },
    )
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load Nano Digest pages.')
        return response.json()
      })
      .then((payload: WordPressPage[]) => setCmsPages(payload))
      .catch((error: unknown) => {
        if (error instanceof Error && error.name !== 'AbortError') {
          setContentError(error.message)
        }
      })
      .finally(() => setCmsPagesLoaded(true))

    return () => controller.abort()
  }, [])

  useEffect(() => {
    const normalizedPath = routePath.replace(/^\/+|\/+$/g, '')
    const categoryMatch = normalizedPath.match(/^category\/([^/]+)$/)
    const pageKey = pageKeyFromPath(routePath)

    setCmsPost(null)
    setCmsPage(null)
    setCmsProduct(null)
    setContentError('')

    if (!normalizedPath) {
      setPage('home')
      setTopic('All stories')
      setActiveCategoryId(null)
      setCurrentPage(1)
      return
    }

    if (normalizedPath === 'pages') {
      setPage('home')
      setActiveCategoryId(null)
      return
    }

    if (['shop', 'cart', 'checkout', 'my-account'].includes(normalizedPath)) {
      setPage('home')
      setActiveCategoryId(null)
      return
    }

    if (pageKey && pageKey !== 'home') {
      setPage(pageKey)
      setActiveCategoryId(null)
      if (!cmsPagesLoaded) return

      const slug = pagePaths[pageKey].split('/').filter(Boolean).at(-1)
      if (!slug) return
      setContentLoading(true)
      const controller = new AbortController()
      fetch(
        contentUrl('/wp/v2/pages', {
          slug,
          _fields: 'id,date,slug,link,title,excerpt,content',
        }),
        { signal: controller.signal },
      )
        .then((response) => {
          if (!response.ok) throw new Error('Unable to load this page.')
          return response.json()
        })
        .then((payload: WordPressPage[]) => {
          if (!payload[0]) throw new Error('This page could not be found.')
          setCmsPage(payload[0])
        })
        .catch((error: unknown) => {
          if (error instanceof Error && error.name !== 'AbortError') {
            setContentError(error.message)
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setContentLoading(false)
        })
      return () => controller.abort()
    }

    if (categoryMatch) {
      setPage('home')
      if (!contentCategoriesLoaded) return
      const category = contentCategories.find((item) => item.slug === categoryMatch[1])
      if (!category) {
        setContentError('This category could not be found.')
        setActiveCategoryId(null)
        return
      }
      setTopic(textFromHtml(category.name))
      setActiveCategoryId(category.id)
      setCurrentPage(1)
      return
    }

    if (!cmsPagesLoaded) return
    const segments = normalizedPath.split('/')
    const isProductRoute = segments[0] === 'product' && segments[1]
    const slug = isProductRoute ? segments[1] : segments.at(-1)
    if (!slug) return

    setPage('home')
    setActiveCategoryId(null)
    setTopic('All stories')
    setContentLoading(true)
    const controller = new AbortController()

    const loadContent = async () => {
      try {
        if (isProductRoute) {
          const response = await fetch(
            contentUrl('/wp/v2/product', {
              slug,
              _fields: 'id,date,slug,link,title,excerpt,content,featured_media',
            }),
            { signal: controller.signal },
          )
          if (!response.ok) throw new Error('Unable to load this product.')
          const payload = (await response.json()) as WordPressProduct[]
          if (!payload[0]) throw new Error('This product could not be found.')
          setCmsProduct(payload[0])
          return
        }

        if (cmsPages.some((item) => item.slug === slug)) {
          const response = await fetch(
            contentUrl('/wp/v2/pages', {
              slug,
              _fields: 'id,date,slug,link,title,excerpt,content',
            }),
            { signal: controller.signal },
          )
          if (!response.ok) throw new Error('Unable to load this page.')
          const payload = (await response.json()) as WordPressPage[]
          if (!payload[0]) throw new Error('This page could not be found.')
          setCmsPage(payload[0])
          return
        }

        const response = await fetch(
          contentUrl('/wp/v2/posts', {
            slug,
            _embed: 1,
            _fields: 'id,date,slug,link,title,excerpt,content,categories,featured_media,_embedded,_links',
          }),
          { signal: controller.signal },
        )
        if (!response.ok) throw new Error('Unable to load this story.')
        const payload = (await response.json()) as WordPressPost[]
        if (!payload[0]) throw new Error('This story could not be found.')
        setCmsPost(payload[0])
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          setContentError(error.message)
        }
      } finally {
        if (!controller.signal.aborted) setContentLoading(false)
      }
    }

    void loadContent()
    return () => controller.abort()
  }, [contentCategories, contentCategoriesLoaded, cmsPages, cmsPagesLoaded, routePath])

  useEffect(() => {
    const controller = new AbortController()
    const loadStories = async () => {
      setLoadingStories(true)
      setCatalogError('')

      try {
        const response = await fetch(
          contentUrl('/wp/v2/posts', {
            page: currentPage,
            per_page: 24,
            categories: activeCategoryId !== null ? activeCategoryId : undefined,
            _embed: 1,
            _fields: 'id,date,slug,link,title,excerpt,categories,featured_media,_embedded,_links',
          }),
          { signal: controller.signal },
        )
        if (!response.ok) throw new Error('Unable to load Nano Digest stories.')

        const payload = (await response.json()) as WordPressPost[]
        const mapped = payload.map((post) => mapWordPressPost(post, contentCategories))
        setArticles((previous) => currentPage === 1 ? mapped : [...previous, ...mapped])
        setTotalPages(Number(response.headers.get('X-WP-TotalPages') || 0))
        setTotalStories(Number(response.headers.get('X-WP-Total') || mapped.length))
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          setCatalogError(error.message)
        }
      } finally {
        if (!controller.signal.aborted) setLoadingStories(false)
      }
    }

    void loadStories()
    return () => controller.abort()
  }, [activeCategoryId, contentCategories, currentPage])

  useEffect(() => {
    if (!searchOpen) {
      setSearchLoading(false)
      return
    }
    const trimmedQuery = query.trim()
    if (!trimmedQuery) {
      setSearchResults(articles.slice(0, 8))
      setSearchLoading(false)
      return
    }

    const controller = new AbortController()
    setSearchResults([])
    setSearchLoading(true)
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(
          contentUrl('/wp/v2/posts', {
            search: trimmedQuery,
            page: 1,
            per_page: 24,
            _embed: 1,
            _fields: 'id,date,slug,link,title,excerpt,categories,featured_media,_embedded,_links',
          }),
          { signal: controller.signal },
        )
        if (!response.ok) throw new Error('Story search is temporarily unavailable.')
        const payload = (await response.json()) as WordPressPost[]
        setSearchResults(payload.map((post) => mapWordPressPost(post, contentCategories)))
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          setSearchResults([])
        }
      } finally {
        if (!controller.signal.aborted) setSearchLoading(false)
      }
    }, 250)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [articles, contentCategories, query, searchOpen])

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus()
    if (!modalOpen) return

    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSearchOpen(false)
        setActiveArticle(null)
      }
    }
    window.addEventListener('keydown', close)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', close)
    }
  }, [modalOpen, searchOpen])

  const filtered = useMemo(
    () =>
      articles.filter(
        (article) => topic === 'All stories' || article.category.split(', ').includes(topic),
      ),
    [articles, topic],
  )

  const adsEnabled = useMemo(() => adsPreviewEnabled(), [])

  const selectTopic = (value: string) => {
    setTopic(value)
    const selectedCategory = contentCategories.find(
      (category) => textFromHtml(category.name) === value,
    )
    setActiveCategoryId(selectedCategory?.id ?? null)
    setCurrentPage(1)
    setPage('home')
    navigateToPath(selectedCategory ? `/category/${selectedCategory.slug}/` : '/')
    setTimeout(() => {
      document.getElementById('latest')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 30)
  }

  const scrollNewsletter = () => {
    setMenuOpen(false)
    if (page !== 'home' || routePath !== '/') openPage('home')
    setTimeout(() => {
      document.getElementById('newsletter')?.scrollIntoView({
        behavior: 'smooth',
      })
    }, 10)
  }

  const handleNewsletterSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    try {
      const response = await fetch(formUrl('newsletter'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newsletterForm),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.message || 'Unable to subscribe.')
      }

      setStatus({ type: 'success', message: 'Subscribed successfully — welcome to the Nano Digest digest.' })
      setNewsletterForm({ name: '', email: '', interest: 'All stories' })
    } catch (error) {
      setStatus({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Subscription could not be completed.',
      })
    }
  }

  const handleContactSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    try {
      const response = await fetch(formUrl('contact'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.message || 'Unable to send your message.')
      }

      setStatus({ type: 'success', message: 'Your message was sent successfully.' })
      setContactForm({ name: '', email: '', company: '', message: '' })
    } catch (error) {
      setStatus({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Your message could not be sent.',
      })
    }
  }

  const handleAdvertiseSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    try {
      const response = await fetch(formUrl('advertise'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(advertiseForm),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.message || 'Unable to submit partnership request.')
      }

      setStatus({ type: 'success', message: 'Partnership request submitted successfully.' })
      setAdvertiseForm({
        company: '',
        contact: '',
        email: '',
        website: '',
        budget: '',
        goal: '',
        message: '',
      })
    } catch (error) {
      setStatus({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Partnership request could not be submitted.',
      })
    }
  }

  const addToCart = (quantity = 1) => {
    if (!storeProduct) return
    setCartQuantity((current) => Math.min(20, current + quantity))
    setOrderStatus(null)
  }

  const handleOrderSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!storeProduct || cartQuantity < 1) {
      setOrderStatus({ type: 'error', message: 'Your cart is empty.' })
      return
    }

    try {
      const response = await fetch(formUrl('orders'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...checkoutForm,
          items: [{ productId: storeProduct.id, name: storeProduct.name, quantity: cartQuantity }],
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.message || 'Unable to save your order request.')

      setOrderStatus({ type: 'success', message: payload.message })
      setCartQuantity(0)
      setCheckoutForm({ name: '', email: '', phone: '', address: '' })
    } catch (error) {
      setOrderStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unable to save your order request.',
      })
    }
  }

  const openPage = (nextPage: PageKey) => {
    setPage(nextPage)
    navigateToPath(nextPage === 'home' ? '/' : pagePaths[nextPage])
  }

  const renderInfoPage = () => {
    const pageContent: Record<PageKey, JSX.Element> = {
      home: <></>,
      about: (
        <section className="page-panel glass">
          <div className="page-heading">
            <span className="eyebrow">
              <span className="status-dot" /> ABOUT NANO DIGEST
            </span>
            <h1>Making nanotechnology readable, relevant, and real.</h1>
          </div>

          <div className="content-grid two-up">
            <div className="info-card">
              <h3>Our mission</h3>
              <p>
                Nano Digest turns complex scientific findings into clear, useful stories for readers who care about the future of health, energy, materials, and technology.
              </p>
            </div>
            <div className="info-card">
              <h3>Our coverage</h3>
              <p>
                We cover nanomedicine, materials science, chemistry, engineering, clean energy, and the innovations changing the world at the smallest scale.
              </p>
            </div>
            <div className="info-card">
              <h3>What we value</h3>
              <p>
                Accuracy, editorial clarity, and curiosity. We believe science should be understandable without losing precision or context.
              </p>
            </div>
            <div className="info-card">
              <h3>Why it matters</h3>
              <p>
                The future is built from the molecular layer outward. Nano Digest helps readers connect the tiny breakthroughs to the big ideas shaping tomorrow.
              </p>
            </div>
          </div>

          <div className="cta-row">
            <button className="primary-button" onClick={() => openPage('contact')}>
              Contact the editorial team <Icon name="arrow" size={16} />
            </button>
            <button className="secondary-button" onClick={() => openPage('advertise')}>
              Explore sponsorship opportunities
            </button>
          </div>
        </section>
      ),
      advertise: (
        <section className="page-panel glass">
          <div className="page-heading">
            <span className="eyebrow">
              <span className="status-dot" /> ADVERTISE WITH NANO DIGEST
            </span>
            <h1>Partner with a science-first audience.</h1>
          </div>

          <div className="content-grid two-up">
            <div className="info-card highlight-card">
              <h3>Audience fit</h3>
              <p>
                Reach researchers, founders, innovation teams, and decision-makers interested in the latest breakthroughs across nanotech and advanced materials.
              </p>
            </div>
            <div className="info-card">
              <h3>Formats available</h3>
              <p>
                Feature stories, sponsored explainers, newsletter placements, branded research roundups, and strategic editorial collaborations.
              </p>
            </div>
          </div>

          <form className="form-panel" onSubmit={handleAdvertiseSubmit}>
            <div className="field-grid">
              <label className="field">
                <span>Company name</span>
                <input
                  value={advertiseForm.company}
                  onChange={(event) =>
                    setAdvertiseForm({ ...advertiseForm, company: event.target.value })
                  }
                  required
                />
              </label>
              <label className="field">
                <span>Contact name</span>
                <input
                  value={advertiseForm.contact}
                  onChange={(event) =>
                    setAdvertiseForm({ ...advertiseForm, contact: event.target.value })
                  }
                  required
                />
              </label>
              <label className="field">
                <span>Email</span>
                <input
                  type="email"
                  value={advertiseForm.email}
                  onChange={(event) =>
                    setAdvertiseForm({ ...advertiseForm, email: event.target.value })
                  }
                  required
                />
              </label>
              <label className="field">
                <span>Website</span>
                <input
                  value={advertiseForm.website}
                  onChange={(event) =>
                    setAdvertiseForm({ ...advertiseForm, website: event.target.value })
                  }
                />
              </label>
              <label className="field">
                <span>Budget range</span>
                <input
                  value={advertiseForm.budget}
                  onChange={(event) =>
                    setAdvertiseForm({ ...advertiseForm, budget: event.target.value })
                  }
                  placeholder="$5K - $20K"
                />
              </label>
              <label className="field">
                <span>Primary goal</span>
                <select
                  value={advertiseForm.goal}
                  onChange={(event) =>
                    setAdvertiseForm({ ...advertiseForm, goal: event.target.value })
                  }
                  required
                >
                  <option value="">Select an objective</option>
                  <option value="Brand awareness">Brand awareness</option>
                  <option value="Lead generation">Lead generation</option>
                  <option value="Product launch">Product launch</option>
                  <option value="Research partnership">Research partnership</option>
                  <option value="Editorial collaboration">Editorial collaboration</option>
                </select>
              </label>
            </div>

            <label className="field full-width">
              <span>Tell us about your campaign</span>
              <textarea
                rows={5}
                value={advertiseForm.message}
                onChange={(event) =>
                  setAdvertiseForm({ ...advertiseForm, message: event.target.value })
                }
                required
              />
            </label>

            {status && (
              <div className={`alert ${status.type}`}>{status.message}</div>
            )}

            <button className="primary-button" type="submit">
              Send partnership request <Icon name="arrow" size={16} />
            </button>
          </form>
        </section>
      ),
      contact: (
        <section className="page-panel glass">
          <div className="page-heading">
            <span className="eyebrow">
              <span className="status-dot" /> CONTACT
            </span>
            <h1>Let’s talk about science, stories, and strategy.</h1>
          </div>

          <form className="form-panel" onSubmit={handleContactSubmit}>
            <div className="field-grid">
              <label className="field">
                <span>Your name</span>
                <input
                  value={contactForm.name}
                  onChange={(event) =>
                    setContactForm({ ...contactForm, name: event.target.value })
                  }
                  required
                />
              </label>
              <label className="field">
                <span>Email</span>
                <input
                  type="email"
                  value={contactForm.email}
                  onChange={(event) =>
                    setContactForm({ ...contactForm, email: event.target.value })
                  }
                  required
                />
              </label>
              <label className="field full-width">
                <span>Company or organization</span>
                <input
                  value={contactForm.company}
                  onChange={(event) =>
                    setContactForm({ ...contactForm, company: event.target.value })
                  }
                />
              </label>
            </div>

            <label className="field full-width">
              <span>Your message</span>
              <textarea
                rows={6}
                value={contactForm.message}
                onChange={(event) =>
                  setContactForm({ ...contactForm, message: event.target.value })
                }
                required
              />
            </label>

            {status && (
              <div className={`alert ${status.type}`}>{status.message}</div>
            )}

            <button className="primary-button" type="submit">
              Send message <Icon name="arrow" size={16} />
            </button>
          </form>
        </section>
      ),
      privacy: (
        <section className="page-panel glass page-copy">
          <div className="page-heading">
            <span className="eyebrow">
              <span className="status-dot" /> PRIVACY POLICY
            </span>
            <h1>Your information is handled with care.</h1>
          </div>
          <p>
            Nano Digest respects the privacy of its readers, partners, and contributors. We collect only the data necessary to provide services such as newsletter subscriptions, research inquiries, and advertising discussions.
          </p>
          <p>
            We use your contact details only to deliver the communication you request and to improve the relevance of our content. We do not sell personal information to third parties, and we store submissions securely in our project backend.
          </p>
          <p>
            If you wish to update or remove your information, contact the editorial team directly via the contact page or support channel.
          </p>
        </section>
      ),
      terms: (
        <section className="page-panel glass page-copy">
          <div className="page-heading">
            <span className="eyebrow">
              <span className="status-dot" /> TERMS & CONDITIONS
            </span>
            <h1>Editorial use and site access.</h1>
          </div>
          <p>
            By using the Nano Digest website, you agree to use this content responsibly and for lawful purposes. Articles, summaries, and related materials are provided for informational and educational use.
          </p>
          <p>
            All content should be considered original editorial material for the site’s demonstration and communications workflow. Reproduction for publication or redistribution requires written permission from the publisher.
          </p>
          <p>
            The website may be updated periodically, and features such as subscriptions, forms, and partner outreach are intended to provide a complete client presentation experience during development.
          </p>
        </section>
      ),
    }

    if (cmsPage?.content?.rendered) {
      const cmsPageContent = (
        <section className="page-panel glass cms-page-copy">
          <span className="eyebrow">NANO DIGEST / {pageLabels[page].toUpperCase()}</span>
          <div
            className="cms-content"
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(cmsPage.content.rendered),
            }}
          />
        </section>
      )

      if (page === 'contact' || page === 'advertise') {
        return <>{cmsPageContent}{pageContent[page]}</>
      }
      return cmsPageContent
    }

    return pageContent[page]
  }

  const normalizedRoutePath = routePath.replace(/^\/+|\/+$/g, '')
  const isCategoryRoute = normalizedRoutePath.startsWith('category/')
  const isDirectoryRoute = normalizedRoutePath === 'pages'
  const isShopRoute = normalizedRoutePath === 'shop'
  const isCartRoute = normalizedRoutePath === 'cart'
  const isCheckoutRoute = normalizedRoutePath === 'checkout'
  const isAccountRoute = normalizedRoutePath === 'my-account'
  const isStoreRoute = isShopRoute || isCartRoute || isCheckoutRoute || isAccountRoute
  const isCmsDetailRoute = Boolean(normalizedRoutePath) &&
    !isCategoryRoute &&
    !isDirectoryRoute &&
    !isStoreRoute &&
    !pageKeyFromPath(routePath)

  const renderCmsDetail = () => {
    if (contentLoading || !cmsPagesLoaded) {
      return <section className="page-panel glass"><p>Loading Nano Digest content…</p></section>
    }
    if (contentError) {
      return (
        <section className="page-panel glass">
          <div className="alert error">{contentError}</div>
          <button className="secondary-button" onClick={() => openPage('home')}>Back to home</button>
        </section>
      )
    }

    const title = cmsPost?.title.rendered || cmsPage?.title.rendered || cmsProduct?.title.rendered
    const markup = cmsPost?.content?.rendered || cmsPage?.content?.rendered || cmsProduct?.content?.rendered || ''
    const originalUrl = cmsPost?.link || cmsPage?.link || cmsProduct?.link
    const categoryName = cmsPost?.categories
      .map((id) => contentCategories.find((category) => category.id === id)?.name)
      .filter((name): name is string => Boolean(name))
      .map(textFromHtml)
      .join(' / ')
    const image = cmsPost?._embedded?.['wp:featuredmedia']?.[0]?.source_url

    const sanitizedMarkup = DOMPurify.sanitize(markup)
    const isArticleDetail = Boolean(cmsPost)
    const showArticleAds = adsEnabled && isArticleDetail
    const [contentFirst, contentSecond] = showArticleAds
      ? splitContentForAd(sanitizedMarkup)
      : [sanitizedMarkup, '']
    const showInContentAd = showArticleAds && contentSecond.length > 0
    const showSidebarAd = showArticleAds && sanitizedMarkup.length > 1500

    if (!title) {
      return (
        <section className="page-panel glass">
          <div className="alert error">This Nano Digest page could not be found.</div>
          <button className="secondary-button" onClick={() => openPage('home')}>Back to home</button>
        </section>
      )
    }

    return (
      <article className="page-panel glass cms-detail">
        <div className={`article-layout${showSidebarAd ? ' article-layout--with-aside' : ''}`}>
          <div className="article-main">
            <div className="page-heading">
              <span className="eyebrow"><span className="status-dot" />{categoryName || 'NANO DIGEST'}</span>
              <h1>{textFromHtml(title)}</h1>
              {cmsPost && (
                <div className="article-meta cms-meta">
                  <span>{new Intl.DateTimeFormat('en', { dateStyle: 'long' }).format(new Date(cmsPost.date))}</span>
                </div>
              )}
            </div>
            {image && <img className="cms-detail-image" src={image} alt={textFromHtml(title)} />}
            {cmsProduct && (
              <div className="shop-purchase-row">
                <strong>{formattedProductPrice || 'Price currently unavailable'}</strong>
                <button className="primary-button" onClick={() => addToCart()} disabled={!storeProduct}>
                  Add to cart <Icon name="cart" size={17} />
                </button>
              </div>
            )}
            <div className="cms-content" dangerouslySetInnerHTML={{ __html: contentFirst }} />
            {showInContentAd && <AdSlot placement="article-in-content" />}
            {contentSecond && (
              <div className="cms-content" dangerouslySetInnerHTML={{ __html: contentSecond }} />
            )}
            {originalUrl && (
              <a className="secondary-button cms-source" href={originalUrl} target="_blank" rel="noreferrer">
                View original on Nano Digest <Icon name="diagonal" size={15} />
              </a>
            )}
          </div>
          {showSidebarAd && (
            <aside className="article-aside" aria-label="Article advertisement">
              <AdSlot placement="article-sidebar" />
            </aside>
          )}
        </div>
      </article>
    )
  }

  const renderShopRoute = () => (
    <section className="page-panel glass shop-page">
      <div className="page-heading">
        <span className="eyebrow">NANO DIGEST / SHOP</span>
        <h1>Shop</h1>
        <p>Books and resources from Nano Digest.</p>
      </div>
      {!storeProductsLoaded ? (
        <p className="catalog-loading">Loading shop…</p>
      ) : storeProduct ? (
        <article className="shop-product">
          <img src={storeProduct.images[0]?.src || photo('photo-1532012197267-da84d127e765')} alt={storeProduct.images[0]?.alt || storeProduct.name} />
          <div className="shop-product-copy">
            <span className="category-label">NANO DIGEST BOOKS</span>
            <h2>{storeProduct.name}</h2>
            <div className="cms-content" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(storeProduct.short_description || storeProduct.description) }} />
            <strong className="shop-price">{formattedProductPrice}</strong>
            <div className="cta-row">
              <button className="primary-button" onClick={() => addToCart()}>
                Add to cart <Icon name="cart" size={17} />
              </button>
              <button className="secondary-button" onClick={() => navigateToPath('/cart/')}>
                View cart ({cartQuantity})
              </button>
            </div>
          </div>
        </article>
      ) : (
        <div className="alert error">The shop catalog is temporarily unavailable.</div>
      )}
    </section>
  )

  const renderCartRoute = () => (
    <section className="page-panel glass checkout-page">
      <div className="page-heading">
        <span className="eyebrow">NANO DIGEST / SHOP</span>
        <h1>Your cart</h1>
      </div>
      {cartQuantity < 1 ? (
        <div className="empty-cart">
          <p>Your cart is empty.</p>
          <button className="primary-button" onClick={() => navigateToPath('/shop/')}>Browse the shop <Icon name="arrow" size={16} /></button>
        </div>
      ) : storeProduct ? (
        <div className="cart-line">
          <img src={storeProduct.images[0]?.src || photo('photo-1532012197267-da84d127e765')} alt={storeProduct.images[0]?.alt || storeProduct.name} />
          <div className="cart-line-copy">
            <h2>{storeProduct.name}</h2>
            <span>{formattedProductPrice} each</span>
          </div>
          <div className="quantity-control" aria-label="Cart quantity">
            <button aria-label="Decrease quantity" onClick={() => setCartQuantity((value) => Math.max(0, value - 1))}>−</button>
            <span>{cartQuantity}</span>
            <button aria-label="Increase quantity" disabled={cartQuantity >= 20} onClick={() => setCartQuantity((value) => Math.min(20, value + 1))}>+</button>
          </div>
          <strong className="cart-subtotal">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: storeProduct.prices.currency_code }).format(productPrice * cartQuantity)}</strong>
        </div>
      ) : (
        <p className="catalog-loading">Loading cart…</p>
      )}
      {cartQuantity > 0 && (
        <div className="cart-actions">
          <button className="text-link" onClick={() => setCartQuantity(0)}>Remove item</button>
          <button className="primary-button" onClick={() => navigateToPath('/checkout/')}>Continue to checkout <Icon name="arrow" size={16} /></button>
        </div>
      )}
    </section>
  )

  const renderCheckoutRoute = () => (
    <section className="page-panel glass checkout-page checkout-page--flow">
      <div className="page-heading">
        <span className="eyebrow">NANO DIGEST / CHECKOUT</span>
        <h1>Delivery details</h1>
      </div>
      {cartQuantity < 1 ? (
        <div className="empty-cart">
          <p>Your cart is empty.</p>
          <button className="secondary-button" onClick={() => navigateToPath('/shop/')}>Return to shop</button>
        </div>
      ) : (
        <>
          <div className="checkout-summary">
            <span>{storeProduct?.name} × {cartQuantity}</span>
            <strong>{storeProduct ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: storeProduct.prices.currency_code }).format(productPrice * cartQuantity) : formattedProductPrice}</strong>
          </div>
          <form className="form-panel checkout-form" onSubmit={handleOrderSubmit}>
            <div className="field-grid">
              <label className="field"><span>Full name</span><input autoComplete="name" value={checkoutForm.name} onChange={(event) => setCheckoutForm({ ...checkoutForm, name: event.target.value })} required /></label>
              <label className="field"><span>Email</span><input type="email" autoComplete="email" value={checkoutForm.email} onChange={(event) => setCheckoutForm({ ...checkoutForm, email: event.target.value })} required /></label>
              <label className="field"><span>Phone</span><input type="tel" autoComplete="tel" value={checkoutForm.phone} onChange={(event) => setCheckoutForm({ ...checkoutForm, phone: event.target.value })} /></label>
              <label className="field full-width"><span>Delivery address</span><textarea autoComplete="street-address" rows={4} value={checkoutForm.address} onChange={(event) => setCheckoutForm({ ...checkoutForm, address: event.target.value })} required /></label>
            </div>
            <p className="payment-note">This demo records an order request only. No payment is collected online.</p>
            {orderStatus && <div className={`alert ${orderStatus.type}`} role="status">{orderStatus.message}</div>}
            <button className="primary-button" type="submit" disabled={!storeProduct}>Submit order request <Icon name="arrow" size={16} /></button>
          </form>
        </>
      )}
    </section>
  )

  const renderAccountRoute = () => (
    <section className="page-panel glass page-copy">
      <div className="page-heading">
        <span className="eyebrow">NANO DIGEST / ACCOUNT</span>
        <h1>My account</h1>
      </div>
      <p>Account sign-in is managed by the original Nano Digest store.</p>
      <a className="primary-button account-link" href="https://nanodigest.in/my-account/" target="_blank" rel="noreferrer">
        Open Nano Digest account <Icon name="diagonal" size={16} />
      </a>
    </section>
  )

  const renderCategoryArchive = () => {
    const slug = normalizedRoutePath.split('/').filter(Boolean).at(-1)
    const category = contentCategories.find((item) => item.slug === slug)

    return (
      <section className="page-panel glass cms-archive">
        <div className="page-heading">
          <span className="eyebrow">NANO DIGEST / CATEGORY</span>
          <h1>{category ? textFromHtml(category.name) : 'Category stories'}</h1>
          <p>{category ? `${category.count.toLocaleString()} published stories` : 'Browse published stories by category.'}</p>
        </div>
        <AdSlot placement="archive-banner" />
        <div className="article-grid">
          {articles.map((article) => (
            <button className="article-card glass" key={article.id} onClick={() => openStory(article)}>
              <div className="article-image"><img src={article.image} alt={article.title} loading="lazy" /></div>
              <div className="article-card-copy">
                <span className="category-label">{article.category}</span>
                <h3>{article.title}</h3>
                <p>{article.description}</p>
                <div className="article-meta"><span>{article.date}</span></div>
              </div>
            </button>
          ))}
        </div>
        {loadingStories && <p className="catalog-loading">Loading stories…</p>}
        {currentPage < totalPages && (
          <div className="catalog-actions">
            <button className="secondary-button" onClick={() => setCurrentPage((current) => current + 1)} disabled={loadingStories}>
              Load more stories <Icon name="arrow" size={16} />
            </button>
          </div>
        )}
      </section>
    )
  }

  const renderPageDirectory = () => (
    <section className="page-panel glass cms-directory">
      <div className="page-heading">
        <span className="eyebrow">NANO DIGEST / DIRECTORY</span>
        <h1>Explore the site</h1>
      </div>
      <div className="cms-directory-list">
        {cmsPages.map((item) => (
          <a href={pathWithBase(`/${item.slug}/`)} key={item.id} onClick={(event) => {
            event.preventDefault()
            navigateToPath(`/${item.slug}/`)
          }}>
            <span>{textFromHtml(item.title.rendered)}</span>
            <Icon name="diagonal" size={16} />
          </a>
        ))}
        {cmsProducts.map((item) => (
          <a href={pathWithBase(`/product/${item.slug}/`)} key={`product-${item.id}`} onClick={(event) => {
            event.preventDefault()
            navigateToPath(`/product/${item.slug}/`)
          }}>
            <span>Shop: {textFromHtml(item.title.rendered)}</span>
            <Icon name="diagonal" size={16} />
          </a>
        ))}
      </div>
    </section>
  )

  return (
    <div className="site-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <div className="topline">
        <span>INDEPENDENT THINKING. INFINITESIMAL POSSIBILITIES.</span>
        <span>
          Exploring science at the smallest scale <span className="tiny-dot" />
        </span>
      </div>

      <header className="masthead">
        <button className="wordmark" onClick={() => openPage('home')} aria-label="Nano Digest home">
          <span className="brand-badge">
            <img src={nanoDigestLogo} alt="Nano Digest" />
          </span>
        </button>
        <div className="masthead-right">
          <span>
            A small world.
            <br />
            <strong>A bigger perspective.</strong>
          </span>
          <span className="edition">
            THE NANO EDIT
            <br />
            <b>VOL. 01 / 2026</b>
          </span>
        </div>
      </header>

      <nav className="navigation glass" aria-label="Main navigation">
        <div className="nav-links">
          <button className={page === 'home' ? 'nav-active' : ''} onClick={() => openPage('home')}>
            Discover
            <span />
          </button>
          <button onClick={() => selectTopic('Physical Science & Technology')}>
            Physical Science
          </button>
          <button onClick={() => selectTopic('Biological Science & Technology')}>
            Biological Sciences
          </button>
          <button onClick={() => scrollNewsletter()}>
            The Magazine <span className="new-tag">NEW</span>
          </button>
          <button onClick={() => openPage('about')}>About us</button>
          <button onClick={() => openPage('advertise')}>Advertise</button>
        </div>

        <div className="nav-actions">
          <button
            className="search-button"
            aria-label="Search stories"
            onClick={() => setSearchOpen(true)}
          >
            <Icon name="search" />
          </button>
          <button
            className="cart-button"
            aria-label={`Cart, ${cartQuantity} items`}
            onClick={() => navigateToPath('/cart/')}
          >
            <Icon name="cart" size={18} />
            <span>{cartQuantity}</span>
          </button>
          <button className="subscribe-button" onClick={scrollNewsletter}>
            Subscribe <Icon name="diagonal" size={16} />
          </button>
          <button
            className="mobile-menu"
            aria-label="Toggle navigation"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Icon name={menuOpen ? 'close' : 'menu'} />
          </button>
        </div>

        {menuOpen && (
          <div className="mobile-dropdown">
            {topicOptions.map((topicName) => (
              <button key={topicName} onClick={() => selectTopic(topicName)}>
                {topicName}
              </button>
            ))}
            <button onClick={() => openPage('about')}>About us</button>
            <button onClick={() => openPage('contact')}>Contact</button>
            <button onClick={() => openPage('advertise')}>Advertise</button>
          </div>
        )}
      </nav>

      <main>
        {isShopRoute ? renderShopRoute() : isCartRoute ? renderCartRoute() : isCheckoutRoute ? renderCheckoutRoute() : isAccountRoute ? renderAccountRoute() : isCmsDetailRoute ? renderCmsDetail() : isCategoryRoute ? renderCategoryArchive() : isDirectoryRoute ? renderPageDirectory() : page === 'home' ? (
          <>
            <section className="intro">
              <div>
                <span className="eyebrow">
                  <span className="status-dot" /> THE WORLD OF NANO, IN FOCUS
                </span>
                <h1>
                  <span className="sr-only">Small science. Limitless impact.</span>
                  <span className="typewriter" aria-hidden="true">
                    <Typewriter text="Small science. Limitless impact." accent="Limitless impact." />
                  </span>
                </h1>
              </div>
              <p>
                Discover the ideas, breakthroughs, and people
                <br className="desktop-break" /> shaping our world—one nanometer at
                a time.
              </p>
            </section>

            <section className="featured-grid" aria-label="Featured stories">
              <button
                className="hero-story"
                onClick={() => openStory(articles[0])}
              >
                <img
                  src={articles[0].image}
                  alt={articles[0].title}
                />
                <div className="hero-shade" />
                <div className="hero-top">
                  <span className="glass-chip">
                    <span className="yellow-dot" /> THE BIG PICTURE
                  </span>
                  <span className="image-label">01 / THE NANO FRONTIER</span>
                </div>
                <div className="hero-content glass">
                  <div className="hero-category">
                    {articles[0].category.toUpperCase()} <span>•</span>{' '}
                    {articles[0].time.toUpperCase()}
                  </div>
                  <h2>{articles[0].title}</h2>
                  <p>{articles[0].description}</p>
                  <div className="hero-bottom">
                    <span>
                      Explore the story <Icon name="arrow" size={18} />
                    </span>
                    <span className="circle-arrow">
                      <Icon name="diagonal" size={21} />
                    </span>
                  </div>
                </div>
                <span className="image-credit">NANO DIGEST / WEB EXCLUSIVE</span>
              </button>

              <div className="editors-picks">
                <div className="picks-heading">
                  <span className="eyebrow">THE EDITOR’S PICK</span>
                  <span className="four-point">✦</span>
                </div>
                {articles.slice(1, 3).map((article, index) => (
                  <button
                    className={`pick-story glass pick-${index}`}
                    key={article.id}
                    onClick={() => openStory(article)}
                  >
                    <div className="pick-image">
                      <img
                        src={article.image}
                        alt={article.title}
                      />
                      <span className="pick-number">0{index + 2}</span>
                    </div>
                    <div className="pick-copy">
                      <span className="category-label">{article.category}</span>
                      <h2>{article.title}</h2>
                      <div className="article-meta">
                        <span>{article.time}</span>
                        <Icon name="diagonal" size={18} />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <AdSlot placement="home-leaderboard" />

            <section className="topics-strip" aria-label="Explore topics">
              <div className="topics-title">
                <Icon name="atom" size={23} />
                <span>
                  Find your
                  <br />
                  <strong>small obsession.</strong>
                </span>
              </div>
              <div className="topic-links">
                {topicOptions.slice(1).map((item) => (
                  <button
                    key={item}
                    onClick={() => selectTopic(item)}
                    className={topic === item ? 'selected' : ''}
                  >
                    {item}
                    <Icon name="diagonal" size={14} />
                  </button>
                ))}
              </div>
            </section>

            <section className="latest-section" id="latest">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">FRESH PERSPECTIVES</span>
                  <h2>The latest in little.</h2>
                </div>
                <button
                  className="text-link"
                  onClick={() => {
                    setTopic('All stories')
                    setActiveCategoryId(null)
                    setCurrentPage(1)
                    setShowAll(!showAll)
                  }}
                >
                  {showAll ? 'Show fewer stories' : 'View all stories'}{' '}
                  <Icon name="arrow" size={18} />
                </button>
              </div>

              <div className="filter-row">
                {topicOptions.map((item) => (
                  <button
                    key={item}
                    onClick={() => selectTopic(item)}
                    className={topic === item ? 'filter-active' : ''}
                  >
                    {item}
                  </button>
                ))}
                <span className="story-count">{totalStories.toLocaleString()} stories</span>
              </div>

              <div className="article-grid">
                {(showAll || topic !== 'All stories' ? filtered : filtered.slice(3, 6)).map((article) => (
                  <button
                    className="article-card glass"
                    key={article.id}
                    onClick={() => openStory(article)}
                  >
                    <div className="article-image">
                      <img src={article.image} alt={article.title} loading="lazy" />
                      <span className="article-image-arrow">
                        <Icon name="diagonal" />
                      </span>
                    </div>
                    <div className="article-card-copy">
                      <span className="category-label">{article.category}</span>
                      <h3>{article.title}</h3>
                      <p>{article.description}</p>
                      <div className="article-meta">
                        <span>{article.date}</span>
                        <span>{article.time}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {catalogError && <div className="alert error">{catalogError}</div>}
              {currentPage < totalPages && (
                <div className="catalog-actions">
                  <button
                    className="secondary-button"
                    onClick={() => setCurrentPage((current) => current + 1)}
                    disabled={loadingStories}
                  >
                    {loadingStories ? 'Loading stories…' : 'Load more stories'}
                    <Icon name="arrow" size={16} />
                  </button>
                </div>
              )}
            </section>

            <section className="channels-section" aria-labelledby="channels-title">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">FOLLOW NANO DIGEST</span>
                  <h2 id="channels-title">Science, wherever you scroll.</h2>
                </div>
              </div>

              <div className="channel-grid">
                <article className="channel-card glass channel-youtube">
                  <span className="channel-icon" aria-hidden="true">
                    <Icon name="youtube" size={28} />
                  </span>
                  <span className="channel-kicker">YOUTUBE CHANNEL</span>
                  <h3>Nano TV — The Science Channel</h3>
                  <p>
                    Watch clear, visual explainers on nanotechnology, materials,
                    and the science shaping our world at the smallest scale.
                  </p>
                  <div className="channel-actions">
                    <a
                      className="primary-button channel-button"
                      href="https://youtube.com/@nanotv-thesciencechannel?si=Zs7zXoyx-1tl05OL"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Icon name="youtube" size={18} /> Watch on YouTube
                    </a>
                    <a
                      className="secondary-button channel-button"
                      href="https://youtube.com/@nanotv-thesciencechannel?si=Zs7zXoyx-1tl05OL"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Subscribe on YouTube
                    </a>
                  </div>
                </article>

                <article className="channel-card glass channel-whatsapp">
                  <span className="channel-icon" aria-hidden="true">
                    <Icon name="whatsapp" size={26} />
                  </span>
                  <span className="channel-kicker">WHATSAPP CHANNEL</span>
                  <h3>NANO DIGEST — The Science Channel</h3>
                  <p>
                    Follow the science channel on WhatsApp for updates, new
                    stories, and the latest from Nano Digest.
                  </p>
                  <div className="channel-actions">
                    <a
                      className="primary-button channel-button"
                      href="https://whatsapp.com/channel/0029Vb8jZTlEVccGbSYeAD2V"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Icon name="whatsapp" size={18} /> Follow on WhatsApp
                    </a>
                  </div>
                </article>
              </div>
            </section>

            <section className="newsletter" id="newsletter">
              <div className="newsletter-orbit orbit-one" />
              <div className="newsletter-orbit orbit-two" />
              <div className="newsletter-copy">
                <span className="eyebrow">
                  <span className="yellow-dot" /> A LITTLE KNOWLEDGE GOES A LONG WAY
                </span>
                <h2>
                  A big world.
                  <br />A small, brilliant digest.
                </h2>
                <p>
                  The stories that matter. The discoveries that inspire.
                  <br />A fresh perspective on nano, delivered to your inbox.
                </p>
              </div>

              <div className="newsletter-form glass">
                <span className="newsletter-label">
                  <Icon name="mail" size={22} /> YOUR WEEKLY DOSE OF DISCOVERY
                </span>

                <form onSubmit={handleNewsletterSubmit}>
                  <div className="field-grid compact">
                    <label className="field">
                      <span>Name</span>
                      <input
                        value={newsletterForm.name}
                        onChange={(event) =>
                          setNewsletterForm({
                            ...newsletterForm,
                            name: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Email</span>
                      <input
                        type="email"
                        value={newsletterForm.email}
                        onChange={(event) =>
                          setNewsletterForm({
                            ...newsletterForm,
                            email: event.target.value,
                          })
                        }
                        required
                      />
                    </label>
                    <label className="field full-width">
                      <span>Topics of interest</span>
                      <select
                        value={newsletterForm.interest}
                        onChange={(event) =>
                          setNewsletterForm({
                            ...newsletterForm,
                            interest: event.target.value,
                          })
                        }
                      >
                        {topicOptions.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {status && (
                    <div className={`alert ${status.type}`}>{status.message}</div>
                  )}

                  <div className="email-input">
                    <button type="submit" aria-label="Join the newsletter">
                      Join the newsletter <Icon name="arrow" size={22} />
                    </button>
                  </div>
                </form>
              </div>
            </section>

            <section className="manifesto">
              <Icon name="atom" size={30} />
              <p>
                For the curious minds who know that
                <br />
                <strong>the smallest things can change everything.</strong>
              </p>
              <button className="text-link" onClick={() => openPage('about')}>
                Get to know us <Icon name="arrow" size={18} />
              </button>
            </section>
          </>
        ) : renderInfoPage()}
      </main>

      <footer>
        <div className="footer-top">
          <button className="footer-logo" onClick={() => openPage('home')}>
            <img src={nanoDigestLogo} alt="Nano Digest" />
          </button>
          <span>Science. Perspective. Possibility.</span>
          <div>
            <button onClick={() => openPage('contact')}>
              Get in touch <Icon name="diagonal" size={15} />
            </button>
            <button onClick={() => openPage('terms')}>Editorial policy</button>
            <button onClick={() => navigateToPath('/pages/')}>All pages</button>
            <button onClick={() => navigateToPath('/shop/')}>Shop</button>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Nano Digest. A world of possibilities.</span>
          <span>Made for curious minds.</span>
          <button onClick={() => openPage('privacy')}>Privacy & terms</button>
        </div>
      </footer>

      {modalOpen && (
        <div
          className="modal-backdrop"
          onClick={() => {
            setSearchOpen(false)
            setActiveArticle(null)
          }}
        >
          <section
            className={`modal glass ${activeArticle ? 'article-modal' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label={searchOpen ? 'Search Nano Digest' : activeArticle?.title || 'Information'}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              autoFocus={!searchOpen}
              className="modal-close"
              aria-label="Close dialog"
              onClick={() => {
                setSearchOpen(false)
                setActiveArticle(null)
              }}
            >
              <Icon name="close" />
            </button>

            {searchOpen && (
              <>
                <span className="eyebrow">FOLLOW YOUR CURIOSITY</span>
                <h2>A little search. A big discovery.</h2>
                <div className="search-input">
                  <Icon name="search" />
                  <input
                    ref={searchRef}
                    aria-label="Search stories"
                    placeholder="Search topics, discoveries, stories…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <div className="search-results" aria-live="polite">
                  {searchLoading ? (
                    <p>Searching Nano Digest…</p>
                  ) : searchResults.length ? (
                    searchResults.map((story) => (
                      <button
                        key={story.id}
                        onClick={() => {
                          setSearchOpen(false)
                          openStory(story)
                        }}
                      >
                        <img src={story.image} alt="" />
                        <div>
                          <span className="category-label">{story.category}</span>
                          <h3>{story.title}</h3>
                        </div>
                        <Icon name="diagonal" />
                      </button>
                    ))
                  ) : (
                    <p>No stories found. Try “materials”, “energy”, or “medicine”.</p>
                  )}
                </div>
              </>
            )}

            {activeArticle && (
              <>
                <img className="modal-hero" src={activeArticle.image} alt={activeArticle.title} />
                <div className="article-body">
                  <span className="category-label">{activeArticle.category}</span>
                  <h2>{activeArticle.title}</h2>
                  <div className="article-meta">
                    <span>{activeArticle.date}</span>
                    <span>{activeArticle.time}</span>
                  </div>
                  <p className="article-lede">{activeArticle.description}</p>
                  <p>
                    This redesign includes a short story preview. Open the original Nano Digest article for the complete reporting and source details.
                  </p>
                  <a
                    className="primary-button source-link"
                    href={activeArticle.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Read the original story <Icon name="diagonal" size={16} />
                  </a>
                  <div className="sample-notice">
                    Story preview. The original article opens on nanodigest.in.
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
