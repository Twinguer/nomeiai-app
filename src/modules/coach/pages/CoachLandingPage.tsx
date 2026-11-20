import React, { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCoachSubscription } from '@/modules/coach';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getPublicProfileImageUrl } from '@/utils/avatarUtils';
import { 
  Users, 
  Clock, 
  CheckCircle, 
  TrendingUp, 
  Award, 
  Target, 
  BarChart3,
  ArrowRight,
  GraduationCap
} from 'lucide-react';

// ✅ URLs fixas de imagens dos alunos (página estática)
// Estas URLs são fixas e não serão mais buscadas dinamicamente do banco
const FIXED_STUDENT_AVATARS = [
  '4b9ecf9f-b879-4829-8163-ae067cecc7b9-1761345968173.webp',
  '0879c62f-d249-43e3-afb8-d27815f0dc7d-1761345878169.jpg',
  '4537e00f-83da-43ab-a40c-b5902f93df7b-1761345932276.webp',
  '765c3446-21fb-4543-8e19-606fdbc7195f-1761346854902.png',
  'f17e9fef-935f-4f05-9a30-fad60c291738-1761346754007.png',
  'c77a01a1-e6a4-4910-93e8-0452d52f1fd6-1761346191513.png',
  '97edb2ba-4155-4fcf-9af5-a108735008a2-1761346040437.webp',
  'a9470e4e-4213-4563-adaf-c180cafe19fe-1761346153725.jpg',
  'd72f5b3f-4a5e-4b20-b560-ac8ecd4caff6-1761346697582.png',
  'a375cc6a-62c9-4a5a-a31b-17bc5d11bc77-1761346527953.png',
].map(getPublicProfileImageUrl);

// Dados fictícios dos alunos (mantidos para marketing) - agora com imagens fixas
const mockStudentData = [
  { name: 'Ana Silva', hours: 42, tasks: 156, accuracy: 87, status: 'Ativo', avatar: FIXED_STUDENT_AVATARS[0] },
  { name: 'Carlos Oliveira', hours: 38, tasks: 142, accuracy: 82, status: 'Ativo', avatar: FIXED_STUDENT_AVATARS[1] },
  { name: 'Maria Santos', hours: 45, tasks: 168, accuracy: 91, status: 'Ativo', avatar: FIXED_STUDENT_AVATARS[2] },
  { name: 'João Pereira', hours: 35, tasks: 128, accuracy: 79, status: 'Ativo', avatar: FIXED_STUDENT_AVATARS[3] },
  { name: 'Fernanda Costa', hours: 40, tasks: 152, accuracy: 85, status: 'Ativo', avatar: FIXED_STUDENT_AVATARS[4] },
  { name: 'Ricardo Alves', hours: 33, tasks: 118, accuracy: 76, status: 'Ativo', avatar: FIXED_STUDENT_AVATARS[5] },
  { name: 'Juliana Lima', hours: 48, tasks: 175, accuracy: 89, status: 'Ativo', avatar: FIXED_STUDENT_AVATARS[6] },
  { name: 'Pedro Souza', hours: 36, tasks: 135, accuracy: 81, status: 'Ativo', avatar: FIXED_STUDENT_AVATARS[7] },
  { name: 'Larissa Ferreira', hours: 44, tasks: 162, accuracy: 88, status: 'Ativo', avatar: FIXED_STUDENT_AVATARS[8] },
  { name: 'Bruno Rodrigues', hours: 39, tasks: 148, accuracy: 84, status: 'Ativo', avatar: FIXED_STUDENT_AVATARS[9] },
];

const CoachLandingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { subscription } = useCoachSubscription({ fetchCanInvite: false });

  // ✅ Dados estáticos dos alunos (2 linhas = 10 alunos)
  // Página agora é completamente estática, sem busca dinâmica do banco
  const studentsWithRealPhotos = useMemo(() => {
    return mockStudentData.slice(0, 10).map((student, index) => ({
      ...student,
      id: `student-${index + 1}`,
    }));
  }, []);

  // Estatísticas agregadas
  const totalHours = studentsWithRealPhotos.reduce((sum, s) => sum + s.hours, 0);
  const totalTasks = studentsWithRealPhotos.reduce((sum, s) => sum + s.tasks, 0);
  const avgAccuracy = Math.round(studentsWithRealPhotos.reduce((sum, s) => sum + s.accuracy, 0) / studentsWithRealPhotos.length);
  const activeStudents = studentsWithRealPhotos.filter(s => s.status === 'Ativo').length;

  // Redirecionar para dashboard se já tiver assinatura
  useEffect(() => {
    if (subscription && user) {
      navigate('/coach/dashboard', { replace: true });
    }
  }, [subscription, user, navigate]);

  const handleGetStarted = () => {
    if (user) {
      navigate('/coach/subscription');
    } else {
      navigate('/auth');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-purple-100/50 dark:from-purple-950/20 dark:to-purple-900/10">
      {/* Hero Section */}
      <div className="container mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700 text-white font-bold text-lg shadow-lg shadow-purple-500/50 dark:shadow-purple-900/50 mb-6 border-2 border-purple-400/30 dark:border-purple-500/30">
            <GraduationCap className="h-6 w-6" />
            <span>Modo Coach</span>
          </div>
          <h1 className="text-5xl font-bold mb-4 text-purple-600 dark:text-purple-400 drop-shadow-lg shadow-purple-500/50 dark:shadow-purple-400/50">
            Transforme o Sucesso dos Seus Alunos
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Gerencie uma equipe de alunos, acompanhe o progresso em tempo real e alcance resultados extraordinários juntos.
          </p>
          <Button size="lg" onClick={handleGetStarted} className="text-lg px-8 py-6">
            Começar Agora
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>

        {/* Título Coach Dashboard */}
        <div className="text-left mb-8">
          <h2 className="text-4xl font-bold mb-2">Coach Dashboard</h2>
        </div>

        {/* Estatísticas Gerais */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardDescription className="text-sm font-medium">Total de Alunos</CardDescription>
                <Users className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-4xl font-bold text-primary">{activeStudents}</CardTitle>
            </CardHeader>
          </Card>

          <Card className="border-2 border-green-500/20 bg-gradient-to-br from-green-500/5 to-green-500/10">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardDescription className="text-sm font-medium">Horas Estudadas</CardDescription>
                <Clock className="h-5 w-5 text-green-600" />
              </div>
              <CardTitle className="text-4xl font-bold text-green-600">{totalHours}h</CardTitle>
              <CardDescription className="text-xs mt-2">Esta semana</CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-blue-500/10">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardDescription className="text-sm font-medium">Tarefas Completadas</CardDescription>
                <CheckCircle className="h-5 w-5 text-blue-600" />
              </div>
              <CardTitle className="text-4xl font-bold text-blue-600">{totalTasks}</CardTitle>
              <CardDescription className="text-xs mt-2">Total registrado</CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-purple-500/10">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardDescription className="text-sm font-medium">Taxa de Acerto</CardDescription>
                <Target className="h-5 w-5 text-purple-600" />
              </div>
              <CardTitle className="text-4xl font-bold text-purple-600">{avgAccuracy}%</CardTitle>
              <CardDescription className="text-xs mt-2">Média geral</CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Seção de Alunos */}
        <Card className="mb-12">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-3xl font-bold mb-2">Meus Alunos</CardTitle>
                <CardDescription className="text-lg">
                  {studentsWithRealPhotos.length} alunos cadastrados
                </CardDescription>
              </div>
              <Badge variant="secondary" className="text-lg px-4 py-2">
                {activeStudents} Alunos Ativos
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {studentsWithRealPhotos.map((student) => (
                <Card 
                  key={student.id}
                  className="hover:shadow-lg transition-all duration-200 border-2 hover:border-primary/30"
                >
                  <CardContent className="p-5 flex flex-col items-center text-center">
                    <Avatar className="h-20 w-20 mb-3 border-2 border-primary/20 shadow-lg">
                      <AvatarImage src={student.avatar} alt={student.name} />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-white font-bold text-lg">
                        {student.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <h3 className="font-semibold text-base mb-2">{student.name}</h3>
                    <Badge variant={student.status === 'Ativo' ? 'default' : 'secondary'} className="mb-3">
                      {student.status}
                    </Badge>
                    <div className="space-y-2 w-full">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Horas
                        </span>
                        <span className="font-bold text-primary">{student.hours}h</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Tarefas
                        </span>
                        <span className="font-bold text-green-600">{student.tasks}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Target className="h-3 w-3" />
                          Acerto
                        </span>
                        <span className="font-bold text-purple-600">{student.accuracy}%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                ))}
              </div>
          </CardContent>
        </Card>

        {/* Benefícios */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card className="border-2">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Acompanhamento em Tempo Real</CardTitle>
              <CardDescription>
                Monitore horas estudadas, tarefas completadas e taxa de acerto de cada aluno em tempo real.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center mb-4">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <CardTitle>Comunicação Direta</CardTitle>
              <CardDescription>
                Envie mensagens personalizadas para alunos individuais ou para toda a equipe com um clique.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-purple-500/10 flex items-center justify-center mb-4">
                <Award className="h-6 w-6 text-purple-600" />
              </div>
              <CardTitle>Gestão Completa</CardTitle>
              <CardDescription>
                Crie ciclos de estudos, gerencie cronogramas e acompanhe o progresso de todos os seus alunos em um só lugar.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CoachLandingPage;
