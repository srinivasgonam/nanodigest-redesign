/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WORDPRESS_URL?: string
  readonly VITE_FORMS_API_URL?: string
  readonly VITE_CONTENT_API_URL?: string
  readonly VITE_ADSENSE_CLIENT?: string
  readonly VITE_ADSENSE_SLOT_LEADERBOARD?: string
  readonly VITE_ADSENSE_SLOT_IN_ARTICLE?: string
  readonly VITE_ADSENSE_SLOT_SIDEBAR?: string
  readonly VITE_SHOW_AD_PLACEHOLDERS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
