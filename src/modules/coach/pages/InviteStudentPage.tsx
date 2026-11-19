import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  useCoachInviteUserSearch,
  useCoachSubscription,
  useSendCoachInvitation,
} from '@/modules/coach';
import { ArrowLeft, Send, Search, User } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';
import { getAvatarUrl } from '@/utils/avatarUtils';
import { formatPublicNicknameHandle } from '@/utils/nicknameUtils';

const InviteStudentPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [studentNickname, setStudentNickname] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const { subscription } = useCoachSubscription({ fetchCanInvite: false });
  const { data: searchResults = [], isLoading: isSearching } =
    useCoachInviteUserSearch(debouncedSearchQuery);
  const sendInvitationMutation = useSendCoachInvitation();

  const handleInviteStudent = async () => {
    if (!user?.id) return;
    
    const nicknameToUse = selectedUser?.nickname || studentNickname;
    
    if (!nicknameToUse) {
      toast({
        title: 'Nickname necessário',
        description: 'Por favor, informe o nickname do aluno ou selecione um usuário',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);

    try {
      await sendInvitationMutation.mutateAsync({
        nickname: nicknameToUse,
        message: message || null,
      });

      const studentName = selectedUser?.name || nicknameToUse;
      toast({
        title: 'Convite enviado!',
        description: `${studentName} recebeu seu convite por email e notificação`,
      });

      navigate('/coach/dashboard');
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Erro ao enviar convite';

      if (errorMsg.includes('convite pendente')) {
        toast({
          title: 'Convite já enviado',
          description:
            'Este aluno já possui um convite pendente. Você pode cancelá-lo e reenviar.',
          variant: 'default',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectUser = React.useCallback((user: any) => {
    devLog.log('Selecionando usuário - objeto completo:', user);
    devLog.log('Nickname do usuário:', user?.nickname);
    devLog.log('ID do usuário:', user?.id);
    devLog.log('Nome do usuário:', user?.name);
    
    // Verificar se o usuário existe
    if (!user || !user.id) {
      devLog.error('Usuário inválido - sem ID:', user);
      toast({
        title: 'Erro',
        description: 'Usuário inválido. Tente novamente.',
        variant: 'destructive'
      });
      return;
    }
    
    // Se não tem nickname, tentar gerar um baseado no nome
    let nicknameToUse = user.nickname;
    
    if (!nicknameToUse || nicknameToUse.trim() === '') {
      // Gerar nickname baseado no nome
      const nameClean = (user.name || user.email || 'user')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 20);
      
      nicknameToUse = nameClean || `user${user.id.substring(0, 8)}`;
      
      devLog.log('Nickname gerado:', nicknameToUse);
    }
    
    setSelectedUser({
      ...user,
      nickname: nicknameToUse
    });
    setStudentNickname(nicknameToUse);
    setSearchQuery('');
    
    toast({
      title: 'Usuário selecionado',
      description: `${user.name || 'Usuário'} (@${nicknameToUse}) foi selecionado`,
    });
  }, [toast]);

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/coach/dashboard')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Convidar Aluno</h1>
          <p className="text-muted-foreground">
            Adicione um aluno à sua equipe para acompanhar seus estudos
          </p>
        </div>
      </div>

      {/* Info sobre assinatura */}
      {subscription && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Seu Plano: {subscription.plan_type}</CardTitle>
            <CardDescription>
              {subscription.current_students} de {subscription.max_students} alunos cadastrados
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Formulário de Convite */}
      <Card>
        <CardHeader>
          <CardTitle>Informações do Aluno</CardTitle>
          <CardDescription>
            Digite o nickname do aluno ou busque na lista abaixo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Busca de usuários */}
          <div className="space-y-2">
            <Label htmlFor="search">Buscar Aluno</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                type="text"
                placeholder="Digite o nome ou @nickname do aluno..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={isLoading}
                className="pl-10"
              />
            </div>
            
            {/* Resultados da busca */}
            {searchQuery && searchResults.length > 0 && !selectedUser && (
              <div className="border rounded-lg max-h-60 overflow-y-auto mt-2 bg-background shadow-lg relative z-10">
                {searchResults.map((user: any) => (
                  <div
                    key={user.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      devLog.log('Click detectado no usuário:', user);
                      handleSelectUser(user);
                    }}
                    onTouchStart={(e) => {
                      // Para mobile
                      e.stopPropagation();
                      devLog.log('Touch detectado no usuário:', user);
                      handleSelectUser(user);
                    }}
                    className="w-full flex items-center gap-3 p-3 hover:bg-muted/80 active:bg-muted cursor-pointer transition-colors border-b last:border-b-0 select-none"
                    role="button"
                    tabIndex={0}
                    aria-label={`Selecionar ${user.name}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSelectUser(user);
                      }
                    }}
                  >
                    <Avatar className="h-10 w-10 flex-shrink-0 pointer-events-none">
                      <AvatarImage src={getAvatarUrl(user.avatar_url)} />
                      <AvatarFallback>
                        {user.name?.charAt(0).toUpperCase() || <User className="h-5 w-5" />}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 pointer-events-none">
                      <p className="font-medium truncate text-sm">{user.name || 'Sem nome'}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatPublicNicknameHandle(user.nickname) ?? '@sem-nickname'}
                      </p>
                    </div>
                    <div className="text-xs text-primary font-medium pointer-events-none">Selecionar →</div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Mostrar usuário selecionado */}
            {selectedUser && (
              <div className="border rounded-lg p-3 mt-2 bg-primary/10 border-primary/20">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarImage src={getAvatarUrl(selectedUser.avatar_url)} />
                    <AvatarFallback>
                      {selectedUser.name?.charAt(0).toUpperCase() || <User className="h-5 w-5" />}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">
                      ✓ {selectedUser.name || 'Usuário selecionado'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatPublicNicknameHandle(selectedUser.nickname)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedUser(null);
                      setStudentNickname('');
                    }}
                  >
                    Alterar
                  </Button>
                </div>
              </div>
            )}
            
            {searchQuery && isSearching && (
              <p className="text-sm text-muted-foreground">Buscando...</p>
            )}
            
            {searchQuery && !isSearching && searchResults.length === 0 && debouncedSearchQuery.length >= 2 && (
              <p className="text-sm text-muted-foreground">Nenhum usuário encontrado</p>
            )}
          </div>

          {/* Campo de nickname (manual) */}
          <div className="space-y-2">
            <Label htmlFor="nickname">Nickname do Aluno</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">@</span>
              <Input
                id="nickname"
                type="text"
                placeholder="nickname"
                value={studentNickname}
                onChange={(e) => {
                  const value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                  setStudentNickname(value);
                  setSelectedUser(null);
                }}
                disabled={isLoading}
                className="pl-8"
                maxLength={20}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {selectedUser ? (
                <span className="text-primary">✓ Usuário selecionado acima</span>
              ) : (
                'Apenas letras minúsculas, números e underscore (3-20 caracteres)'
              )}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Mensagem (Opcional)</Label>
            <Textarea
              id="message"
              placeholder="Olá! Gostaria de te acompanhar na sua preparação..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={isLoading}
              rows={4}
            />
          </div>

          {/* Alertas de Permissões */}
          <div className="bg-accent/50 border border-border rounded-lg p-4 space-y-2">
            <h4 className="font-semibold text-foreground">O que você terá acesso:</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>✅ Módulo de estudos (horas, sessões)</li>
              <li>✅ Estatísticas gerais</li>
              <li>✅ Ciclos de estudo ativos</li>
              <li>✅ Progresso nos estudos</li>
            </ul>
            
            <div className="pt-2">
              <h4 className="font-semibold text-foreground">O que você NÃO terá acesso:</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>❌ Rankings e respostas</li>
                <li>❌ Dados de provas específicas</li>
                <li>❌ Perfil completo do aluno</li>
              </ul>
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={() => navigate('/coach/dashboard')}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleInviteStudent}
              disabled={isLoading || (!studentNickname && !selectedUser)}
            >
              {isLoading ? (
                'Enviando...'
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Convidar Aluno
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InviteStudentPage;

