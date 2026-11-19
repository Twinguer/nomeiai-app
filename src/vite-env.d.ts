/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GA_MEASUREMENT_ID?: string;
  readonly VITE_GA_ENABLE_DEV?: string;
  readonly VITE_GOOGLE_ADS_ID?: string;
  readonly VITE_GOOGLE_ADS_CONVERSION_SIGNUP?: string;
  readonly VITE_GOOGLE_ADS_CONVERSION_SIGNUP_CONFIRM?: string;
  readonly VITE_GOOGLE_ADS_CONVERSION_PURCHASE?: string;
  readonly VITE_GOOGLE_ADS_CONVERSION_VIEW_PLANOS?: string;
  readonly VITE_GOOGLE_ADS_ENABLE_DEV?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
