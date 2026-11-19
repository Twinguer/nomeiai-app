import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Plus, Users, BookOpen, MessageSquare } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CoachGroupsTab, useUserGroups } from '@/modules/community';
import { useToast } from '@/hooks/use-toast';
import {
  BroadcastMessageDialog,
  PendingInvitationsCard,
  StudentCard,
  TeamStatsStrip,
  hasStudentLast7DaysActivity,
  useCoachBroadcastMessage,
  useCoachInvitations,
  useCoachStudents,
  useCoachSubscription,
} from '@/modules/coach';
import { devLog } from '@/utils/productionLogger';
import { UserUrlObfuscationService } from '@/services/userUrlObfuscation';

const CoachDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [broadcastModalOpen, setBroadcastModalOpen] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');

  const {
    subscription,
    isLoadingSubscription,
    canInvite: subscriptionData,
  } = useCoachSubscription();

  const { students, isLoading, removeStudent, isRemovingStudent } = useCoachStudents({
    enabled: !!subscription,
  });

  const {
    pendingInvitations,
    cancelInvitation,
    isCancellingInvitation,
  } = useCoachInvitations();

  useEffect(() => {
    if (subscription === null && !isLoadingSubscription && user) {
      navigate('/coach/subscription');
    }
  }, [subscription, isLoadingSubscription, user, navigate]);

  const hasLast7DaysActivity = hasStudentLast7DaysActivity;

  const studentsWithoutLast7DaysActivity = students.filter((s) => !hasLast7DaysActivity(s));

  const activeStudents = students.filter(s => s.status === 'active').length;

  const handleInviteStudent = () => {
    navigate('/coach/invite');
  };

  const handleViewStudent = async (studentId: string) => {
    try {
      // Gerar URL ofuscada para segurança
      const studentToken = await UserUrlObfuscationService.generateUserToken(studentId);
      navigate(`/coach/student/${studentToken}`);
    } catch (error) {
      devLog.error('Erro ao gerar URL segura:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível acessar o aluno. Tente novamente.',
        variant: 'destructive'
      });
    }
  };

  const handleRemoveStudent = (studentId: string, studentEmail: string) => {
    if (window.confirm(`Tem certeza que deseja remover ${studentEmail} da sua equipe?`)) {
      removeStudent(studentId);
    }
  };

  const broadcastMessageMutation = useCoachBroadcastMessage(students);

  const handleBroadcastMessage = () => {
    const trimmedMessage = broadcastMessage.trim();
    
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

    if (students.length === 0) {
      toast({
        title: 'Nenhum aluno',
        description: 'Você não tem alunos cadastrados para receber a mensagem.',
        variant: 'destructive',
      });
      return;
    }

    broadcastMessageMutation.mutate(trimmedMessage, {
      onSuccess: () => {
        setBroadcastModalOpen(false);
        setBroadcastMessage('');
      },
    });
  };

  const { groups: coachGroups } = useUserGroups(user?.id);

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-purple-100/50 dark:from-purple-950/20 dark:to-purple-900/10">
      <div className="container mx-auto p-6 space-y-6">
      {/* Tabs */}
      <Tabs defaultValue="alunos" className="space-y-6">
        {/* Header com TabsList e Badge */}
        <div className="flex items-center justify-between">
          <TabsList className="bg-purple-100 dark:bg-purple-900/30">
            <TabsTrigger value="alunos" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md">
              <Users className="mr-2 h-4 w-4" />
              Alunos
            </TabsTrigger>
            <TabsTrigger value="grupos" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md">
              <BookOpen className="mr-2 h-4 w-4" />
              Grupos
              {coachGroups.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {coachGroups.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
          <Badge variant="outline" className="bg-gradient-to-r from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700 text-white font-bold shadow-lg shadow-purple-500/50 dark:shadow-purple-900/50 border-2 border-purple-400/30 dark:border-purple-500/30">
            Modo Coach
          </Badge>
        </div>

        {/* Tab: Alunos */}
        <TabsContent value="alunos" className="space-y-6">
          <TeamStatsStrip
            activeStudents={activeStudents}
            inactiveCount={studentsWithoutLast7DaysActivity.length}
            canInvite={subscriptionData}
          />

          <PendingInvitationsCard
            invitations={pendingInvitations}
            onCancel={cancelInvitation}
            isCancelling={isCancellingInvitation}
          />

          {/* Lista de Alunos */}
          <Card className="bg-primary/5 border-primary/20">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle>Seus Alunos</CardTitle>
              <CardDescription>
                {students.length} aluno(s) cadastrado(s)
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button 
                onClick={() => setBroadcastModalOpen(true)}
                variant="outline"
                disabled={students.length === 0}
                className="border-purple-500 text-purple-600 hover:bg-purple-50 hover:border-purple-600 dark:border-purple-400 dark:text-purple-400 dark:hover:bg-purple-900/30"
              >
                <MessageSquare className="mr-2" size={16} />
                Enviar Mensagem
              </Button>
              <Button 
                onClick={handleInviteStudent}
                disabled={!subscriptionData?.can_invite}
                className="bg-purple-600 hover:bg-purple-700 text-white dark:bg-purple-500 dark:hover:bg-purple-600"
              >
                <Plus className="mr-2" size={16} />
                Convidar Aluno
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">
              Carregando...
            </p>
          ) : students.length === 0 ? (
            <div className="text-center py-12">
              <Users className="mx-auto text-muted-foreground mb-4" size={48} />
              <h3 className="text-lg font-semibold mb-2">Nenhum aluno cadastrado</h3>
              <p className="text-muted-foreground mb-4">
                Comece convidando um aluno para sua equipe
              </p>
              <Button 
                onClick={handleInviteStudent}
                className="bg-purple-600 hover:bg-purple-700 text-white dark:bg-purple-500 dark:hover:bg-purple-600"
              >
                <Plus className="mr-2" size={16} />
                Convidar Primeiro Aluno
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {students.map((student) => (
                <StudentCard
                  key={student.student_id}
                  student={student}
                  onView={handleViewStudent}
                  onRemove={handleRemoveStudent}
                  isRemoving={isRemovingStudent}
                />
              ))}
            </div>
          )}
          </CardContent>
          </Card>

          {/* Limite de alunos */}
          {!subscriptionData?.can_invite && subscriptionData?.reason && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Limite de alunos atingido</AlertTitle>
              <AlertDescription>
                {subscriptionData.reason}. Faça upgrade do seu plano para adicionar mais alunos.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        {/* Tab: Grupos */}
        <TabsContent value="grupos">
          <CoachGroupsTab />
        </TabsContent>
      </Tabs>

      <BroadcastMessageDialog
        open={broadcastModalOpen}
        onOpenChange={setBroadcastModalOpen}
        message={broadcastMessage}
        onMessageChange={setBroadcastMessage}
        studentCount={students.length}
        onSend={handleBroadcastMessage}
        isSending={broadcastMessageMutation.isPending}
      />
      </div>
    </div>
  );
};

export default CoachDashboard;

