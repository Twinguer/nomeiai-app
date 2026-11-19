import { initGoogleAds, trackAdsPageView } from './googleAds';
import { initGoogleAnalytics, trackGaPageView } from './googleAnalytics';

export {
  getGoogleAdsId,
  initGoogleAds,
  isGoogleAdsEnabled,
  trackAdsPageView,
  trackConversion,
  trackPageView,
} from './googleAds';
export {
  getGoogleAnalyticsId,
  initGoogleAnalytics,
  isGoogleAnalyticsEnabled,
  trackGaPageView,
} from './googleAnalytics';
export type { GoogleAdsConversionEvent } from './types';

/** Inicializa GA4 e Google Ads (gtag compartilhado). Ads primeiro: define a URL do script (AW-). */
export function initAnalytics(): void {
  initGoogleAds();
  initGoogleAnalytics();
}

/** Envia page_view manual para GA4 e Google Ads (SPA). */
export function trackAnalyticsPageView(pagePath: string, pageTitle?: string): void {
  trackGaPageView(pagePath, pageTitle);
  trackAdsPageView(pagePath, pageTitle);
}
