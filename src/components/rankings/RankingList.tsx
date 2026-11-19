
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import { Calendar, Trophy, Users, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { UrlObfuscationService } from '@/services/urlObfuscation';
import { devLog } from '@/utils/productionLogger';
import { openSecureRankingWithFallback } from '@/modules/rankings';

export interface RankingItemProps {
  id: string;
  examDate: string;
  banca: string;
  concursoTitle: string;
  cargoTitle: string;
  participantCount: number;
  createdByUserId?: string;
  creatorName?: string;
  isAdminCreated?: boolean;
  status?: string;
  localidade?: string;
  isGeneralCard?: boolean;
  watermarkImageUrl?: string | null;
}

export interface RankingListProps {
  rankings: RankingItemProps[];
  isLoading: boolean;
  onRankingClick?: (e: React.MouseEvent, rankingId: string) => void;
}

export const RankingItem: React.FC<RankingItemProps & { onRankingClick?: (e: React.MouseEvent, rankingId: string) => void }> = ({
  id,
  examDate,
  banca,
  concursoTitle,
  cargoTitle,
  participantCount,
  creatorName,
  isAdminCreated,
  status,
  localidade,
  isGeneralCard,
  watermarkImageUrl,
  onRankingClick
}) => {
  const navigate = useNavigate();
  const getStatusColor = (status?: string) => {
    if (!status || status === 'Em andamento') {
      return 'bg-primary/10 hover:bg-primary/20 text-primary';
    }
    return '';
  };
  
  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    onRankingClick?.(e, id);
    
    try {
      // Se for card geral, navegar para página de cargos; senão, para ranking normal
      if (isGeneralCard) {
        const secureUrl = await UrlObfuscationService.generateSecureCargosUrl(id);
        navigate(secureUrl);
      } else {
        const secureUrl = await UrlObfuscationService.generateSecureRankingUrl(id);
        navigate(secureUrl);
      }
    } catch (error: any) {
      devLog.error('Erro ao gerar URL segura:', error);
      if (isGeneralCard) {
        navigate(`/pre-classificacao/${id}/cargos`);
        return;
      }
      await openSecureRankingWithFallback(navigate, id);
    }
  };

  return (
    <div className="block h-full cursor-pointer" onClick={handleClick}>
      <Card className="hover:shadow-lg transition-all duration-300 bg-card hover:translate-y-[-4px] h-full cursor-pointer relative flex flex-col">
        {watermarkImageUrl && (
          <div 
            className="absolute inset-0 pointer-events-none opacity-10 z-0"
            style={{
              backgroundImage: `url(${watermarkImageUrl})`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center',
              backgroundSize: 'cover'
            }}
          />
        )}
        <CardContent className="p-6 h-full flex flex-col relative z-10">
          <div className="space-y-3 flex-1 flex flex-col">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="bg-blue-50 text-blue-600 border-0 font-medium text-xs px-2 py-0.5">
                  {banca}
                </Badge>
              </div>
              
              <div className="flex flex-col gap-1 items-end">
                <Badge variant="outline" className={`text-xs font-medium border-0 ${getStatusColor(status)}`}>
                  {status || 'Em andamento'}
                </Badge>
                {examDate && (
                  <div className="flex items-center text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3 mr-1" />
                    {formatDate(examDate)}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex-1">
              <h3 className="text-base font-bold leading-tight text-foreground mb-1 line-clamp-2">
                {concursoTitle}
              </h3>
              {!isGeneralCard && (
                <p className="text-sm text-primary font-semibold mb-2 break-words line-clamp-2">
                  {cargoTitle}
                </p>
              )}
              
              {localidade && (
                <div className="flex items-center text-xs text-muted-foreground mb-2">
                  <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
                  <span className="truncate">{localidade}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4 text-primary flex-shrink-0" />
                <p className="text-sm font-medium text-primary whitespace-nowrap">
                  {(participantCount || 0).toLocaleString()} participantes
                </p>
              </div>
              
              <div className="flex items-center gap-2 text-sm font-medium text-primary whitespace-nowrap">
                <Trophy className="h-4 w-4 flex-shrink-0" />
                Ver Ranking
              </div>
            </div>
            
            {(creatorName || isAdminCreated) && (
              <div className="flex items-center text-xs text-muted-foreground pt-1">
                <span className="truncate text-xs">
                  Criado por: {isAdminCreated ? 'Admin' : creatorName}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export const RankingList: React.FC<RankingListProps> = ({
  rankings,
  isLoading,
  onRankingClick
}) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ gridAutoRows: '1fr' }}>
        {[1, 2, 3, 4, 5, 6].map(i => (
          <Card key={i} className="animate-pulse h-full">
            <CardContent className="p-6 h-full flex flex-col">
              <div className="h-6 bg-muted rounded w-1/3 mb-4"></div>
              <div className="h-5 bg-muted rounded w-1/2 mb-2"></div>
              <div className="h-6 bg-muted rounded w-3/4 mb-4 flex-1"></div>
              <div className="h-4 bg-muted rounded w-1/4 mt-3"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }
  
  if (rankings.length === 0) {
    return (
      <Card className="border-dashed border-2">
        <CardContent className="p-8 text-center">
          <Trophy className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-lg font-medium text-muted-foreground">Nenhum ranking disponível no momento.</p>
          <p className="text-sm text-muted-foreground mt-1">Novos rankings serão adicionados em breve.</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ gridAutoRows: '1fr' }}>
      {rankings.map(ranking => <RankingItem key={ranking.id} {...ranking} onRankingClick={onRankingClick} />)}
    </div>
  );
};
