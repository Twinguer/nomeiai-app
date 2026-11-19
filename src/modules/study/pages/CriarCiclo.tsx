import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateId } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X, Edit, BookOpen, Calendar, CheckCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useStudyCyclesV2 } from '../hooks/useStudyCyclesV2';
import { toast } from 'sonner';
import { useStudyProAccess } from '../hooks/useStudyProAccess';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';
import { UserUrlObfuscationService } from '@/services/userUrlObfuscation';
import { SortableBlocksList } from '../components/SortableBlocksList';
import { CYCLE_FORM_LIMITS, clampCycleText } from '../domain/cycleFormLimits';
interface Discipline {
  id: string;
  name: string;
  status: 'em-andamento' | 'finalizada' | 'em-revisao';
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

// Interface simplificada para compatibilidade com createStudyCycleV2
interface SimpleDiscipline {
  id: string;
  name: string;
}
interface Block {
  id: string;
  name: string;
  disciplines: Discipline[];
}

interface CriarCicloProps {
  coachMode?: boolean;
  targetStudentId?: string;
  onSuccess?: () => void;
}

const CriarCiclo = ({ coachMode, targetStudentId, onSuccess }: CriarCicloProps = {}) => {
  const { user } = useAuth();
  const { createCycle } = useStudyCyclesV2();
  const { canAccessStudyPro, isLoading: isLoadingStudyAccess } = useStudyProAccess();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

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
    status: 'em-andamento',
    studyTime: 0,
    questionsResolved: 0,
    correctAnswers: 0,
    wrongAnswers: 0,
    courseProgress: '',
    studyType: 'pdf',
    currentPage: 0,
    currentVideo: '',
    isCompleted: false,
    notes: ''
  });
  const addBlock = () => {
    const newBlock: Block = {
      id: generateId(),
      name: `Matéria ${blocks.length + 1}`,
      disciplines: []
    };
    setBlocks([...blocks, newBlock]);
  };
  const removeBlock = (blockId: string) => {
    setBlocks(blocks.filter(block => block.id !== blockId));
  };
  const updateBlockName = (blockId: string, name: string) => {
    setBlocks(blocks.map(block => block.id === blockId ? {
      ...block,
      name
    } : block));
  };
  const openDisciplineDialog = (blockId: string, discipline?: Discipline) => {
    setEditingDiscipline({
      blockId,
      discipline
    });
    if (discipline) {
      setDisciplineForm({ name: discipline.name, status: discipline.status });
    } else {
      setDisciplineForm({
        name: '',
        status: 'em-andamento'
      });
    }
  };
  const saveDiscipline = () => {
    if (!editingDiscipline || !disciplineForm.name) return;
    const discipline: Discipline = {
      id: editingDiscipline.discipline?.id || generateId(),
      name: clampCycleText(disciplineForm.name!, CYCLE_FORM_LIMITS.disciplineName),
      status: disciplineForm.status || 'em-andamento',
      studyTime: 0,
      questionsResolved: 0,
      correctAnswers: 0,
      wrongAnswers: 0,
      courseProgress: '',
      studyType: 'pdf',
      currentPage: 0,
      currentVideo: '',
      isCompleted: false,
      notes: ''
    };
    setBlocks(blocks.map(block => {
      if (block.id === editingDiscipline.blockId) {
        if (editingDiscipline.discipline) {
          // Edit existing
          return {
            ...block,
            disciplines: block.disciplines.map(d => d.id === discipline.id ? discipline : d)
          };
        } else {
          // Add new
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
    setBlocks(blocks.map(block => block.id === blockId ? {
      ...block,
      disciplines: block.disciplines.filter(d => d.id !== disciplineId)
    } : block));
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
    const userId = coachMode ? targetStudentId : user?.id;

    const trimmedCycleName = clampCycleText(cycleName, CYCLE_FORM_LIMITS.cycleName);
    const trimmedOrgan = clampCycleText(organ, CYCLE_FORM_LIMITS.organ);
    const trimmedPosition = clampCycleText(position, CYCLE_FORM_LIMITS.position);

    if (!userId || !trimmedCycleName || !trimmedOrgan || !trimmedPosition || !examDate) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    // Em modo aluno, plano Pro é validado no render; em modo coach, o gate coach já validou acesso

    // Converter blocos para formato simplificado compatível com createStudyCycleV2
    const simplifiedBlocks = blocks.map(block => ({
      id: block.id,
      name: clampCycleText(block.name, CYCLE_FORM_LIMITS.blockName),
      disciplines: block.disciplines.map(discipline => ({
        id: discipline.id,
        name: clampCycleText(discipline.name, CYCLE_FORM_LIMITS.disciplineName),
      })),
    }));

    setLoading(true);
    try {
      const newCycle = await createCycle({
        cycle_name: trimmedCycleName,
        exam_date: examDate,
        organ: trimmedOrgan,
        position: trimmedPosition,
        edital_link: '',
        curso_link: '',
        video_link: '',
        blocks: simplifiedBlocks,
        userId: userId // Passar userId do aluno quando for coach
      });

      if (newCycle) {
        devLog.log('✅ Ciclo criado com sucesso:', newCycle);
        toast.success('Ciclo de estudos criado com sucesso!');
        
        // Usar callback ou navegação padrão
        if (onSuccess) {
          onSuccess();
        } else if (coachMode) {
          await navigateBackFromCoach();
        } else {
          navigate('/estudos');
        }
      }
    } catch (error) {
      devLog.error('Error creating study cycle:', error);
      toast.error('Erro ao criar ciclo de estudos');
    } finally {
      setLoading(false);
    }
  };
  const navigateBackFromCoach = async () => {
    if (!targetStudentId) {
      navigate('/coach/dashboard');
      return;
    }
    try {
      const studentToken = await UserUrlObfuscationService.generateUserToken(targetStudentId);
      navigate(`/coach/student/${studentToken}`);
    } catch {
      navigate('/coach/dashboard');
    }
  };

  const daysUntilExam = calculateDaysUntilExam();

  // Plano Pro do aluno — não aplicar ao coach criando ciclo para o aluno
  const requiresStudentPro = !coachMode;

  React.useEffect(() => {
    if (!requiresStudentPro) return;
    if (!isLoadingStudyAccess && !canAccessStudyPro) {
      toast.error(
        'Ciclos de estudo exigem plano Pro ou assinatura Modo Coach ativa.'
      );
      navigate('/planos');
    }
  }, [requiresStudentPro, canAccessStudyPro, isLoadingStudyAccess, navigate]);

  if (requiresStudentPro && (isLoadingStudyAccess || !canAccessStudyPro)) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-center items-center py-8">
          <div className="text-center">
            <Loader2 className="mx-auto h-12 w-12 text-muted-foreground mb-4 animate-spin" />
            <p className="text-muted-foreground">
              {isLoadingStudyAccess ? 'Carregando...' : 'Redirecionando...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {coachMode ? 'Criar Ciclo para Aluno' : 'Criar Ciclo de Estudos'}
          </h1>
          <p className="text-muted-foreground">Organize seus estudos em blocos e disciplinas</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => {
              if (coachMode && targetStudentId) {
                void navigateBackFromCoach();
              } else {
                navigate('/estudos');
              }
            }}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar Ciclo'}
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
                <Input id="cycleName" value={cycleName} onChange={e => setCycleName(e.target.value)} placeholder="Ex: Concurso TJDFT 2024" maxLength={CYCLE_FORM_LIMITS.cycleName} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="organ">Nome do Órgão *</Label>
                <Input id="organ" value={organ} onChange={e => setOrgan(e.target.value)} placeholder="Ex: Tribunal de Justiça do DF" maxLength={CYCLE_FORM_LIMITS.organ} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="position">Nome do Cargo *</Label>
                <Input id="position" value={position} onChange={e => setPosition(e.target.value)} placeholder="Ex: Analista Judiciário" maxLength={CYCLE_FORM_LIMITS.position} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="examDate">Data da Prova *</Label>
                <Input id="examDate" type="date" value={examDate} onChange={e => setExamDate(e.target.value)} />
              </div>
            </div>
            {daysUntilExam !== null && <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <Calendar className="h-4 w-4" />
                <span className="text-sm">
                  {daysUntilExam > 0 ? `${daysUntilExam} dias até a prova` : daysUntilExam === 0 ? 'Prova é hoje!' : 'Prova já passou'}
                </span>
              </div>}
          </CardContent>
        </Card>

        {/* Blocos de Estudos */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Edital Verticalizado</CardTitle>
              </div>
              <Button onClick={addBlock}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Matéria
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {blocks.length === 0 ? (
              <div className="text-center p-8 border-2 border-dashed border-muted rounded-lg">
                <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma matéria criada</h3>
                <p className="text-muted-foreground mb-4">
                  Crie sua primeira matéria para organizar seus tópicos
                </p>
                <Button onClick={addBlock}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeira Matéria
                </Button>
              </div>
            ) : (
              <SortableBlocksList
                blocks={blocks}
                onChange={setBlocks}
                disciplineLabel="tópico(s)"
                addButtonLabel="Tópico"
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
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              Adicionar Tópico
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Input 
                id="disciplineName" 
                value={disciplineForm.name} 
                onChange={e => setDisciplineForm({
                  ...disciplineForm,
                  name: e.target.value
                })} 
                placeholder="Ex: Art. 5º" 
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
    </div>;
};

export default CriarCiclo;
