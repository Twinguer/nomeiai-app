import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { OnlineIndicator } from '@/components/profile/OnlineIndicator';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { getAvatarUrl } from '@/utils/avatarUtils';
import { usesCommunityCoachCardFormat } from '../../domain/communityProfileRules';
import { cn } from '@/lib/utils';
import { communityCoachCardTheme } from './communityCoachCardTheme';

export interface CommunityUserProfile {
  id: string;
  name: string;
  avatar_url: string | null;
  isCoach?: boolean;
  isPro?: boolean;
  hasActiveCoach?: boolean;
  activeStudentCount?: number;
}

interface UserCardProps {
  userProfile: CommunityUserProfile;
  onClick?: (userId: string) => void;
}

const statusBadgeBase =
  'rounded-md border px-2 py-0.5 text-[11px] font-medium shadow-none hover:bg-transparent';

type StatusTone = 'coach' | 'mentor' | 'pro' | 'neutral';

function CommunityStatusBadge({ label, tone = 'neutral' }: { label: string; tone?: StatusTone }) {
  const toneClass: Record<StatusTone, string> = {
    coach: communityCoachCardTheme.badgeClass,
    mentor: 'border-border bg-muted/50 text-foreground/85',
    pro: 'border-border bg-muted/40 text-muted-foreground',
    neutral: 'border-border/80 bg-background text-muted-foreground',
  };

  return (
    <Badge variant="outline" className={cn(statusBadgeBase, toneClass[tone])}>
      {label}
    </Badge>
  );
}

function CommunityCardFooter({ user }: { user: CommunityUserProfile }) {
  if (usesCommunityCoachCardFormat({ is_coach: user.isCoach })) {
    const count = user.activeStudentCount ?? 0;
    if (count >= 1) {
      return (
        <div className="flex items-baseline justify-center gap-1.5">
          <span className={communityCoachCardTheme.studentCountClass}>{count}</span>
          <span className="text-[11px] text-muted-foreground">Alunos</span>
        </div>
      );
    }
    return <CommunityStatusBadge label="Novo" tone="coach" />;
  }

  if (user.hasActiveCoach) {
    return <CommunityStatusBadge label="Mentorado" tone="mentor" />;
  }

  if (user.isPro) {
    return <CommunityStatusBadge label="Pro" tone="pro" />;
  }

  return null;
}

export const UserCard: React.FC<UserCardProps> = ({ userProfile, onClick }) => {
  const [avatarError, setAvatarError] = useState(false);
  if (!userProfile) {
    return null;
  }

  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const avatarUrl = avatarError ? getAvatarUrl(null) : getAvatarUrl(userProfile.avatar_url);

  const handleCardClick = () => {
    if (onClick) {
      onClick(userProfile.id);
    }
  };

  const footer = <CommunityCardFooter user={userProfile} />;
  const isCoachCard = usesCommunityCoachCardFormat({ is_coach: userProfile.isCoach });

  return (
    <Card
      className={cn(
        'cursor-pointer h-full flex flex-col transition-all duration-200',
        isCoachCard
          ? communityCoachCardTheme.surfaceClass
          : 'bg-card border-border hover:shadow-md hover:border-border/80'
      )}
      style={isCoachCard ? communityCoachCardTheme.elevatedShadowStyle : undefined}
      onClick={handleCardClick}
    >
      <CardContent className="p-5 flex flex-col flex-1">
        <div className="flex flex-col items-center flex-shrink-0">
          <div className="relative mb-3">
            <Avatar
              className={cn('h-20 w-20', isCoachCard && communityCoachCardTheme.avatarBorderClass)}
              style={communityCoachCardTheme.avatarShadowStyle}
            >
              <AvatarImage
                src={avatarUrl}
                alt={userProfile.name}
                onError={() => setAvatarError(true)}
              />
              <AvatarFallback
                className={cn(
                  'text-lg',
                  isCoachCard && communityCoachCardTheme.avatarFallbackClass
                )}
              >
                {getInitials(userProfile.name)}
              </AvatarFallback>
            </Avatar>
            <OnlineIndicator userId={userProfile.id} />
          </div>

          <h3 className="font-semibold text-base text-center leading-tight min-h-[2.5rem] flex items-center justify-center text-balance">
            {userProfile.name?.trim() || 'Usuário'}
          </h3>

          {isCoachCard && (
            <div className="mt-1.5 flex items-center justify-center">
              <CommunityStatusBadge label="Coach" tone="coach" />
            </div>
          )}
        </div>

        <div
          className={cn(
            'border-t py-3 mt-4 flex-shrink-0 min-h-[3.25rem] flex items-center justify-center',
            isCoachCard ? communityCoachCardTheme.footerDividerClass : 'border-border/60'
          )}
        >
          {footer}
        </div>
      </CardContent>
    </Card>
  );
};
