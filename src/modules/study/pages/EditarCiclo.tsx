// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { generateId } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Edit, BookOpen, CheckCircle, Calendar } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { UserStudyService } from '@/services/userStudyService';
import { getScheduleSessions } from '../domain/scheduleHelpers';
import { StudyCycleV2 } from '@/types/userStudy';
import { toast } from 'sonner';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';
import { SortableBlocksList } from '../components/SortableBlocksList';
import { CYCLE_FORM_LIMITS, clampCycleText } from '../domain/cycleFormLimits';

interface Discipline {
  id: string;
  name: string;
  status: 'em-andamento' | 'em-revisao';
  studyTime: number;
  questionsResolved: number;
  correctAnswers: number;
  wrongAnswers: number;
  courseProgress: string;
  studyType: 'pdf' | 'video';
  currentPage?: number;
  currentVideo?: string;
  isCompleted: boolean;
  notes: string;
}

interface Block {
  id: string;
  name: string;
  disciplines: Discipline[];
}

interface EditarCicloProps {
  cycleId?: string;
  secureToken?: string;
}

const EditarCiclo: React.FC<EditarCicloProps> = ({ cycleId, secureToken }) => {
  const { id: urlId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Usar cycleId da prop ou do URL
  const id = cycleId || urlId;
  const [loading, setLoading] = useState(false);
  const [loadingCycle, setLoadingCycle] = useState(true);

  // Form data
  const [cycleName, setCycleName] = useState('');
  const [organ, setOrgan] = useState('');
  const [position, setPosition] = useState('');
  const [examDate, setExamDate] = useState('');
  const [blocks, setBlocks] = useState<Block[]>([]);

  // Dialog states
  const [editingDiscipline, setEditingDiscipline] = useState<{
    blockId: string;
    discipline?: Discipline;
  } | null>(null);
  const [disciplineForm, setDisciplineForm] = useState<Partial<Discipline>>({
    name: '',
    status: 'em-andamento'
  });

  useEffect(() => {
    if (id && user) {
      fetchCycle();
    }
  }, [id, user]);

  const fetchCycle = async () => {
    try {
      const userStudyData = await UserStudyService.getUserStudyData(user?.id);
      if (userStudyData) {
        const cycle = userStudyData.study_cycles.find(c => c.id === id);
        if (cycle) {
          setCycleName(cycle.cycle_name);
          setOrgan(cycle.organ || '');
          setPosition(cycle.position || '');
          setExamDate(cycle.exam_date);
          
          // Usar available_blocks se existir, senão extrair do weekly_schedule
          if (cycle.schedule_data?.available_blocks && cycle.schedule_data.available_blocks.length > 0) {
            // Converter available_blocks para o formato Block usado no componente
            const loadedBlocks: Block[] = cycle.schedule_data.available_blocks.map(block => ({
              id: block.id,
              name: block.name,
              disciplines: block.disciplines.map(disc => ({
                id: disc.id,
                name: disc.name,
                status: 'em-andamento' as const,
                studyTime: 0,
                questionsResolved: 0,
                correctAnswers: 0,
                wrongAnswers: 0,
                courseProgress: '',
                studyType: 'pdf' as const,
                isCompleted: false,
                notes: ''
              }))
            }));
            setBlocks(loadedBlocks);
          } else {
            // Fallback: extrair disciplinas do cronograma (study_schedule ou weekly_schedule legado)
            const blocksMap = new Map<string, Block>();

            getScheduleSessions(userStudyData, cycle.id).forEach((session) => {
              if (session.block_name && session.discipline_name) {
                if (!blocksMap.has(session.block_name)) {
                  blocksMap.set(session.block_name, {
                    id: generateId(),
                    name: session.block_name,
                    disciplines: [],
                  });
                }

                const block = blocksMap.get(session.block_name)!;
                const existingDiscipline = block.disciplines.find(
                  (d) => d.name === session.discipline_name
                );

                if (!existingDiscipline) {
                  const discipline: Discipline = {
                      id: generateId(),
                      name: session.discipline_name,
                      status: 'em-andamento',
                      studyTime: (session.total_stats?.total_duration_minutes || 0) / 60,
                      questionsResolved: session.total_stats?.total_questions || 0,
                      correctAnswers: session.total_stats?.total_correct || 0,
                      wrongAnswers: (session.total_stats?.total_questions || 0) - (session.total_stats?.total_correct || 0),
                      courseProgress: '',
                      studyType: 'pdf',
                      isCompleted: false,
                      notes: ''
                    };
                    block.disciplines.push(discipline);
                  } else {
                    // Atualizar stats da disciplina existente
                    existingDiscipline.studyTime += (session.total_stats?.total_duration_minutes || 0) / 60;
                    existingDiscipline.questionsResolved += session.total_stats?.total_questions || 0;
                    existingDiscipline.correctAnswers += session.total_stats?.total_correct || 0;
                    existingDiscipline.wrongAnswers += (session.total_stats?.total_questions || 0) - (session.total_stats?.total_correct || 0);
                  }
                }
            });

            setBlocks(Array.from(blocksMap.values()));
          }
        } else {
          toast.error('Ciclo não encontrado');
          navigate('/estudos');
        }
      } else {
        toast.error('Dados de estudo não encontrados');
        navigate('/estudos');
      }
    } catch (error) {
      devLog.error('Error fetching cycle:', error);
      toast.error('Erro ao carregar ciclo de estudos');
      navigate('/estudos');
    } finally {
      setLoadingCycle(false);
    }
  };

  const addBlock = () => {
    const newBlock: Block = {
      id: generateId(),
      name: `Bloco ${blocks.length + 1}`,
      disciplines: []
    };
    setBlocks([...blocks, newBlock]);
  };

  const removeBlock = (blockId: string) => {
    setBlocks(blocks.filter(block => block.id !== blockId));
  };

  const updateBlockName = (blockId: string, name: string) => {
    setBlocks(blocks.map(block => 
      block.id === blockId ? { ...block, name } : block
    ));
  };

  const openDisciplineDialog = (blockId: string, discipline?: Discipline) => {
    setEditingDiscipline({ blockId, discipline });
    if (discipline) {
      setDisciplineForm({ name: discipline.name, status: discipline.status });
    } else {
      setDisciplineForm({ name: '', status: 'em-andamento' });
    }
  };

  const saveDiscipline = () => {
    if (!editingDiscipline || !disciplineForm.name) return;
    
    const discipline: Discipline = {
      id: editingDiscipline.discipline?.id || generateId(),
      name: clampCycleText(disciplineForm.name!, CYCLE_FORM_LIMITS.disciplineName),
      status: disciplineForm.status || 'em-andamento',
      studyTime: editingDiscipline.discipline?.studyTime || 0,
      questionsResolved: editingDiscipline.discipline?.questionsResolved || 0,
      correctAnswers: editingDiscipline.discipline?.correctAnswers || 0,
      wrongAnswers: editingDiscipline.discipline?.wrongAnswers || 0,
      courseProgress: editingDiscipline.discipline?.courseProgress || '',
      studyType: editingDiscipline.discipline?.studyType || 'pdf',
      currentPage: editingDiscipline.discipline?.currentPage,
      currentVideo: editingDiscipline.discipline?.currentVideo,
      isCompleted: editingDiscipline.discipline?.isCompleted || false,
      notes: editingDiscipline.discipline?.notes || ''
    };

    setBlocks(blocks.map(block => {
      if (block.id === editingDiscipline.blockId) {
        if (editingDiscipline.discipline) {
          return {
            ...block,
            disciplines: block.disciplines.map(d => 
              d.id === discipline.id ? discipline : d
            )
          };
        } else {
          return {
            ...block,
            disciplines: [...block.disciplines, discipline]
          };
        }
      }
      return block;
    }));
    setEditingDiscipline(null);
  };

  const removeDiscipline = (blockId: string, disciplineId: string) => {
    setBlocks(blocks.map(block => 
      block.id === blockId 
        ? { ...block, disciplines: block.disciplines.filter(d => d.id !== disciplineId) }
        : block
    ));
  };

  const calculateDaysUntilExam = () => {
    if (!examDate) return null;
    const today = new Date();
    const exam = new Date(examDate);
    const diffTime = exam.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const handleSubmit = async () => {
    const trimmedCycleName = clampCycleText(cycleName, CYCLE_FORM_LIMITS.cycleName);
    const trimmedOrgan = clampCycleText(organ, CYCLE_FORM_LIMITS.organ);
    const trimmedPosition = clampCycleText(position, CYCLE_FORM_LIMITS.position);

    if (!user || !trimmedCycleName || !trimmedOrgan || !trimmedPosition || !examDate) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setLoading(true);
    try {
      // Buscar ciclo atual para preservar schedule_data existente
      const userStudyData = await UserStudyService.getUserStudyData(user.id);
      const currentCycle = userStudyData?.study_cycles.find(c => c.id === id);
      
      if (!currentCycle) {
        toast.error('Ciclo não encontrado');
        setLoading(false);
        return;
      }

      // Converter blocos para o formato available_blocks
      const availableBlocks = blocks.map(block => ({
        id: block.id,
        name: clampCycleText(block.name, CYCLE_FORM_LIMITS.blockName),
        disciplines: block.disciplines.map(disc => ({
          id: disc.id,
          name: clampCycleText(disc.name, CYCLE_FORM_LIMITS.disciplineName),
        })),
      }));

      // Criar available_disciplines a partir dos blocos
      const availableDisciplines = blocks.flatMap(block =>
        block.disciplines.map(disc => ({
          id: disc.id,
          name: clampCycleText(disc.name, CYCLE_FORM_LIMITS.disciplineName),
          block_name: clampCycleText(block.name, CYCLE_FORM_LIMITS.blockName),
        }))
      );

      // Preservar schedule_data existente e atualizar apenas available_blocks e available_disciplines
      const updatedScheduleData = {
        ...currentCycle.schedule_data,
        available_blocks: availableBlocks,
        available_disciplines: availableDisciplines
      };

      const success = await UserStudyService.updateCycle(user.id, id, {
        cycle_name: trimmedCycleName,
        organ: trimmedOrgan,
        position: trimmedPosition,
        exam_date: examDate,
        edital_link: currentCycle.edital_link || '',
        curso_link: currentCycle.curso_link || '',
        video_link: currentCycle.video_link || '',
        schedule_data: updatedScheduleData
      });

      if (success) {
        toast.success('Ciclo de estudos atualizado com sucesso!');
        navigate('/estudos');
      } else {
        toast.error('Erro ao atualizar ciclo de estudos');
      }
    } catch (error) {
      devLog.error('Error updating study cycle:', error);
      toast.error('Erro ao atualizar ciclo de estudos');
    } finally {
      setLoading(false);
    }
  };

  if (loadingCycle) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-64"></div>
          <div className="h-48 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  const daysUntilExam = calculateDaysUntilExam();

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Editar Ciclo de Estudos</h1>
          <p className="text-muted-foreground">Atualize suas informações de estudo</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/estudos')}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Informações Básicas */}
        <Card>
          <CardHeader>
            <CardTitle>Informações Básicas</CardTitle>
            <CardDescription>
              Dados principais do seu ciclo de estudos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cycleName">Nome do Ciclo *</Label>
                <Input 
                  id="cycleName" 
                  value={cycleName} 
                  onChange={e => setCycleName(e.target.value)} 
                  placeholder="Ex: Concurso TJDFT 2024" 
                  maxLength={CYCLE_FORM_LIMITS.cycleName}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="organ">Nome do Órgão *</Label>
                <Input 
                  id="organ" 
                  value={organ} 
                  onChange={e => setOrgan(e.target.value)} 
                  placeholder="Ex: Tribunal de Justiça do DF" 
                  maxLength={CYCLE_FORM_LIMITS.organ}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="position">Nome do Cargo *</Label>
                <Input 
                  id="position" 
                  value={position} 
                  onChange={e => setPosition(e.target.value)} 
                  placeholder="Ex: Analista Judiciário" 
                  maxLength={CYCLE_FORM_LIMITS.position}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="examDate">Data da Prova *</Label>
                <Input 
                  id="examDate" 
                  type="date" 
                  value={examDate} 
                  onChange={e => setExamDate(e.target.value)} 
                />
              </div>
            </div>
            {daysUntilExam !== null && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <Calendar className="h-4 w-4" />
                <span className="text-sm">
                  {daysUntilExam > 0 
                    ? `${daysUntilExam} dias até a prova` 
                    : daysUntilExam === 0 
                    ? 'Prova é hoje!' 
                    : 'Prova já passou'
                  }
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Blocos de Estudos */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Blocos e Disciplinas</CardTitle>
                <CardDescription>
                  Organize suas disciplinas em blocos temáticos
                </CardDescription>
              </div>
              <Button onClick={addBlock}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Bloco
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {blocks.length === 0 ? (
              <div className="text-center p-8 border-2 border-dashed border-muted rounded-lg">
                <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhum bloco criado</h3>
                <p className="text-muted-foreground mb-4">
                  Crie seu primeiro bloco para organizar suas disciplinas
                </p>
                <Button onClick={addBlock}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeiro Bloco
                </Button>
              </div>
            ) : (
              <SortableBlocksList
                blocks={blocks}
                onChange={setBlocks}
                onAddDiscipline={openDisciplineDialog}
                onEditDiscipline={(blockId, discipline) => openDisciplineDialog(blockId, discipline)}
                onRemoveDiscipline={removeDiscipline}
                onRemoveBlock={removeBlock}
                onUpdateBlockName={updateBlockName}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog para Disciplina */}
      <Dialog open={!!editingDiscipline} onOpenChange={open => !open && setEditingDiscipline(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              {editingDiscipline?.discipline ? 'Editar' : 'Adicionar'} Disciplina
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="disciplineName">Nome da Disciplina *</Label>
              <Input 
                id="disciplineName" 
                value={disciplineForm.name} 
                onChange={e => setDisciplineForm({
                  ...disciplineForm,
                  name: e.target.value
                })} 
                placeholder="Ex: Direito Constitucional" 
                maxLength={CYCLE_FORM_LIMITS.disciplineName}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setEditingDiscipline(null)}>
                Cancelar
              </Button>
              <Button onClick={saveDiscipline} disabled={!disciplineForm.name}>
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EditarCiclo;
