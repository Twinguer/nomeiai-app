export type GoogleAdsConversionEvent =
  | 'signup'
  | 'signup_confirm'
  | 'purchase'
  | 'view_planos';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export {};
