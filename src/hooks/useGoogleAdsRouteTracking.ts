import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { initAnalytics, trackAnalyticsPageView, trackConversion } from '@/lib/analytics';

/**
 * Inicializa GA4 + Google Ads e envia page_view a cada mudança de rota (SPA).
 */
export function useGoogleAdsRouteTracking(): void {
  const location = useLocation();
  const lastPathRef = useRef<string | null>(null);

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    const path = `${location.pathname}${location.search}`;
    if (lastPathRef.current === path) return;
    lastPathRef.current = path;

    trackAnalyticsPageView(path);

    if (location.pathname === '/planos') {
      trackConversion('view_planos');
    }
  }, [location.pathname, location.search]);
}
