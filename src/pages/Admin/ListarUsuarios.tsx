
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Search, User } from 'lucide-react';
import { UserActions } from '@/components/Admin/UserActions';

const ListarUsuarios = () => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  
  // Fetch users
  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('users_profiles')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  };
  
  const { data: users, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-users'],
    queryFn: fetchUsers
  });
  
  const handleRefresh = () => {
    refetch();
    toast({
      title: 'Lista atualizada',
      description: 'A lista de usuários foi atualizada com sucesso.'
    });
  };
  
  const filteredUsers = users?.filter(user => 
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Usuários Registrados</h1>
      </div>
      
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Busque por nome ou email</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Buscar usuários..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center items-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : isError ? (
            <div className="text-center text-red-500 p-6">
              Erro ao carregar os usuários. Por favor, tente novamente.
            </div>
          ) : filteredUsers?.length === 0 ? (
            <div className="text-center p-8 text-gray-500">
              <User className="mx-auto h-12 w-12 text-gray-400 mb-2" />
              <h3 className="font-medium text-lg">Nenhum usuário encontrado</h3>
              <p className="mt-1">Tente ajustar os termos de busca.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data de Cadastro</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers?.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name || 'Sem nome'}</TableCell>
                      <TableCell>{user.email || 'Sem email'}</TableCell>
                      <TableCell>{user.status_concurseiro || 'Na Ativa'}</TableCell>
                      <TableCell>
                        {user.created_at
                          ? new Date(user.created_at).toLocaleDateString('pt-BR')
                          : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        <UserActions
                          userId={user.id}
                          userName={user.name || 'Usuário'}
                          onSuccess={handleRefresh}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ListarUsuarios;
