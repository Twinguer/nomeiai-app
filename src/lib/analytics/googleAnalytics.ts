import { devLog } from '@/utils/productionLogger';
import {
  ensureGtagConfigured,
  GA_MEASUREMENT_ID,
  shouldRunAnalyticsInDev,
} from './gtagCore';

/** Produção com ID configurado; em dev só se VITE_GA_ENABLE_DEV=true (ou VITE_GOOGLE_ADS_ENABLE_DEV). */
export function isGoogleAnalyticsEnabled(): boolean {
  if (!GA_MEASUREMENT_ID) return false;
  if (import.meta.env.DEV) return shouldRunAnalyticsInDev();
  return true;
}

export function getGoogleAnalyticsId(): string | undefined {
  return GA_MEASUREMENT_ID;
}

export function initGoogleAnalytics(): void {
  if (!isGoogleAnalyticsEnabled()) return;
  ensureGtagConfigured({ ga: true, ads: false });
}

export function trackGaPageView(pagePath: string, pageTitle?: string): void {
  if (!isGoogleAnalyticsEnabled() || typeof window.gtag !== 'function' || !GA_MEASUREMENT_ID) {
    return;
  }

  ensureGtagConfigured({ ga: true, ads: false });

  window.gtag('config', GA_MEASUREMENT_ID, {
    page_path: pagePath,
    page_title: pageTitle ?? document.title,
  });

  if (import.meta.env.DEV) {
    devLog.log('[googleAnalytics] page_view', pagePath);
  }
}
