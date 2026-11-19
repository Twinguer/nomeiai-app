import { useGoogleAdsRouteTracking } from '@/hooks/useGoogleAdsRouteTracking';

/** Deve ficar dentro de BrowserRouter. */
export function GoogleAdsRouteTracker() {
  useGoogleAdsRouteTracking();
  return null;
}
