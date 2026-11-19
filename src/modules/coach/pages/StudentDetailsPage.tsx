import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert } from '@/components/ui/alert';
import { AlertCircle, ArrowLeft, Clock, CheckCircle, BookOpen, TrendingUp, Plus, Calendar, Trash2, MessageSquare } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { resolveUserStudyStatisticsFromData, resolveStudySessions, PerformanceChart } from '@/modules/statistics';
import { formatLocalDatePtBr } from '@/utils/dateFormat';
import { devLog } from '@/utils/productionLogger';
import { UserUrlObfuscationService } from '@/services/userUrlObfuscation';
import {
  coachAccessService,
  useCoachStudentDetails,
  useCoachStudentGate,
} from '@/modules/coach';

// ✅ REMOVIDO: isValidUUID - não aceitar UUIDs diretamente por segurança

const StudentDetailsPage = () => {
  const { studentId: studentIdParam } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [timeFilter, setTimeFilter] = useState<'day' | 'week' | 'month'>('week');

  const queryClient = useQueryClient();

  const {
    validatedStudentId,
    isValidatingToken,
    hasAccess,
    isCheckingAccess,
    accessDeniedMessage,
  } = useCoachStudentGate({ studentIdParam });

  const {
    student,
    fullStatistics,
    isLoadingStudent,
    isLoadingStatistics,
  } = useCoachStudentDetails({
    coachId: user?.id,
    validatedStudentId,
    hasAccess,
  });

  const isLoading = isCheckingAccess || (hasAccess && isLoadingStudent);
  const loadingStats = isLoadingStatistics;

  // Mutation para enviar mensagem ao aluno (deve estar antes de qualquer return condicional)
  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      if (!validatedStudentId || !user?.id) {
        throw new Error('Dados insuficientes para enviar mensagem');
      }

      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: validatedStudentId,
          type: 'coach_message',
          title: 'Mensagem do Coach',
          message: message.trim(),
          metadata: {
            coach_id: user.id,
            sent_at: new Date().toISOString()
          }
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', validatedStudentId] });
      toast({
        title: 'Mensagem enviada',
        description: 'A mensagem foi enviada com sucesso ao aluno.',
      });
      setMessageModalOpen(false);
      setMessageText('');
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao enviar mensagem',
        description: error.message || 'Não foi possível enviar a mensagem.',
        variant: 'destructive',
      });
    },
  });

  useEffect(() => {
    if (
      !isValidatingToken &&
      validatedStudentId &&
      !isCheckingAccess &&
      !hasAccess
    ) {
      toast({
        title: 'Acesso negado',
        description: accessDeniedMessage,
        variant: 'destructive',
      });
      navigate('/coach/dashboard');
    }
  }, [
    hasAccess,
    isCheckingAccess,
    isValidatingToken,
    validatedStudentId,
    accessDeniedMessage,
    navigate,
    toast,
  ]);

  useEffect(() => {
    if (hasAccess && student === null && !isLoadingStudent && !isCheckingAccess && validatedStudentId) {
      toast({
        title: 'Aluno não encontrado',
        description: 'Não foi possível carregar os dados deste aluno.',
        variant: 'destructive',
      });
      navigate('/coach/dashboard');
    }
  }, [student, hasAccess, isLoadingStudent, isCheckingAccess, validatedStudentId, navigate, toast]);

  // Se estiver validando token, mostrar loading
  if (isValidatingToken || !validatedStudentId) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <p>Validando acesso...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading || !hasAccess) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <p>{!hasAccess && !isCheckingAccess ? 'Acesso negado.' : 'Carregando dados do aluno...'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <p>Aluno não encontrado ou você não tem acesso</p>
        </Alert>
      </div>
    );
  }

  // Calcular estatísticas reais a partir dos dados de estudo do aluno
  const calculatePerformance = () => {
    if (!student.studyData) {
      return {
        hours_this_week: 0,
        hours_last_week: 0,
        sessions_this_week: 0,
        tasks_completed: 0,
        tasks_pending: 0,
        completion_rate: 0,
        engagement_score: 0
      };
    }

    // Tentar usar study_statistics primeiro
    const statistics = student.studyData.study_statistics;
    if (statistics && typeof statistics === 'object' && Object.keys(statistics).length > 0) {
      // Extrair dados das statistics
      const totalHours = (statistics as any).totalHours || 0;
      const totalSessions = (statistics as any).totalSessions || 0;
      
      return {
        hours_this_week: totalHours,
        hours_last_week: totalHours * 0.8, // Aproximação
        sessions_this_week: totalSessions,
        sessions_last_week: Math.floor(totalSessions * 0.8),
        tasks_completed: 0,
        tasks_pending: 0,
        completion_rate: totalSessions > 0 ? 80 : 0,
        engagement_score: Math.min(10, (totalHours / 2))
      };
    }

    // NOVO: Buscar estatísticas de study_schedule
    const scheduleSessions = student.studyData.study_schedule || [];
    if (scheduleSessions.length > 0) {
      let totalHours = 0;
      let totalSessions = 0;
      let totalQuestions = 0;
      let totalCorrect = 0;
      
      scheduleSessions.forEach((s: any) => {
        const stats = s.total_stats || {};
        if (stats.session_count > 0) {
          totalHours += (stats.total_duration_minutes || 0) / 60;
          totalSessions += stats.session_count || 0;
          totalQuestions += stats.total_questions || 0;
          totalCorrect += stats.total_correct || 0;
        }
      });
      
      if (totalSessions > 0) {
        return {
          hours_this_week: totalHours,
          hours_last_week: totalHours * 0.8,
          sessions_this_week: totalSessions,
          sessions_last_week: Math.floor(totalSessions * 0.8),
          tasks_completed: totalQuestions,
          tasks_pending: 0,
          completion_rate: 75,
          engagement_score: Math.min(10, totalHours / 2)
        };
      }
    }

    // Fallback: usar study_sessions
    const sessions = resolveStudySessions(
      student.studyData.study_sessions,
      student.studyData.study_statistics
    );
    
    if (sessions.length === 0) {
      return {
        hours_this_week: 0,
        hours_last_week: 0,
        sessions_this_week: 0,
        tasks_completed: 0,
        tasks_pending: 0,
        completion_rate: 0,
        engagement_score: 0
      };
    }

    const stats = resolveUserStudyStatisticsFromData(student.studyData);
    
    // Calcular período desta semana e semana passada
    const now = new Date();
    const startOfThisWeek = new Date(now);
    startOfThisWeek.setDate(now.getDate() - now.getDay()); // Domingo desta semana
    startOfThisWeek.setHours(0, 0, 0, 0);
    
    const startOfLastWeek = new Date(startOfThisWeek);
    startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);
    const endOfLastWeek = new Date(startOfThisWeek);
    endOfLastWeek.setMilliseconds(endOfLastWeek.getMilliseconds() - 1);
    
    // Normalizar campo de data da sessão
    const getSessionDate = (s: any) => {
      return s.sessionDate || s.session_date || s.date || new Date().toISOString().split('T')[0];
    };
    
    const thisWeekSessions = sessions.filter(s => {
      const sessionDate = new Date(getSessionDate(s));
      return sessionDate >= startOfThisWeek;
    });
    
    const lastWeekSessions = sessions.filter(s => {
      const sessionDate = new Date(getSessionDate(s));
      return sessionDate >= startOfLastWeek && sessionDate < startOfThisWeek;
    });
    
    // Normalizar duration - aceitar tanto duration quanto total_duration_minutes
    const getDuration = (s: any) => s.duration ?? s.total_duration_minutes ?? 0;
    
    const hoursThisWeek = thisWeekSessions.reduce((sum, s) => sum + (getDuration(s) / 60), 0);
    const hoursLastWeek = lastWeekSessions.reduce((sum, s) => sum + (getDuration(s) / 60), 0);
    
    return {
      hours_this_week: hoursThisWeek,
      hours_last_week: hoursLastWeek,
      sessions_this_week: thisWeekSessions.length,
      sessions_last_week: lastWeekSessions.length,
      tasks_completed: 0, // Não disponível em study_sessions
      tasks_pending: 0, // Não disponível em study_sessions
      completion_rate: sessions.length > 0 ? (thisWeekSessions.length / sessions.length) : 0,
      engagement_score: sessions.length > 0 ? Math.min(10, (hoursThisWeek / 20) * 10) : 0 // Baseado em 20h semanal = score 10
    };
  };

  const performance = calculatePerformance();

  const handleSendMessage = () => {
    const trimmedMessage = messageText.trim();
    
    if (!trimmedMessage) {
      toast({
        title: 'Mensagem vazia',
        description: 'Por favor, digite uma mensagem antes de enviar.',
        variant: 'destructive',
      });
      return;
    }

    if (trimmedMessage.length > 600) {
      toast({
        title: 'Mensagem muito longa',
        description: 'A mensagem deve ter no máximo 600 caracteres.',
        variant: 'destructive',
      });
      return;
    }

    sendMessageMutation.mutate(trimmedMessage);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-purple-100/50 dark:from-purple-950/20 dark:to-purple-900/10">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/coach/dashboard')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">Detalhes do Aluno</h1>
            <p className="text-muted-foreground">
              {student.student_name}
            </p>
          </div>
          <Badge variant={student.status === 'active' ? 'default' : 'secondary'}>
            {student.status === 'active' ? 'Ativo' : 'Inativo'}
          </Badge>
        </div>

        {/* Tabs: Estudos e Estatísticas */}
        <Tabs defaultValue="study" className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <Button 
              onClick={async () => {
                if (!validatedStudentId) return;
                try {
                  const studentToken = await UserUrlObfuscationService.generateUserToken(validatedStudentId);
                  navigate(`/coach/student/${studentToken}/create-cycle`);
                } catch (error) {
                  devLog.error('Erro ao gerar URL segura:', error);
                  toast({
                    title: 'Erro',
                    description: 'Não foi possível gerar URL segura. Tente novamente.',
                    variant: 'destructive'
                  });
                }
              }}
              size="sm"
              className="bg-purple-600 hover:bg-purple-700 text-white dark:bg-purple-500 dark:hover:bg-purple-600 md:order-2"
            >
              <Plus className="mr-2 h-4 w-4" />
              Criar Ciclo para Aluno
            </Button>
            <TabsList className="bg-purple-100 dark:bg-purple-900/30 md:order-1">
              <TabsTrigger value="study" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md">
                <BookOpen className="mr-2 h-4 w-4" />
                Módulo de Estudos
              </TabsTrigger>
              <TabsTrigger value="statistics" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md">
                <TrendingUp className="mr-2 h-4 w-4" />
                Estatísticas
              </TabsTrigger>
            </TabsList>
          </div>

        {/* Aba: Módulo de Estudos (Read-Only) */}
        <TabsContent value="study">
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Atividade de Estudos</CardTitle>
                </div>
                <Button
                  onClick={() => setMessageModalOpen(true)}
                  variant="outline"
                  size="sm"
                  className="border-purple-500 text-purple-600 hover:bg-purple-50 hover:border-purple-600 dark:border-purple-400 dark:text-purple-400 dark:hover:bg-purple-900/30"
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Deixar mensagem
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Ciclos Ativos */}
              <div>
                <h3 className="font-semibold mb-2">Ciclos Ativos</h3>
                {student.studyData?.study_cycles?.filter((c: any) => c.is_active).length > 0 ? (
                  <div className="space-y-2">
                    {student.studyData.study_cycles
                      .filter((cycle: any) => cycle.is_active)
                      .map((cycle: any) => (
                        <Card key={cycle.id} className="p-3">
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div className="flex-1">
                              <p className="font-medium">{cycle.cycle_name}</p>
                              <p className="text-sm text-muted-foreground">
                                Prova: {new Date(cycle.exam_date).toLocaleDateString('pt-BR')}
                              </p>
                            </div>
                            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={async () => {
                                  try {
                                    const { UserUrlObfuscationService } = await import('@/services/userUrlObfuscation');
                                    if (!validatedStudentId || !user?.id) return;
                                    const [studentToken, cycleToken] = await Promise.all([
                                      UserUrlObfuscationService.generateUserToken(validatedStudentId),
                                      coachAccessService.generateStudyCycleToken(
                                        user.id,
                                        validatedStudentId,
                                        cycle.id
                                      ),
                                    ]);
                                    navigate(
                                      `/coach/student/${studentToken}/cycle/${cycleToken}/disciplinas`
                                    );
                                  } catch (error) {
                                    devLog.error('Erro ao gerar URL segura:', error);
                                    toast({
                                      title: 'Erro',
                                      description: 'Não foi possível gerar URL segura. Tente novamente.',
                                      variant: 'destructive',
                                    });
                                  }
                                }}
                                className="border-purple-500 text-purple-600 hover:bg-purple-50 hover:border-purple-600 dark:border-purple-400 dark:text-purple-400 dark:hover:bg-purple-900/30"
                              >
                                <BookOpen className="mr-2 h-4 w-4" />
                                Disciplinas
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={async () => {
                                  try {
                                    const { UserUrlObfuscationService } = await import('@/services/userUrlObfuscation');
                                    if (!validatedStudentId || !user?.id) return;
                                    const [studentToken, cycleToken] = await Promise.all([
                                      UserUrlObfuscationService.generateUserToken(validatedStudentId),
                                      coachAccessService.generateStudyCycleToken(
                                        user.id,
                                        validatedStudentId,
                                        cycle.id
                                      ),
                                    ]);
                                    navigate(
                                      `/coach/student/${studentToken}/cycle/${cycleToken}/schedule`
                                    );
                                  } catch (error) {
                                    devLog.error('Erro ao gerar URL segura:', error);
                                    toast({
                                      title: 'Erro',
                                      description: 'Não foi possível gerar URL segura. Tente novamente.',
                                      variant: 'destructive',
                                    });
                                  }
                                }}
                                className="border-purple-500 text-purple-600 hover:bg-purple-50 hover:border-purple-600 dark:border-purple-400 dark:text-purple-400 dark:hover:bg-purple-900/30"
                              >
                                <Calendar className="mr-2 h-4 w-4" />
                                Cronograma
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={async () => {
                                  if (!confirm('Deseja realmente remover este ciclo? Esta ação não pode ser desfeita.')) {
                                    return;
                                  }

                                  if (!validatedStudentId) {
                                    toast({
                                      title: 'Erro',
                                      description: 'ID do aluno não encontrado.',
                                      variant: 'destructive'
                                    });
                                    return;
                                  }

                                  try {
                                    const success = await UserStudyService.removeCycle(validatedStudentId, cycle.id);
                                    
                                    if (success) {
                                      // Invalidar queries para atualizar a lista
                                      queryClient.invalidateQueries({ queryKey: ['coach-student', user?.id, validatedStudentId] });
                                      queryClient.invalidateQueries({ queryKey: ['coach-student-statistics', validatedStudentId] });
                                      
                                      toast({
                                        title: 'Ciclo removido',
                                        description: 'O ciclo de estudo foi removido com sucesso.',
                                      });
                                    } else {
                                      toast({
                                        title: 'Erro',
                                        description: 'Não foi possível remover o ciclo. Tente novamente.',
                                        variant: 'destructive'
                                      });
                                    }
                                  } catch (error) {
                                    devLog.error('Erro ao remover ciclo:', error);
                                    toast({
                                      title: 'Erro',
                                      description: 'Ocorreu um erro ao remover o ciclo. Tente novamente.',
                                      variant: 'destructive'
                                    });
                                  }
                                }}
                                className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Remover
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhum ciclo de estudo ativo
                  </p>
                )}
              </div>

              {/* Última atividade */}
              {student.last_activity && (
                <div>
                  <p className="text-sm text-muted-foreground">
                    Última atividade: {formatLocalDatePtBr(student.last_activity)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba: Estatísticas (Read-Only) */}
        <TabsContent value="statistics">
          {loadingStats ? (
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader>
                <CardTitle>Estatísticas Gerais</CardTitle>
                <CardDescription>Carregando estatísticas...</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Carregando dados...</p>
                </div>
              </CardContent>
            </Card>
          ) : !fullStatistics || fullStatistics.totalHours === 0 ? (
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader>
                <CardTitle>Estatísticas Gerais</CardTitle>
                <CardDescription>Nenhuma estatística disponível</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <p className="text-muted-foreground">O aluno ainda não tem estatísticas registradas</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Card com estatísticas gerais */}
              <Card className="bg-primary/5 border-primary/20">
                <CardHeader>
                  <CardTitle>Estatísticas Gerais</CardTitle>
                  <CardDescription>Visão completa do desempenho do aluno</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Grid de Cards de Estatísticas */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Total de Horas</p>
                      <p className="text-3xl font-bold">{fullStatistics.totalHours.toFixed(1)}h</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Total de Sessões</p>
                      <p className="text-3xl font-bold">{fullStatistics.totalSessions}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Questões Respondidas</p>
                      <p className="text-3xl font-bold">{fullStatistics.questionsAnswered}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Taxa de Acertos</p>
                      <p className="text-3xl font-bold">
                        {fullStatistics.questionsAnswered > 0 
                          ? ((fullStatistics.correctAnswers / fullStatistics.questionsAnswered) * 100).toFixed(1)
                          : 0}%
                      </p>
                    </div>
                  </div>

                  {/* Detalhes de Questões */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Detalhes de Questões</p>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                        <p className="text-sm text-muted-foreground">Acertos</p>
                        <p className="text-xl font-bold">{fullStatistics.correctAnswers}</p>
                      </div>
                      <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                        <p className="text-sm text-muted-foreground">Erros</p>
                        <p className="text-xl font-bold">{fullStatistics.wrongAnswers}</p>
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                        <p className="text-sm text-muted-foreground">Total</p>
                        <p className="text-xl font-bold">{fullStatistics.questionsAnswered}</p>
                      </div>
                    </div>
                  </div>

                  {/* Streaks */}
                  {fullStatistics.currentStreak > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Sequências</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
                          <p className="text-sm text-muted-foreground">Sequência Atual</p>
                          <p className="text-2xl font-bold">{fullStatistics.currentStreak} dias</p>
                        </div>
                        <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg">
                          <p className="text-sm text-muted-foreground">Maior Sequência</p>
                          <p className="text-2xl font-bold">{fullStatistics.longestStreak} dias</p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Gráfico de Desempenho */}
              {fullStatistics.sessionHistory && fullStatistics.sessionHistory.length > 0 && (
                <PerformanceChart
                  statistics={{
                    totalHours: fullStatistics.totalHours,
                    totalSessions: fullStatistics.totalSessions,
                    questionsAnswered: fullStatistics.questionsAnswered,
                    correctAnswers: fullStatistics.correctAnswers,
                    sessionHistory: fullStatistics.sessionHistory || [],
                    subjectStats: fullStatistics.subjectStats || {}
                  }}
                  timeFilter={timeFilter}
                  onTimeFilterChange={setTimeFilter}
                />
              )}

              {/* Distribuição do Tempo por Disciplina */}
              {fullStatistics.subjectStats && Object.keys(fullStatistics.subjectStats).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Distribuição do Tempo por Disciplina</CardTitle>
                    <CardDescription>Horas estudadas por matéria</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4 max-h-[min(60vh,560px)] overflow-y-auto pr-1 overscroll-contain">
                      {Object.entries(fullStatistics.subjectStats)
                        .sort(
                          ([, a], [, b]) =>
                            ((b as { totalHours?: number }).totalHours || 0) -
                            ((a as { totalHours?: number }).totalHours || 0)
                        )
                        .map(([subject, stats]: [string, any]) => {
                        const totalHours = stats.totalHours || 0;
                        const totalQuestions = stats.questionsAnswered || 0;
                        const correctAnswers = stats.correctAnswers || 0;
                        const accuracyRate = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
                        
                        return (
                          <div key={subject} className="space-y-2">
                            <div className="flex justify-between items-center">
                              <p className="font-medium">{subject}</p>
                              <p className="text-sm text-muted-foreground">{totalHours.toFixed(1)}h</p>
                            </div>
                            <Progress value={(totalHours / fullStatistics.totalHours) * 100} className="h-2" />
                            <div className="flex gap-4 text-xs text-muted-foreground">
                              <span>{stats.totalSessions || 0} sessões</span>
                              <span>{totalQuestions} questões</span>
                              {accuracyRate > 0 && <span>{accuracyRate.toFixed(1)}% acertos</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Notas do Coach */}
      {student.notes && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Notas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{student.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Modal de Mensagem */}
      <Dialog open={messageModalOpen} onOpenChange={setMessageModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Deixar Mensagem para o Aluno</DialogTitle>
            <DialogDescription>
              Envie uma mensagem de até 600 caracteres que aparecerá como notificação para o aluno.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Textarea
                placeholder="Digite sua mensagem aqui..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                maxLength={600}
                rows={6}
                className="resize-none"
              />
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span>Máximo de 600 caracteres</span>
                <span>{messageText.length}/600</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setMessageModalOpen(false);
                setMessageText('');
              }}
              disabled={sendMessageMutation.isPending}
              className="border-purple-500 text-purple-600 hover:bg-purple-50 hover:border-purple-600 dark:border-purple-400 dark:text-purple-400 dark:hover:bg-purple-900/30"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSendMessage}
              disabled={sendMessageMutation.isPending || !messageText.trim()}
              className="bg-purple-600 hover:bg-purple-700 text-white dark:bg-purple-500 dark:hover:bg-purple-600"
            >
              {sendMessageMutation.isPending ? 'Enviando...' : 'Enviar Mensagem'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
};

export default StudentDetailsPage;

