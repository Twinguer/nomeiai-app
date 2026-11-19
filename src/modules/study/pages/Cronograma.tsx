import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { CalendarIcon, Plus, Settings, BookOpen, Clock, X, ArrowLeft, Timer, ExternalLink, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn, generateId } from '@/lib/utils';
import { useTimer } from '@/contexts/TimerContext';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { setPendingTimerTask, consumeTimerSuggestedMinutes } from '@/utils/timerTaskContext';
import { useStudyCyclesV2 } from '../hooks/useStudyCyclesV2';
import { UserStudyService } from '@/services/userStudyService';
import { v4 as uuidv4 } from 'uuid';
import { useOptimizedSessionData } from '@/hooks/useOptimizedSessionData';
import { useSecureStudyCycleUrls } from '../hooks/useSecureStudyCycleUrls';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';
import { WeeklyScheduleBoard } from '../components/WeeklyScheduleBoard';
import { WeeklyScheduleTaskCard } from '../components/WeeklyScheduleTaskCard';
import { ScheduleModePicker } from '../components/ScheduleModePicker';
import { CycleDocumentsPanel } from '../components/CycleDocumentsPanel';
import { CronogramaTimerLinkCard } from '../components/CronogramaTimerLinkCard';
import { ScheduleTaskEditDialog } from '../components/ScheduleTaskEditDialog';
import { ScheduleTaskPlanEditDialog } from '../components/ScheduleTaskPlanEditDialog';
import { useCycleDocuments } from '../hooks/useCycleDocuments';
import { useCronogramaData, type CronogramaStudySession } from '../hooks/useCronogramaData';
import {
  getCycleScheduleMode,
  toStorageDayOfWeek,
  type ScheduleMode,
} from '../domain/scheduleMode';
import { formatTaskDurationHours } from '../domain/disciplineStudyStats';

// Interface para props do modo coach
export interface CronogramaProps {
  coachMode?: boolean;
  targetStudentId?: string;
  targetCycleId?: string;
  onSuccess?: () => void;
}

// Usar StudyCycleV2 do types
const Cronograma = ({
  coachMode,
  targetStudentId,
  targetCycleId,
  cycleId: secureCycleId,
  onSuccess,
}: CronogramaProps & { cycleId?: string } = {}) => {
  const navigate = useNavigate();
  const { generateSecureUrl, generateTimerUrl } = useSecureStudyCycleUrls();
  const resolvedTargetCycleId = targetCycleId ?? secureCycleId;
  const {
    user
  } = useAuth();
  const { setInitialTime } = useTimer();
  const {
    addScheduleSession,
    updateScheduleSession,
    recordCompletedSession,
    fetchCycles: refetchCycles
  } = useStudyCyclesV2();

  const {
    cycles,
    sessions,
    setSessions,
    userStudy,
    loading,
    scheduleByCycleId,
    fetchCycles,
    refreshCronogramaData,
  } = useCronogramaData({
    userId: user?.id,
    coachMode,
    targetStudentId,
  });

  // Clock state
  const [currentTime, setCurrentTime] = useState(new Date());

  // Calendar state (simplificado - apenas visual)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  // Calendário simplificado - sem funcionalidades de estatísticas
  const [selectedCycle, setSelectedCycle] = useState<string>('');
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>('');
  const [selectedBlock, setSelectedBlock] = useState<string>('');
  const [selectedDay, setSelectedDay] = useState<number>(0);
  const [customBlock, setCustomBlock] = useState<string>('');
  const [customDiscipline, setCustomDiscipline] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('08:00');
  const [endTime, setEndTime] = useState<string>('09:00');
  const [sessionTimeMode, setSessionTimeMode] = useState<ScheduleMode>('duration');
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPlanEditModal, setShowPlanEditModal] = useState(false);
  const [editingPlanSession, setEditingPlanSession] = useState<CronogramaStudySession | null>(null);
  const [planEditBlock, setPlanEditBlock] = useState('');
  const [planEditDiscipline, setPlanEditDiscipline] = useState('');
  const [planEditCustomBlock, setPlanEditCustomBlock] = useState('');
  const [planEditCustomDiscipline, setPlanEditCustomDiscipline] = useState('');
  const [planEditDay, setPlanEditDay] = useState(0);
  const [planEditStartTime, setPlanEditStartTime] = useState('08:00');
  const [planEditEndTime, setPlanEditEndTime] = useState('09:00');
  const [planEditDuration, setPlanEditDuration] = useState(90);
  const [planEditTimeMode, setPlanEditTimeMode] = useState<ScheduleMode>('duration');
  const [planEditSessionLink, setPlanEditSessionLink] = useState('');
  const [planEditSaving, setPlanEditSaving] = useState(false);
  const [showSessionDetailsModal, setShowSessionDetailsModal] = useState(false);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [selectedDateSessions, setSelectedDateSessions] = useState<any[]>([]);
  const [editingSession, setEditingSession] = useState<CronogramaStudySession | null>(null);
  const [sessionLink, setSessionLink] = useState<string>('');

  // Estados para edição de sessão
  const [studyDuration, setStudyDuration] = useState<number>(0);
  const [studyNotes, setStudyNotes] = useState<string>('');
  const [questionsTotal, setQuestionsTotal] = useState<number>(0);
  const [questionsCorrect, setQuestionsCorrect] = useState<number>(0);
  const [questionsError, setQuestionsError] = useState<string>('');
  const [courseName, setCourseName] = useState<string>('');
  const [courseProgress, setCourseProgress] = useState<string>('');
  const [studyType, setStudyType] = useState<'pdf' | 'video'>('pdf');
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [currentVideo, setCurrentVideo] = useState<string>('');

  // Função de validação das questões
  const validateQuestions = (total: number, correct: number) => {
    if (correct > total) {
      setQuestionsError('Questões corretas não podem ser maiores que o total');
      return false;
    }
    setQuestionsError('');
    return true;
  };

  // Usar hook otimizado para dados de sessão
  const {
    sessionData,
    loading: sessionDataLoading,
    error: sessionDataError,
    refreshData
  } = useOptimizedSessionData({
    targetUserId: coachMode ? targetStudentId : undefined,
    dependencies: [cycles, coachMode, targetStudentId]
  });

  const weekDays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

  const getLockedModeForCycle = useCallback(
    (cycleId: string): ScheduleMode | null => {
      const cycle = cycles.find((c) => c.id === cycleId);
      return getCycleScheduleMode(cycle, scheduleByCycleId[cycleId] || []);
    },
    [cycles, scheduleByCycleId]
  );

  useEffect(() => {
    if (!selectedCycle) return;
    const locked = getLockedModeForCycle(selectedCycle);
    if (locked) setSessionTimeMode(locked);
  }, [selectedCycle, getLockedModeForCycle]);

  // Inicializar selectedCycle automaticamente
  useEffect(() => {
    // Se targetCycleId foi fornecido, usar ele
    if (resolvedTargetCycleId && cycles.length > 0) {
      const cycleExists = cycles.find(c => c.id === resolvedTargetCycleId);
      if (cycleExists && selectedCycle !== resolvedTargetCycleId) {
        setSelectedCycle(resolvedTargetCycleId);
      }
    }
    // Se não há ciclo selecionado e há ciclos disponíveis, selecionar o primeiro
    else if (!selectedCycle && cycles.length > 0) {
      setSelectedCycle(cycles[0].id);
    }
  }, [cycles, resolvedTargetCycleId, selectedCycle]);

  // Update clock every 5 seconds - otimizado para melhor performance
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 5000); // 5 segundos em vez de 1 segundo para reduzir re-renders
    return () => clearInterval(timer);
  }, []);

  // Função para extrair blocos únicos do available_blocks do schedule_data
  const getAvailableBlocks = (cycleId?: string) => {
    const resolvedCycleId = cycleId ?? selectedCycle;
    const selectedCycleData = cycles.find(c => c.id === resolvedCycleId);
    if (!selectedCycleData) return [];

    // Buscar blocos salvos no ciclo (available_blocks)
    const savedBlocks = selectedCycleData.schedule_data.available_blocks || [];

    // Se não há blocos salvos, mostrar opção customizada
    if (savedBlocks.length === 0) {
      return [{
        name: '+ Adicionar novo bloco',
        id: '__custom__'
      }];
    }
    return savedBlocks.map(block => ({
      name: block.name,
      id: block.name
    }));
  };

  // Função para extrair disciplinas únicas do available_disciplines do schedule_data
  const getAvailableDisciplines = (cycleId?: string, blockName?: string) => {
    const resolvedCycleId = cycleId ?? selectedCycle;
    const resolvedBlock = blockName ?? selectedBlock;
    const selectedCycleData = cycles.find(c => c.id === resolvedCycleId);
    if (!selectedCycleData || !resolvedBlock) return [];

    // Buscar disciplinas salvas no ciclo (available_disciplines) para o bloco selecionado
    const savedDisciplines = selectedCycleData.schedule_data.available_disciplines || [];
    const blockDisciplines = savedDisciplines.filter(d => d.block_name === resolvedBlock);

    // Se não há disciplinas salvas para este bloco, mostrar opção customizada
    if (blockDisciplines.length === 0) {
      return [{
        name: '+ Adicionar nova disciplina',
        id: '__custom__'
      }];
    }
    return blockDisciplines.map(discipline => ({
      name: discipline.name,
      id: discipline.name
    }));
  };

  const getCycleOwnerUserId = () => (coachMode ? targetStudentId : user?.id);

  const handleNavigateToDisciplinas = async () => {
    const targetUserId = getCycleOwnerUserId();
    if (!selectedCycle || !targetUserId) {
      toast.error('Selecione um ciclo de estudos');
      return;
    }
    try {
      const secureUrl = await generateSecureUrl(selectedCycle, targetUserId, 'view');
      navigate(secureUrl);
    } catch (error) {
      devLog.error('Erro ao gerar URL segura:', error);
      navigate('/estudos');
    }
  };

  const handleScheduleReorder = async (
    updates: Map<string, { day: number; displayOrder: number }>,
    _cycleId: string
  ) => {
    const targetUserId = coachMode ? targetStudentId : user?.id;
    if (!targetUserId || updates.size === 0) return;

    const prevSessions = sessions;
    setSessions((current) =>
      current.map((s) => {
        const u = updates.get(s.id);
        if (!u) return s;
        return { ...s, day: u.day, displayOrder: u.displayOrder };
      })
    );

    const patches = [...updates.entries()].map(([id, u]) => ({
      id,
      day_of_week: toStorageDayOfWeek(u.day),
      display_order: u.displayOrder,
    }));

    const ok = await UserStudyService.patchScheduleSessions(targetUserId, patches);
    if (!ok) {
      setSessions(prevSessions);
      toast.error('Erro ao salvar a nova ordem das tarefas');
    }
  };

  const addSession = async () => {
    // Usar valores customizados se selecionados
    const finalBlock = selectedBlock === '__custom__' ? customBlock : selectedBlock;
    const finalDiscipline = selectedDiscipline === '__custom__' ? customDiscipline : selectedDiscipline;
    const targetUserId = coachMode ? targetStudentId : user?.id;
    
    if (!selectedCycle || !finalBlock || !finalDiscipline) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    const lockedMode = getLockedModeForCycle(selectedCycle);
    const effectiveMode = lockedMode ?? sessionTimeMode;
    if (lockedMode && lockedMode !== sessionTimeMode) {
      toast.error('Este ciclo não permite misturar tempo de estudos com horário fixo');
      return;
    }
    
    // Se modo duração, não precisa de horários
    if (effectiveMode === 'duration') {
      // Validar duração mínima
      if (durationMinutes < 5) {
        toast.error('A duração mínima é de 5 minutos');
        return;
      }
      if (durationMinutes > 480) {
        toast.error('A duração máxima é de 480 minutos (8 horas)');
        return;
      }
    } else {
      // Validar horários para modo time
    if (endTime <= startTime) {
      toast.error('O horário de fim deve ser posterior ao horário de início');
      return;
    }
    }
    
    try {
      // Adicionar sessão ao cronograma usando o hook useStudyCyclesV2
      const success = await addScheduleSession(selectedCycle, toStorageDayOfWeek(selectedDay), {
        start_time: effectiveMode === 'time' ? startTime : undefined,
        end_time: effectiveMode === 'time' ? endTime : undefined,
        duration_minutes: effectiveMode === 'duration' ? durationMinutes : undefined,
        discipline_name: finalDiscipline,
        block_name: finalBlock,
        session_link: sessionLink
      }, targetUserId);
      if (success) {
        await refreshCronogramaData({ force: true });

        // Limpar campos
        setSelectedBlock('');
        setSelectedDiscipline('');
        setCustomBlock('');
        setCustomDiscipline('');
        setStartTime('08:00');
        setEndTime('09:00');
        setSessionLink('');
        setSessionTimeMode('time');
        setDurationMinutes(60);
        setShowAddModal(false);
        toast.success('Tarefa adicionada ao cronograma!');
      } else {
        toast.error('Erro ao adicionar tarefa');
      }
    } catch (error) {
      devLog.error('Error adding session:', error);
      toast.error('Erro ao adicionar tarefa');
    }
  };
  const handleDeleteClick = (sessionId: string) => {
    setSessionToDelete(sessionId);
    setShowDeleteConfirmDialog(true);
  };

  const removeSession = async (sessionId: string) => {
    try {
      const targetUserId = coachMode ? targetStudentId : user?.id;
      if (!targetUserId) {
        toast.error('Erro ao identificar usuário');
        return;
      }
      
      devLog.log('🗑️ Removendo sessão:', { sessionId, targetUserId, coachMode });
      
      // Remove session from schedule
      const success = await UserStudyService.removeScheduleSession(targetUserId, sessionId);
      
      if (success) {
        await Promise.all([refreshCronogramaData({ force: true }), refreshData()]);
        toast.success('Tarefa removida do cronograma!');
      } else {
        devLog.error('❌ Falha ao remover sessão do banco');
        toast.error('Erro ao remover tarefa. Verifique suas permissões.');
      }
    } catch (error: any) {
      devLog.error('❌ Erro ao remover tarefa:', error);
      toast.error(`Erro ao remover tarefa: ${error.message || 'Tente novamente'}`);
    } finally {
      setShowDeleteConfirmDialog(false);
      setSessionToDelete(null);
    }
  };

  const {
    uploadingPDF,
    editingLabel,
    labelValue,
    setLabelValue,
    handlePDFUpload,
    handlePDFFileSelect,
    handleDownloadDocument,
    handlePDFRemove,
    startEditingLabel,
    cancelEditingLabel,
    saveLabel,
  } = useCycleDocuments({
    cycles,
    selectedCycle,
    coachMode,
    targetStudentId,
    userId: user?.id,
    refreshCycles: fetchCycles,
  });

  const getSessionsForDay = (day: number) => {
    return sessions.filter(s => s.day === day).sort((a, b) => {
      // Tarefas com horário vêm primeiro, ordenadas por horário
      if (a.startTime && b.startTime) {
        return a.startTime.localeCompare(b.startTime);
      }
      // Tarefas sem horário (duração livre) vêm depois
      if (a.startTime && !b.startTime) return -1;
      if (!a.startTime && b.startTime) return 1;
      // Se ambas são de duração livre, ordenar por duração
      if (!a.startTime && !b.startTime) {
        return (a.durationMinutes || 0) - (b.durationMinutes || 0);
      }
      return 0;
    });
  };
  const isSessionCompleted = (sessionId: string) => {
    const savedSessions = localStorage.getItem(`completed_sessions_${user?.id}`);
    if (!savedSessions) return false;
    const completedSessions = JSON.parse(savedSessions);
    return completedSessions.some((s: any) => s.sessionId === sessionId);
  };
  const getSessionData = (sessionId: string) => {
    const savedSessions = localStorage.getItem(`completed_sessions_${user?.id}`);
    if (!savedSessions) return null;
    const completedSessions = JSON.parse(savedSessions);
    return completedSessions.find((s: any) => s.sessionId === sessionId);
  };
  const getCycleName = (cycleId: string) => {
    return cycles.find(c => c.id === cycleId)?.cycle_name || 'Ciclo não encontrado';
  };

  // Função para verificar se um dia tem sessões estudadas
  const getSessionsForDate = (date: Date) => {
    // ✅ Formato correto: YYYY-MM-DD usando locale canadense (evita problemas de timezone)
    const dateString = date.toLocaleDateString('en-CA');
    const allSessions: any[] = [];

    // Buscar APENAS sessões completadas (study_sessions)
    if (userStudy?.study_sessions && Array.isArray(userStudy.study_sessions)) {
      userStudy.study_sessions.forEach((completedSession: any) => {
        if (completedSession.date === dateString) {
          // ✅ BUSCAR CICLO usando cycle_id OU primeiro ciclo ativo
          let cycle = null;
          if (completedSession.cycle_id) {
            cycle = userStudy.study_cycles?.find((c: any) => c.id === completedSession.cycle_id);
          }
          // Fallback: usar primeiro ciclo ativo se não encontrar pelo ID
          if (!cycle && userStudy.study_cycles) {
            cycle = userStudy.study_cycles.find((c: any) => c.is_active);
          }
          
          // ✅ ADICIONAR SESSÃO mesmo sem ciclo
          allSessions.push({
            cycle: cycle ? {
              name: cycle.cycle_name,
              organ: cycle.organ,
              position: cycle.position
            } : {
              name: 'Ciclo não encontrado',
              organ: '',
              position: ''
            },
            session: {
              discipline: completedSession.discipline_name || 'Sem disciplina',
              topic: completedSession.block_name || 'Sem tópico',
              startTime: completedSession.start_time || '08:00',
              endTime: completedSession.end_time || '09:00',
              duration: completedSession.duration_minutes || 0,
              questions: completedSession.questions || 0,
              correct: completedSession.correct_answers || 0,
              notes: completedSession.notes || '',
              link: completedSession.session_link || '',
              studyType: completedSession.study_type || 'manual',
              courseName: completedSession.course_name || ''
            }
          });
        }
      });
    }
    
    return allSessions;
  };

  // Função para abrir modal de detalhes das sessões
  const openSessionDetailsModal = (date: Date) => {
    const sessions = getSessionsForDate(date);
    setSelectedDate(date);
    setSelectedDateSessions(sessions);
    setShowSessionDetailsModal(true);
  };

  // Função para verificar se um dia tem sessões (para cor do calendário)
  const hasSessionsOnDate = (date: Date) => {
    const sessions = getSessionsForDate(date);
    return sessions.length > 0;
  };

  // Função para registrar sessão completada (usando RPC para separar em study_sessions)
  const updateScheduleSessionStats = async (sessionId: string, stats: {
    duration: number;
    questions: number;
    correctAnswers: number;
    sessionLink: string;
    notes?: string;
    courseName?: string;
    studyType?: string;
  }) => {
    try {
      // Encontrar a sessão no cronograma para obter cycleId e dayOfWeek
      let cycleId = '';
      let dayOfWeek = 0;
      for (const session of sessions) {
        if (session.id === sessionId) {
          cycleId = session.cycleId;
          dayOfWeek = session.day;
          break;
        }
      }
      if (!cycleId) {
        toast.error('Tarefa não encontrada');
        return;
      }

      // Determinar o userId correto (targetStudentId em coach mode, user.id em modo normal)
      const targetUserId = coachMode ? targetStudentId : user?.id;

      // Usar recordCompletedSession do hook para registrar via RPC
      const success = await recordCompletedSession(cycleId, dayOfWeek, sessionId, {
        duration_minutes: stats.duration,
        questions: stats.questions,
        correct_answers: stats.correctAnswers,
        notes: stats.notes || '',
        course_name: stats.courseName || '',
        session_link: stats.sessionLink || '',
        study_type: stats.studyType || 'manual'
      }, targetUserId); // ✅ Passar targetUserId
      if (success) {
        // Recarregar ciclos para atualizar total_stats
        await refetchCycles();
        await refreshCronogramaData({ force: true });
      }
    } catch (error) {
      devLog.error('Error recording session:', error);
      toast.error('Erro ao registrar tarefa');
    }
  };
  const openPlanEditModal = (session: CronogramaStudySession, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingPlanSession(session);
    setPlanEditBlock(session.blockName);
    setPlanEditDiscipline(session.disciplineName);
    setPlanEditCustomBlock('');
    setPlanEditCustomDiscipline('');
    setPlanEditDay(session.day);
    setPlanEditSessionLink(session.sessionLink || '');

    const lockedMode = getLockedModeForCycle(session.cycleId);
    const isDurationTask = Boolean(session.durationMinutes);
    const effectiveMode = lockedMode ?? (isDurationTask ? 'duration' : 'time');
    setPlanEditTimeMode(effectiveMode);

    if (effectiveMode === 'duration') {
      setPlanEditDuration(session.durationMinutes && session.durationMinutes >= 5 ? session.durationMinutes : 90);
    } else {
      setPlanEditStartTime(session.startTime?.substring(0, 5) || '08:00');
      setPlanEditEndTime(session.endTime?.substring(0, 5) || '09:00');
    }

    setShowPlanEditModal(true);
  };

  const savePlanEdit = async () => {
    if (!editingPlanSession) return;

    const finalBlock = planEditBlock === '__custom__' ? planEditCustomBlock.trim() : planEditBlock;
    const finalDiscipline =
      planEditDiscipline === '__custom__' ? planEditCustomDiscipline.trim() : planEditDiscipline;
    const targetUserId = coachMode ? targetStudentId : user?.id;

    if (!finalBlock || !finalDiscipline) {
      toast.error('Preencha bloco e disciplina');
      return;
    }

    const lockedMode = getLockedModeForCycle(editingPlanSession.cycleId);
    const effectiveMode = lockedMode ?? planEditTimeMode;

    if (effectiveMode === 'duration') {
      if (planEditDuration < 5 || planEditDuration > 480) {
        toast.error('A duração deve estar entre 5 e 480 minutos');
        return;
      }
    } else if (planEditEndTime <= planEditStartTime) {
      toast.error('O horário de fim deve ser posterior ao horário de início');
      return;
    }

    setPlanEditSaving(true);
    try {
      const updates =
        effectiveMode === 'duration'
          ? {
              discipline_name: finalDiscipline,
              block_name: finalBlock,
              session_link: planEditSessionLink || undefined,
              day_of_week: toStorageDayOfWeek(planEditDay),
              duration_minutes: planEditDuration,
            }
          : {
              discipline_name: finalDiscipline,
              block_name: finalBlock,
              session_link: planEditSessionLink || undefined,
              day_of_week: toStorageDayOfWeek(planEditDay),
              start_time: planEditStartTime,
              end_time: planEditEndTime,
            };

      const success = await updateScheduleSession(
        editingPlanSession.id,
        updates,
        targetUserId
      );

      if (success) {
        await refreshCronogramaData({ force: true });
        setShowPlanEditModal(false);
        setEditingPlanSession(null);
      }
    } finally {
      setPlanEditSaving(false);
    }
  };

  const openEditModal = (session: CronogramaStudySession) => {
    setEditingSession(session);

    // Carregar dados existentes de sessões acumulativas do sessionData
    const existingSession = sessionData[session.id];
    if (existingSession) {
      setSessionLink(existingSession.session_link || '');
    } else {
      setSessionLink(session.sessionLink || '');
    }

    // Limpar campos do modal para nova entrada
    const suggestedMinutes = consumeTimerSuggestedMinutes(session.id);
    setStudyDuration(suggestedMinutes ?? 0);
    setStudyNotes('');
    setQuestionsTotal(0);
    setQuestionsCorrect(0);
    setCourseName('');
    setCourseProgress('');
    setStudyType('pdf');
    setCurrentPage(0);
    setCurrentVideo('');
    setShowEditModal(true);
  };

  const startTimerForTask = async () => {
    if (!editingSession) return;

    const ownerUserId = coachMode ? targetStudentId : user?.id;
    if (!ownerUserId) {
      toast.error('Não foi possível identificar o aluno para o timer.');
      return;
    }

    setPendingTimerTask({
      scheduleSessionId: editingSession.id,
      disciplineName: editingSession.disciplineName,
      blockName: editingSession.blockName,
      cycleId: editingSession.cycleId,
      dayOfWeek: editingSession.day,
      returnPath: `${window.location.pathname}${window.location.search}`,
      plannedDurationMinutes: editingSession.durationMinutes,
      ownerUserId,
    });

    if (editingSession.durationMinutes && editingSession.durationMinutes >= 5) {
      setInitialTime(Math.min(editingSession.durationMinutes, 360));
    }

    setShowEditModal(false);

    try {
      const timerUrl = await generateTimerUrl(editingSession.cycleId, ownerUserId);
      navigate(timerUrl);
      toast.message('Use o timer para focar; confirme o registro no cronograma ao terminar.');
    } catch (error) {
      devLog.error('Erro ao abrir timer da tarefa:', error);
      navigate('/estudos/timer');
      toast.message('Use o timer para focar; confirme o registro no cronograma ao terminar.');
    }
  };

  const saveStudySession = async () => {
    if (!editingSession) {
      return;
    }

    // Validar questões antes de salvar
    if (questionsTotal > 0 && !validateQuestions(questionsTotal, questionsCorrect)) {
      toast.error('Corrija os valores das questões antes de salvar');
      return;
    }
    try {
      // Salvar APENAS no cronograma (fonte única de verdade)
      await updateScheduleSessionStats(editingSession.id, {
        duration: studyDuration,
        questions: questionsTotal,
        correctAnswers: questionsCorrect,
        sessionLink: sessionLink,
        notes: studyNotes,
        courseName: courseName,
        studyType: studyType
      });

      setShowEditModal(false);
      setEditingSession(null);

      // Recarregar dados para sincronizar
      await refreshData();
      await refreshCronogramaData({ force: true });

      // Limpar campos
      setStudyDuration(0);
      setStudyNotes('');
      setQuestionsTotal(0);
      setQuestionsCorrect(0);
      setCourseName('');
      setCourseProgress('');
      setSessionLink('');
      toast.success('Tarefa de estudo salva com sucesso!');
    } catch (error) {
      toast.error('Erro ao salvar tarefa de estudo');
    }
  };
  if (loading) {
    return <div className="min-h-screen p-3 sm:p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-64"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>;
  }
  return <div className="min-h-screen p-3 sm:p-6 bg-page-background">
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-foreground">Cronograma de Estudos</h1>
      </div>

      {/* Clock, Timer, and Calendar Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-[5px]">
        {/* Clock Card */}
        <Card className="rounded-xl border border-border bg-card text-card-foreground shadow-lg hover:shadow-2xl transition-shadow duration-300 overflow-hidden" style={{
        boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.05)'
      }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Relógio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-2">
              <div className="text-6xl font-bold">
                {format(currentTime, 'HH:mm:ss')}
              </div>
              <div className="text-sm text-muted-foreground">
                {format(currentTime, 'EEEE, dd/MM/yyyy', {
                locale: ptBR
              })}
              </div>
            </div>
          </CardContent>
        </Card>

        <CronogramaTimerLinkCard
          selectedCycleId={selectedCycle}
          ownerUserId={coachMode ? targetStudentId : user?.id}
        />

        {/* Calendar Card */}
        <Card className="rounded-xl border border-border bg-card text-card-foreground shadow-lg hover:shadow-2xl transition-shadow duration-300 overflow-hidden" style={{
        boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.05)'
      }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Calendário de Estudos
            </CardTitle>
            
          </CardHeader>
          <CardContent className="space-y-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-9", !selectedDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, 'dd/MM/yyyy', {
                  locale: ptBR
                }) : "Selecionar data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent 
                  mode="single" 
                  selected={selectedDate} 
                  onSelect={date => {
                    if (date) {
                      setSelectedDate(date);
                      if (hasSessionsOnDate(date)) {
                        openSessionDetailsModal(date);
                      }
                    }
                  }} 
                  initialFocus 
                  className={cn("p-3")} 
                  components={{
                    Day: ({
                      date,
                      displayMonth,
                      className,
                      ...props
                    }) => {
                      const hasSessions = hasSessionsOnDate(date);
                      return (
                        <button
                          type="button"
                          {...props}
                          className={cn(
                            className, // Isso já inclui rdp-day, rdp-day_selected, etc.
                            hasSessions && "studied-day" // Adicionar nossa classe para os estilos CSS
                          )}
                          style={hasSessions ? {
                            backgroundColor: '#10b981',
                            color: 'white',
                            fontWeight: 600,
                            border: 'none',
                            borderRadius: '50%',
                            width: '30px',
                            height: '30px'
                          } : undefined}
                          onClick={(e) => {
                            // Preservar comportamento padrão do DayPicker
                            if (props.onClick) {
                              (props.onClick as any)(e);
                            }
                            // Abrir modal se tiver sessões
                            if (hasSessions) {
                              openSessionDetailsModal(date);
                            }
                          }}
                        >
                          <span className="relative z-0">{date.getDate()}</span>
                        </button>
                      );
                    }
                  }} 
                />
              </PopoverContent>
            </Popover>

            {selectedCycle && (
              <CycleDocumentsPanel
                selectedCycle={selectedCycle}
                cycles={cycles}
                uploadingPDF={uploadingPDF}
                editingLabel={editingLabel}
                labelValue={labelValue}
                onLabelValueChange={setLabelValue}
                onStartEditingLabel={startEditingLabel}
                onCancelEditingLabel={cancelEditingLabel}
                onSaveLabel={saveLabel}
                onDownload={handleDownloadDocument}
                onUpload={handlePDFUpload}
                onRemove={handlePDFRemove}
                onFileSelect={handlePDFFileSelect}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end items-center mb-4">
        <div className="flex gap-2">
          <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
            <DialogTrigger asChild>
              
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Tarefa de Estudo</DialogTitle>
                <DialogDescription>
                  Adicione uma nova tarefa de estudo ao seu cronograma semanal
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Ciclo de Estudos</label>
                  <Select value={selectedCycle} onValueChange={setSelectedCycle}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um ciclo" />
                    </SelectTrigger>
                    <SelectContent>
                      {cycles.map(cycle => <SelectItem key={cycle.id} value={cycle.id}>
                          {cycle.cycle_name}
                        </SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {selectedCycle && (
                  <ScheduleModePicker
                    value={sessionTimeMode}
                    onChange={setSessionTimeMode}
                    lockedMode={getLockedModeForCycle(selectedCycle)}
                  />
                )}

                <div>
                  <label className="text-sm font-medium">Bloco</label>
                  <Select value={selectedBlock} onValueChange={setSelectedBlock}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione ou digite um bloco" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableBlocks().map((block: any) => <SelectItem key={block.name} value={block.name}>
                          {block.name}
                        </SelectItem>)}
                      <SelectItem value="__custom__">+ Adicionar novo bloco</SelectItem>
                    </SelectContent>
                  </Select>
                  {selectedBlock === '__custom__' && <Input placeholder="Digite o nome do bloco" value={customBlock} onChange={e => setCustomBlock(e.target.value)} className="mt-2" />}
                </div>

                <div>
                  <label className="text-sm font-medium">Disciplina</label>
                  <Select value={selectedDiscipline} onValueChange={setSelectedDiscipline}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione ou digite uma disciplina" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableDisciplines().map((discipline: any) => <SelectItem key={discipline.name} value={discipline.name}>
                          {discipline.name}
                        </SelectItem>)}
                      <SelectItem value="__custom__">+ Adicionar nova disciplina</SelectItem>
                    </SelectContent>
                  </Select>
                  {selectedDiscipline === '__custom__' && <Input placeholder="Digite o nome da disciplina" value={customDiscipline} onChange={e => setCustomDiscipline(e.target.value)} className="mt-2" />}
                </div>

                <div>
                  <label className="text-sm font-medium">Dia da Semana</label>
                  <Select value={selectedDay.toString()} onValueChange={value => setSelectedDay(Number(value))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um dia" />
                    </SelectTrigger>
                    <SelectContent>
                      {weekDays.map((day, index) => <SelectItem key={index} value={index.toString()}>
                          {day}
                        </SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* Renderização Condicional */}
                {sessionTimeMode === 'time' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Horário de Início</label>
                    <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full p-2 border rounded-md" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Horário de Fim</label>
                    <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full p-2 border rounded-md" />
                  </div>
                </div>
                ) : (
                  <div>
                    <label className="text-sm font-medium">Duração (minutos)</label>
                    <Input 
                      type="number" 
                      min="5" 
                      max="480" 
                      step="5"
                      value={durationMinutes} 
                      onChange={e => {
                        const value = Number(e.target.value);
                        if (value >= 5 && value <= 480) {
                          setDurationMinutes(value);
                        }
                      }} 
                      placeholder="60"
                      className="w-full" 
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Duração entre 5 e 480 minutos (8 horas). Você pode iniciar quando quiser.
                    </p>
                  </div>
                )}


                <div>
                  <label className="text-sm font-medium">Link da Aula/Vídeo (Opcional)</label>
                  <Input type="url" value={sessionLink} onChange={e => setSessionLink(e.target.value)} placeholder="https://exemplo.com/aula" className="w-full" />
                </div>

                <Button onClick={addSession} className="w-full">
                  Adicionar Tarefa
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Calendário simplificado - sem funcionalidades de estatísticas */}

      <ScheduleTaskPlanEditDialog
        open={showPlanEditModal}
        onOpenChange={setShowPlanEditModal}
        session={editingPlanSession}
        cycles={cycles}
        weekDays={weekDays}
        sessionTimeMode={planEditTimeMode}
        onSessionTimeModeChange={setPlanEditTimeMode}
        lockedMode={editingPlanSession ? getLockedModeForCycle(editingPlanSession.cycleId) : null}
        selectedBlock={planEditBlock}
        onSelectedBlockChange={setPlanEditBlock}
        selectedDiscipline={planEditDiscipline}
        onSelectedDisciplineChange={setPlanEditDiscipline}
        customBlock={planEditCustomBlock}
        onCustomBlockChange={setPlanEditCustomBlock}
        customDiscipline={planEditCustomDiscipline}
        onCustomDisciplineChange={setPlanEditCustomDiscipline}
        selectedDay={planEditDay}
        onSelectedDayChange={setPlanEditDay}
        startTime={planEditStartTime}
        onStartTimeChange={setPlanEditStartTime}
        endTime={planEditEndTime}
        onEndTimeChange={setPlanEditEndTime}
        durationMinutes={planEditDuration}
        onDurationMinutesChange={setPlanEditDuration}
        sessionLink={planEditSessionLink}
        onSessionLinkChange={setPlanEditSessionLink}
        availableBlocks={getAvailableBlocks(editingPlanSession?.cycleId)}
        availableDisciplines={getAvailableDisciplines(editingPlanSession?.cycleId, planEditBlock)}
        onSave={savePlanEdit}
        saving={planEditSaving}
      />

      <ScheduleTaskEditDialog
        open={showEditModal}
        onOpenChange={setShowEditModal}
        session={editingSession}
        sessionLink={sessionLink}
        onSessionLinkChange={setSessionLink}
        courseName={courseName}
        onCourseNameChange={setCourseName}
        studyDuration={studyDuration}
        onStudyDurationChange={setStudyDuration}
        studyType={studyType}
        onStudyTypeChange={setStudyType}
        questionsTotal={questionsTotal}
        onQuestionsTotalChange={setQuestionsTotal}
        questionsCorrect={questionsCorrect}
        onQuestionsCorrectChange={setQuestionsCorrect}
        questionsError={questionsError}
        onValidateQuestions={validateQuestions}
        currentVideo={currentVideo}
        onCurrentVideoChange={setCurrentVideo}
        studyNotes={studyNotes}
        onStudyNotesChange={setStudyNotes}
        onSave={saveStudySession}
        onStartTimer={startTimerForTask}
      />

            {cycles.length === 0 ? <Card className="rounded-xl border border-border bg-card text-card-foreground shadow-lg hover:shadow-2xl transition-shadow duration-300 overflow-hidden" style={{
      boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.05)'
    }}>
          <CardContent className="text-center p-8">
            <BookOpen className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum ciclo de estudo encontrado</h3>
            <p className="text-muted-foreground mb-4">
              Crie um ciclo de estudos primeiro para poder organizar seu cronograma
            </p>
          </CardContent>
        </Card> : <Card className="rounded-xl border border-border bg-card text-card-foreground shadow-lg hover:shadow-2xl transition-shadow duration-300 overflow-hidden" style={{
      boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.05)'
    }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Cronograma Semanal
              </CardTitle>
              
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!selectedCycle}
                onClick={handleNavigateToDisciplinas}
              >
                Ciclo de Estudos
              </Button>
              <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
              <DialogTrigger asChild>
                <Button variant="default" size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Tarefa
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar Tarefa de Estudo</DialogTitle>
                  <DialogDescription>
                    Adicione uma nova tarefa de estudo ao seu cronograma semanal
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Ciclo de Estudos</label>
                    <Select value={selectedCycle} onValueChange={setSelectedCycle}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um ciclo" />
                      </SelectTrigger>
                      <SelectContent>
                        {cycles.map(cycle => <SelectItem key={cycle.id} value={cycle.id}>
                            {cycle.cycle_name}
                          </SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedCycle && (
                    <ScheduleModePicker
                      value={sessionTimeMode}
                      onChange={setSessionTimeMode}
                      lockedMode={getLockedModeForCycle(selectedCycle)}
                    />
                  )}

                  <div>
                    <label className="text-sm font-medium">Bloco</label>
                    <Select value={selectedBlock} onValueChange={setSelectedBlock}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um bloco" />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableBlocks().map((block: any) => <SelectItem key={block.name} value={block.name}>
                            {block.name}
                          </SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Disciplina</label>
                    <Select value={selectedDiscipline} onValueChange={setSelectedDiscipline}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma disciplina" />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableDisciplines().map((discipline: any) => <SelectItem key={discipline.name} value={discipline.name}>
                            {discipline.name}
                          </SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Dia da Semana</label>
                    <Select value={selectedDay.toString()} onValueChange={value => setSelectedDay(Number(value))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um dia" />
                      </SelectTrigger>
                      <SelectContent>
                        {weekDays.map((day, index) => <SelectItem key={index} value={index.toString()}>
                            {day}
                          </SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Renderização Condicional */}
                  {sessionTimeMode === 'time' ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Horário de Início</label>
                      <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Horário de Fim</label>
                      <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
                    </div>
                  </div>
                  ) : (
                    <div>
                      <label className="text-sm font-medium">Duração (minutos)</label>
                      <Input 
                        type="number" 
                        min="5" 
                        max="480" 
                        step="5"
                        value={durationMinutes} 
                        onChange={e => {
                          const value = Number(e.target.value);
                          if (value >= 5 && value <= 480) {
                            setDurationMinutes(value);
                          }
                        }} 
                        placeholder="60"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Duração entre 5 e 480 minutos (8 horas). Você pode iniciar quando quiser.
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium">Link da Tarefa (opcional)</label>
                    <Input type="url" value={sessionLink} onChange={e => setSessionLink(e.target.value)} placeholder="https://..." />
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowAddModal(false)} className="flex-1">
                      Cancelar
                    </Button>
                    <Button onClick={addSession} className="flex-1">
                      Adicionar
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <WeeklyScheduleBoard
              weekDays={weekDays}
              sessions={sessions}
              cycles={cycles}
              scheduleByCycleId={scheduleByCycleId}
              onReorder={handleScheduleReorder}
              onCardClick={openEditModal}
              loading={sessionDataLoading}
              error={!!sessionDataError}
              onRetry={refreshData}
              renderCard={(session, { dragHandle, onCardClick }) => (
                <WeeklyScheduleTaskCard
                  session={session}
                  sessionData={sessionData[session.id]}
                  dragHandle={dragHandle}
                  onEdit={onCardClick}
                  onEditPlan={(e) => openPlanEditModal(session, e)}
                  onDelete={(e) => {
                    e.stopPropagation();
                    handleDeleteClick(session.id);
                  }}
                />
              )}
            />
          </CardContent>
        </Card>}

      {/* Modal de Detalhes das Tarefas */}
      <Dialog open={showSessionDetailsModal} onOpenChange={setShowSessionDetailsModal}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Tarefas do dia {selectedDate && format(selectedDate, 'dd/MM/yyyy', {
              locale: ptBR
            })}
            </DialogTitle>
            <DialogDescription>
              Visualize e gerencie as tarefas de estudo agendadas para este dia
            </DialogDescription>
            <DialogDescription>
              Detalhes das tarefas de estudo realizadas neste dia
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {selectedDateSessions.length === 0 ? <div className="text-center py-8">
                <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h4 className="text-lg font-medium text-foreground mb-2">Nenhuma tarefa registrada</h4>
                <p className="text-muted-foreground">Este dia não possui tarefas de estudo registradas.</p>
              </div> : selectedDateSessions.map((sessionData, index) => <div key={index} className="border border-border rounded-lg p-4 bg-card">
                  {/* Header do Ciclo */}
                    <div className="flex justify-between items-start mb-3">
                      <div>
                       <h4 className="font-semibold text-foreground">{sessionData.cycle?.name || 'N/A'}</h4>
                       <p className="text-sm text-muted-foreground">
                         {sessionData.cycle?.organ || 'N/A'} - {sessionData.cycle?.position || 'N/A'}
                       </p>
                      </div>
                    <span className="px-2 py-1 text-xs font-medium bg-primary/10 text-primary rounded-full">
                      {sessionData.session.duration ? (
                        <span className="flex items-center gap-1">
                          <Timer className="h-3 w-3" />
                          {formatTaskDurationHours(sessionData.session.duration)}
                        </span>
                      ) : (
                        sessionData.session.startTime && sessionData.session.endTime ? (
                          `${sessionData.session.startTime} - ${sessionData.session.endTime}`
                        ) : (
                          'Horário livre'
                        )
                      )}
                    </span>
                  </div>
                  
                  {/* Matéria, Assunto e Tópico */}
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <BookOpen className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium text-foreground">{sessionData.session.discipline}</span>
                    </div>
                    {sessionData.session.courseName && (
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-4 h-4 flex items-center justify-center">
                          <div className="w-2 h-2 bg-primary rounded-full"></div>
                        </div>
                        <span className="text-sm font-medium text-foreground">Assunto: {sessionData.session.courseName}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 flex items-center justify-center">
                        <div className="w-2 h-2 bg-muted-foreground rounded-full"></div>
                      </div>
                      <span className="text-sm text-muted-foreground">{sessionData.session.topic}</span>
                    </div>
                  </div>
                  
                  {/* Estatísticas */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    <div className="bg-muted rounded-lg p-3 text-center">
                      <div className="text-lg font-semibold text-foreground">{formatTaskDurationHours(sessionData.session.duration)}</div>
                      <div className="text-xs text-muted-foreground">Tempo</div>
                    </div>
                    <div className="bg-muted rounded-lg p-3 text-center">
                      <div className="text-lg font-semibold text-foreground">{sessionData.session.questions}</div>
                      <div className="text-xs text-muted-foreground">Questões</div>
                    </div>
                    <div className="bg-muted rounded-lg p-3 text-center">
                      <div className="text-lg font-semibold text-foreground">{sessionData.session.correct}</div>
                      <div className="text-xs text-muted-foreground">Acertos</div>
                    </div>
                    <div className="bg-muted rounded-lg p-3 text-center">
                      <div className="text-lg font-semibold text-foreground">
                        {Math.round(sessionData.session.correct / sessionData.session.questions * 100)}%
                      </div>
                      <div className="text-xs text-muted-foreground">Taxa</div>
                    </div>
                  </div>
                  
                  {/* Observações */}
                  {sessionData.session.notes && <div className="mb-3">
                      <h5 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                        </svg>
                        Observações
                      </h5>
                      <p className="text-sm text-muted-foreground bg-muted rounded p-3">
                        {sessionData.session.notes}
                      </p>
                    </div>}
                  
                  {/* Botão Ir à Aula */}
                  {sessionData.session.link && <div className="flex justify-end">
                      <Button onClick={() => window.open(sessionData.session.link, '_blank')} className="flex items-center gap-2" size="sm">
                        <ExternalLink className="w-4 h-4" />
                        Ir à Aula
                      </Button>
                    </div>}
                </div>)}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação para remover tarefa */}
      <AlertDialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Remoção</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover esta tarefa do cronograma? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowDeleteConfirmDialog(false);
              setSessionToDelete(null);
            }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (sessionToDelete) {
                  removeSession(sessionToDelete);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>;
};
export default Cronograma;