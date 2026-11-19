import { devLog } from '@/utils/productionLogger';
import type { GoogleAdsConversionEvent } from './types';
import {
  ensureGtagConfigured,
  GOOGLE_ADS_ID,
  shouldRunAnalyticsInDev,
} from './gtagCore';

const CONVERSION_ENV_MAP: Record<GoogleAdsConversionEvent, string | undefined> = {
  signup: import.meta.env.VITE_GOOGLE_ADS_CONVERSION_SIGNUP,
  signup_confirm: import.meta.env.VITE_GOOGLE_ADS_CONVERSION_SIGNUP_CONFIRM,
  purchase: import.meta.env.VITE_GOOGLE_ADS_CONVERSION_PURCHASE,
  view_planos: import.meta.env.VITE_GOOGLE_ADS_CONVERSION_VIEW_PLANOS,
};

/** Produção com ID configurado; em dev só se VITE_GOOGLE_ADS_ENABLE_DEV=true (ou VITE_GA_ENABLE_DEV). */
export function isGoogleAdsEnabled(): boolean {
  if (!GOOGLE_ADS_ID) return false;
  if (import.meta.env.DEV) return shouldRunAnalyticsInDev();
  return true;
}

export function getGoogleAdsId(): string | undefined {
  return GOOGLE_ADS_ID;
}

export function initGoogleAds(): void {
  if (!isGoogleAdsEnabled()) return;
  ensureGtagConfigured({ ga: false, ads: true });
}

export function trackAdsPageView(pagePath: string, pageTitle?: string): void {
  if (!isGoogleAdsEnabled() || typeof window.gtag !== 'function' || !GOOGLE_ADS_ID) {
    return;
  }

  ensureGtagConfigured({ ga: false, ads: true });

  window.gtag('config', GOOGLE_ADS_ID, {
    page_path: pagePath,
    page_title: pageTitle ?? document.title,
  });
}

/**
 * Dispara conversão no Google Ads. Requer send_to no .env
 * (ex.: AW-18180561896/AbCdEfGh criado em Ferramentas → Conversões).
 */
export function trackConversion(
  event: GoogleAdsConversionEvent,
  options?: { value?: number; currency?: string }
): void {
  const sendTo = CONVERSION_ENV_MAP[event]?.trim();
  if (!sendTo) {
    if (import.meta.env.DEV) {
      devLog.log('[googleAds] conversão ignorada (send_to não configurado):', event);
    }
    return;
  }

  if (!isGoogleAdsEnabled() || typeof window.gtag !== 'function') return;

  ensureGtagConfigured({ ga: false, ads: true });

  window.gtag('event', 'conversion', {
    send_to: sendTo,
    value: options?.value ?? 1.0,
    currency: options?.currency ?? 'BRL',
  });

  if (import.meta.env.DEV) {
    devLog.log('[googleAds] conversion', event, sendTo);
  }
}

/** @deprecated Use trackAnalyticsPageView — mantido por compatibilidade. */
export function trackPageView(pagePath: string, pageTitle?: string): void {
  trackAdsPageView(pagePath, pageTitle);
}
