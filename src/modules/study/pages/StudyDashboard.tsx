import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, BookOpen, Calendar, Clock, Target, TrendingUp, Users, Plus, PlayCircle, Timer, BarChart3, Settings, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useStudyStatistics } from '@/modules/statistics';
import { getScheduleSessions } from '../domain/scheduleHelpers';
import { UserStudyService } from '@/services/userStudyService';
import { StudyCycleV2 } from '@/types/userStudy';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

const StudyDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { statistics, isLoading } = useStudyStatistics();
  const [cycles, setCycles] = useState<StudyCycleV2[]>([]);
  const [upcomingSchedule, setUpcomingSchedule] = useState<any[]>([]);
  const [loadingCycles, setLoadingCycles] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [cycleToDelete, setCycleToDelete] = useState<StudyCycleV2 | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      loadStudyCycles();
      loadUpcomingSchedule();
    }
  }, [user]);

  const loadStudyCycles = async () => {
    if (!user) return;

    try {
      const userStudyData = await UserStudyService.getUserStudyData(user.id);
      if (userStudyData) {
        const activeCycles = userStudyData.study_cycles.filter(cycle => cycle.is_active);
        setCycles(activeCycles);
      }
    } catch (error) {
      devLog.error('Error:', error);
    } finally {
      setLoadingCycles(false);
    }
  };

  const loadUpcomingSchedule = async () => {
    if (!user) return;

    try {
      const userStudyData = await UserStudyService.getUserStudyData(user.id);
      if (userStudyData) {
        const today = new Date().getDay();
        const activeCycleIds = new Set(
          userStudyData.study_cycles.filter((cycle) => cycle.is_active).map((cycle) => cycle.id)
        );
        const upcomingSessions: Array<{
          id: string;
          discipline_name?: string;
          block_name?: string;
          start_time?: string;
          cycle_name: string;
          day_of_week: number;
        }> = [];

        getScheduleSessions(userStudyData)
          .filter(
            (session) =>
              session.cycle_id &&
              activeCycleIds.has(session.cycle_id) &&
              session.day_of_week >= today
          )
          .forEach((session) => {
            const cycle = userStudyData.study_cycles.find((c) => c.id === session.cycle_id);
            upcomingSessions.push({
              id: session.id,
              discipline_name: session.discipline_name,
              block_name: session.block_name,
              start_time: session.start_time,
              cycle_name: cycle?.cycle_name || 'Ciclo',
              day_of_week: session.day_of_week,
            });
          });
        
        // Ordenar por dia da semana e horário
        upcomingSessions.sort((a, b) => {
          if (a.day_of_week !== b.day_of_week) {
            return a.day_of_week - b.day_of_week;
          }
          return a.start_time.localeCompare(b.start_time);
        });
        
        setUpcomingSchedule(upcomingSessions.slice(0, 5));
      }
    } catch (error) {
      devLog.error('Error loading upcoming schedule:', error);
    }
  };

  const formatHours = (hours: number) => {
    return hours.toFixed(1) + 'h';
  };

  const getDayName = (dayNumber: number) => {
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    return days[dayNumber];
  };

  const getNextExamDate = () => {
    if (cycles.length === 0) return null;
    const upcomingExams = cycles
      .filter(cycle => new Date(cycle.exam_date) > new Date())
      .sort((a, b) => new Date(a.exam_date).getTime() - new Date(b.exam_date).getTime());
    return upcomingExams[0];
  };

  const openDeleteModal = (cycle: StudyCycleV2) => {
    setCycleToDelete(cycle);
    setDeleteModalOpen(true);
    setConfirmText('');
  };

  const confirmDeleteCycle = async () => {
    if (!cycleToDelete || confirmText !== 'Excluir' || !user) {
      return;
    }

    try {
      const success = await UserStudyService.removeCycle(user.id, cycleToDelete.id);
      if (!success) throw new Error('Failed to delete cycle');
      
      toast({
        title: 'Ciclo excluído',
        description: `O ciclo "${cycleToDelete.cycle_name}" foi excluído com sucesso.`
      });

      // Recarregar ciclos
      await loadStudyCycles();
      await loadUpcomingSchedule();
      
      // Fechar modal
      setDeleteModalOpen(false);
      setCycleToDelete(null);
      setConfirmText('');
    } catch (error) {
      devLog.error('Error deleting cycle:', error);
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir o ciclo. Tente novamente.',
        variant: 'destructive'
      });
    }
  };

  const nextExam = getNextExamDate();
  const daysUntilExam = nextExam ? Math.ceil((new Date(nextExam.exam_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;

  return (
    <div className="min-h-screen p-3 sm:p-6">
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard de Estudos</h1>
          <p className="text-muted-foreground">
            Gerencie seus estudos, acompanhe seu progresso e mantenha-se organizado
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/estudos/criar-ciclo')} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Novo Ciclo
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Horas Estudadas</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatHours(statistics.totalHours)}</div>
            <p className="text-xs text-muted-foreground">
              Total acumulado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tarefas</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.totalSessions}</div>
            <p className="text-xs text-muted-foreground">
              Tarefas realizadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Próxima Prova</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {daysUntilExam ? `${daysUntilExam}d` : '--'}
            </div>
            <p className="text-xs text-muted-foreground">
              {nextExam ? nextExam.position : 'Nenhuma prova cadastrada'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-1 gap-2 mb-8">
        {/* Active Cycles */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Ciclos Ativos
            </CardTitle>
            <CardDescription>
              Seus ciclos de estudo em andamento
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingCycles ? (
              <div className="text-center p-8">
                <div className="text-muted-foreground">Carregando ciclos...</div>
              </div>
            ) : cycles.length > 0 ? (
              <div className="space-y-4">
                {cycles.slice(0, 3).map((cycle) => (
                <div key={cycle.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg gap-4">
                  <div className="flex-1">
                    <h4 className="font-semibold text-foreground">{cycle.cycle_name}</h4>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-1">
                      <span className="text-sm text-muted-foreground">{cycle.organ}</span>
                      <Badge variant="outline" className="w-fit">{cycle.position}</Badge>
                      <span className="text-sm text-muted-foreground">
                        Prova: {new Date(cycle.exam_date).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <Button 
                      size="sm" 
                      className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto"
                      onClick={() => navigate('/estudos/cronograma')}
                    >
                      <BookOpen className="h-4 w-4 mr-2" />
                      Iniciar Tarefa
                    </Button>
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => openDeleteModal(cycle)}
                      className="w-full sm:w-auto"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Excluir
                    </Button>
                  </div>
                </div>
                ))}
                {cycles.length === 0 && (
                  <div className="text-center p-8">
                    <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">Nenhum ciclo ativo</h3>
                    <p className="text-muted-foreground mb-4">
                      Crie seu primeiro ciclo de estudos para começar a se organizar
                    </p>
                    <Button onClick={() => navigate('/estudos/criar-ciclo')}>
                      Criar Primeiro Ciclo
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center p-8">
                <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">Nenhum ciclo ativo</h3>
                <p className="text-muted-foreground mb-4">
                  Crie seu primeiro ciclo de estudos para começar a se organizar
                </p>
                <Button onClick={() => navigate('/estudos/criar-ciclo')}>
                  Criar Primeiro Ciclo
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Schedule */}
      {upcomingSchedule.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Próximas Tarefas
            </CardTitle>
            <CardDescription>
              Suas próximas tarefas de estudo programadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingSchedule.map((session, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium text-foreground">
                      {session.discipline_name || session.block_name || 'Tarefa de Estudo'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {getDayName(session.day_of_week)} • {session.start_time} - {session.end_time}
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {getDayName(session.day_of_week)}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal de Confirmação de Exclusão */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o ciclo <strong>"{cycleToDelete?.cycle_name}"</strong>?
              <br /><br />
              <span className="text-destructive font-medium">
                ⚠️ Esta ação irá excluir permanentemente:
              </span>
              <ul className="list-disc list-inside mt-2 text-sm text-muted-foreground">
                <li>Todas as tarefas de estudos</li>
                <li>O edital verticalizado</li>
                <li>Todo o progresso registrado</li>
              </ul>
              <br />
              Para confirmar, digite <strong>"Excluir"</strong> no campo abaixo:
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="confirmText" className="text-right">
                Confirmação
              </Label>
              <Input
                id="confirmText"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Digite 'Excluir'"
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setDeleteModalOpen(false);
              setCycleToDelete(null);
              setConfirmText('');
            }}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmDeleteCycle}
              disabled={confirmText !== 'Excluir'}
            >
              <X className="h-4 w-4 mr-2" />
              Excluir Ciclo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudyDashboard;