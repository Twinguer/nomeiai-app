import React from 'react';
import { Sparkles } from 'lucide-react';
import { isLaunchProPromoActive, LAUNCH_PROMO_COPY } from '../domain/launchPromo';

interface LaunchPromoBannerProps {
  className?: string;
  compact?: boolean;
}

export const LaunchPromoBanner: React.FC<LaunchPromoBannerProps> = ({
  className = '',
  compact = false,
}) => {
  if (!isLaunchProPromoActive()) {
    return null;
  }

  if (compact) {
    return (
      <p className={`text-sm text-emerald-950 dark:text-emerald-100 ${className}`}>
        <Sparkles className="inline h-4 w-4 mr-1 -mt-0.5 text-emerald-700 dark:text-emerald-300" />
        {LAUNCH_PROMO_COPY.bannerCompact}
      </p>
    );
  }

  return (
    <div
      className={`rounded-xl border border-emerald-600/30 bg-emerald-50 px-4 py-3 text-center dark:border-emerald-500/30 dark:bg-emerald-950/40 ${className}`}
    >
      <p className="text-sm font-medium text-emerald-950 dark:text-emerald-100 flex items-center justify-center gap-2 flex-wrap">
        <Sparkles className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
        <span className="text-emerald-950 dark:text-emerald-100">
          Promo de lançamento: cadastre-se e use o{' '}
          <strong className="font-semibold text-emerald-950 dark:text-white">
            Aluno Pro completo grátis
          </strong>{' '}
          {LAUNCH_PROMO_COPY.durationLabel.toLowerCase()}. Depois, o plano gratuito continua
          disponível.
        </span>
      </p>
    </div>
  );
};
