import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useSubscription } from '@/modules/payments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Trophy, Users, BookOpen, Clock, CheckCircle, XCircle, Target } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { studyGroupMembersService } from '@/modules/community';
import { getInitials } from '@/lib/utils';
import { UserStudyService } from '@/services/userStudyService';
import { calculateStudyStatistics } from '@/utils/userStudyHelpers';
import {
  resolveStudySessions,
  resolveStudyStatistics,
} from '@/modules/statistics';

interface ProfileStatsColumnProps {
  userId: string;
  rankings?: any[];
  /** Perfil público: default false. Perfil próprio: omitir (true). */
  showStudyStats?: boolean;
  /** Perfil público: lista apenas grupos com privacy_level=public (sempre visíveis). */
  publicGroupsOnly?: boolean;
}

export const ProfileStatsColumn: React.FC<ProfileStatsColumnProps> = ({
  userId,
  rankings = [],
  showStudyStats = true,
  publicGroupsOnly = false,
}) => {
  const navigate = useNavigate();
  const { isPro } = useSubscription();

  // Buscar grupos do usuário
  const { data: userGroups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ['user-groups', userId, publicGroupsOnly ? 'public' : 'all'],
    queryFn: () =>
      publicGroupsOnly
        ? studyGroupMembersService.getUserPublicGroups(userId)
        : studyGroupMembersService.getUserGroups(userId),
    enabled: !!userId,
  });

  // Buscar estatísticas de estudos do usuário
  const { data: studyStats, isLoading: statsLoading } = useQuery({
    queryKey: ['user-study-stats', userId],
    queryFn: async () => {
      const userStudyData = await UserStudyService.getUserStudyData(userId);
      if (!userStudyData) {
        return {
          totalHours: 0,
          questionsAnswered: 0,
          correctAnswers: 0,
          wrongAnswers: 0,
          accuracy: 0,
        };
      }

      const sessions = resolveStudySessions(
        userStudyData.study_sessions,
        userStudyData.study_statistics
      );
      const resolved = resolveStudyStatistics(
        sessions,
        userStudyData.study_statistics
      );

      if (sessions.length > 0) {
        const calculatedStats = calculateStudyStatistics(sessions);
        const accuracy =
          calculatedStats.questionsAnswered > 0
            ? Math.round(
                (calculatedStats.correctAnswers / calculatedStats.questionsAnswered) *
                  100
              )
            : 0;

        return {
          totalHours: calculatedStats.totalHours,
          questionsAnswered: calculatedStats.questionsAnswered,
          correctAnswers: calculatedStats.correctAnswers,
          wrongAnswers: calculatedStats.wrongAnswers,
          accuracy,
        };
      }

      const accuracy =
        resolved.questionsAnswered > 0
          ? Math.round((resolved.correctAnswers / resolved.questionsAnswered) * 100)
          : 0;

      return {
        totalHours: resolved.totalHours,
        questionsAnswered: resolved.questionsAnswered,
        correctAnswers: resolved.correctAnswers,
        wrongAnswers: resolved.wrongAnswers,
        accuracy,
      };
    },
    enabled: !!userId && showStudyStats,
  });

  const groupsCount = userGroups?.length || 0;

  const formatHours = (hours: number) => {
    if (hours < 1) {
      return `${Math.round(hours * 60)}min`;
    }
    return `${hours.toFixed(1)}h`;
  };

  const handleViewGroup = (groupId: string) => {
    // ✅ Se for usuário free, redirecionar para planos
    if (!isPro) {
      navigate('/planos');
      return;
    }
    navigate(`/grupos/${groupId}`);
  };

  return (
    <div className="space-y-4">
      {showStudyStats ? (
      <Card className="rounded-xl border border-border bg-card text-card-foreground shadow-lg hover:shadow-2xl transition-shadow duration-300">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-blue-500" />
            Estatísticas de Estudos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {statsLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
          ) : (
            <>
              {/* Horas de Estudos */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium">Horas de Estudos</span>
                </div>
                <span className="text-lg font-bold">{formatHours(studyStats?.totalHours || 0)}</span>
              </div>

              {/* Questões Respondidas */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-purple-500" />
                  <span className="text-sm font-medium">Questões Respondidas</span>
                </div>
                <span className="text-lg font-bold">{studyStats?.questionsAnswered || 0}</span>
              </div>

              {/* Taxa de Acerto */}
              {studyStats && studyStats.questionsAnswered > 0 && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium">Taxa de Acerto</span>
                  </div>
                  <span className="text-lg font-bold">{studyStats.accuracy}%</span>
                </div>
              )}

              {/* Métricas de Questões */}
              {studyStats && studyStats.questionsAnswered > 0 && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="flex flex-col items-center p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                    <CheckCircle className="h-4 w-4 text-green-500 mb-1" />
                    <span className="text-xl font-bold text-green-600">{studyStats.correctAnswers}</span>
                    <span className="text-xs text-muted-foreground">Corretas</span>
                  </div>
                  <div className="flex flex-col items-center p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                    <XCircle className="h-4 w-4 text-red-500 mb-1" />
                    <span className="text-xl font-bold text-red-600">{studyStats.wrongAnswers}</span>
                    <span className="text-xs text-muted-foreground">Erradas</span>
                  </div>
                </div>
              )}

              {(!studyStats || studyStats.questionsAnswered === 0) && studyStats?.totalHours === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Nenhuma estatística de estudo ainda
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
      ) : null}

      {/* Grupos de Estudo */}
      <Card className="rounded-xl border border-border bg-card text-card-foreground shadow-lg hover:shadow-2xl transition-shadow duration-300">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-purple-500" />
            Grupos de Estudo ({groupsCount})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {groupsLoading ? (
            <p className="text-sm text-muted-foreground text-center">Carregando...</p>
          ) : userGroups && userGroups.length > 0 ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-2">
                {userGroups.slice(0, 4).map((group: any) => (
                  <div
                    key={group.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => handleViewGroup(group.id)}
                  >
                    <div className="flex-shrink-0">
                      {group.cover_image_url ? (
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={group.cover_image_url} alt={group.name} />
                          <AvatarFallback className="text-xs">
                            {getInitials(group.name)}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                          <BookOpen className="h-5 w-5 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{group.name}</p>
                      {group.members_count !== undefined && (
                        <p className="text-xs text-muted-foreground">
                          {group.members_count} membros
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {userGroups.length > 4 && (
                <Button
                  variant="link"
                  size="sm"
                  className="w-full"
                  onClick={() => navigate('/comunidade?tab=grupos')}
                >
                  Ver todos os grupos
                </Button>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center">
              Não participa de nenhum grupo ainda
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

