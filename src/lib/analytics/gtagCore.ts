import { devLog } from '@/utils/productionLogger';

export const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();
export const GOOGLE_ADS_ID = import.meta.env.VITE_GOOGLE_ADS_ID?.trim();

let scriptInjected = false;
let gtagBootstrapped = false;
let gaConfigured = false;
let adsConfigured = false;

export function isDevAnalyticsEnabled(): boolean {
  return (
    import.meta.env.VITE_GA_ENABLE_DEV === 'true' ||
    import.meta.env.VITE_GOOGLE_ADS_ENABLE_DEV === 'true'
  );
}

export function shouldRunAnalyticsInDev(): boolean {
  return import.meta.env.DEV && isDevAnalyticsEnabled();
}

function getPrimaryGtagScriptId(): string | undefined {
  // Prioriza AW-: tag do Google Ads carrega na CDN; G- inválido (404) quebrava todo o gtag.
  return GOOGLE_ADS_ID || GA_MEASUREMENT_ID;
}

function bootstrapGtag(): void {
  if (gtagBootstrapped || typeof window === 'undefined') return;

  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer?.push(args);
  };
  window.gtag('js', new Date());
  gtagBootstrapped = true;
}

function injectGtagScript(): void {
  if (scriptInjected || typeof document === 'undefined') return;

  const scriptId = getPrimaryGtagScriptId();
  if (!scriptId) return;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(scriptId)}`;
  document.head.appendChild(script);
  scriptInjected = true;
}

/** Inicializa gtag.js uma vez e registra GA4 e/ou Google Ads (send_page_view manual — SPA). */
export function ensureGtagConfigured(options: { ga?: boolean; ads?: boolean }): void {
  if (typeof window === 'undefined') return;

  const wantsGa = options.ga === true && !!GA_MEASUREMENT_ID && !gaConfigured;
  const wantsAds = options.ads === true && !!GOOGLE_ADS_ID && !adsConfigured;
  if (!wantsGa && !wantsAds) return;

  bootstrapGtag();
  injectGtagScript();

  if (wantsGa && typeof window.gtag === 'function') {
    window.gtag('config', GA_MEASUREMENT_ID!, { send_page_view: false });
    gaConfigured = true;
  }

  if (wantsAds && typeof window.gtag === 'function') {
    window.gtag('config', GOOGLE_ADS_ID!, { send_page_view: false });
    adsConfigured = true;
  }

  if (import.meta.env.DEV && (wantsGa || wantsAds)) {
    devLog.log('[gtag] configurado', {
      ga: wantsGa ? GA_MEASUREMENT_ID : undefined,
      ads: wantsAds ? GOOGLE_ADS_ID : undefined,
    });
  }
}
