/**
 * Settings the WordPress theme writes into the page (see
 * wordpress/nanodigest/functions.php). On the static preview build none of
 * this exists and every value falls back to its build-time default.
 */
export type BankDetails = {
  accountName: string
  accountNumber: string
  ifsc: string
  bankName: string
  branch: string
  accountType: string
  upiId: string
}

type RuntimeConfig = {
  /** WordPress REST root without a trailing slash, e.g. https://nanodigest.in/wp-json */
  restUrl?: string
  /** Path the site lives under, '' for the domain root. */
  basePath?: string
  /** WooCommerce "My account" page. */
  accountUrl?: string
  /** Bank transfer details entered in wp-admin (NanoDigest > Settings). */
  bank?: Partial<BankDetails> | null
  /** True when a WordPress cookie-consent plugin already shows its own banner. */
  externalCookieBanner?: boolean
}

declare global {
  interface Window {
    __NANODIGEST__?: RuntimeConfig
  }
}

const raw: RuntimeConfig =
  (typeof window !== 'undefined' && typeof window.__NANODIGEST__ === 'object' && window.__NANODIGEST__) || {}

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

/** True when the page is served by the WordPress theme. */
export const servedByWordPress = Boolean(text(raw.restUrl))

export const runtimeRestUrl = text(raw.restUrl).replace(/\/+$/, '')

/**
 * Prefix for client-side routes. WordPress tells us where the site lives; the
 * static builds use Vite's base ('/' or '/nanodigest-redesign/').
 */
export const routerBasePath = servedByWordPress
  ? text(raw.basePath).replace(/\/+$/, '')
  : import.meta.env.BASE_URL.replace(/\/+$/, '').replace(/^\.$/, '')

export const accountUrl = text(raw.accountUrl) || 'https://nanodigest.in/my-account/'

export const externalCookieBanner = raw.externalCookieBanner === true

export const runtimeBank: BankDetails | null = (() => {
  const bank = raw.bank
  if (!bank || !text(bank.accountNumber) || !text(bank.ifsc)) return null
  return {
    accountName: text(bank.accountName),
    accountNumber: text(bank.accountNumber),
    ifsc: text(bank.ifsc),
    bankName: text(bank.bankName),
    branch: text(bank.branch),
    accountType: text(bank.accountType),
    upiId: text(bank.upiId),
  }
})()
