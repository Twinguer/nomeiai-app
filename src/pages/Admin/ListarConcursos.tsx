
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Concurso, ConcursoFilter } from '@/types/concursos';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building, Eye, Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import { deleteRanking } from '@/integrations/supabase/rankings/concursoManager';
import { useAuth } from '@/hooks/useAuth';
import { useEditUrls } from '@/hooks/useEditUrls';
import { useParticipantCount } from '@/hooks/useParticipantCount';
import { useRankingCreatorInfo } from '@/hooks/useRankingCreatorInfo';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

const ListarConcursos: React.FC = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { generateEditUrl } = useEditUrls();
  const [filter, setFilter] = useState<ConcursoFilter>({});
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modified to catch and handle errors gracefully
  const fetchConcursos = async () => {
    try {
      let query = supabase.from('concursos').select('*');
      
      if (filter.banca) {
        query = query.eq('banca', filter.banca);
      }
      
      if (filter.status) {
        query = query.eq('status', filter.status);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) {
        devLog.error('Error fetching concursos:', error);
        throw error;
      }
      
      return data as Concurso[];
    } catch (err) {
      devLog.error('Error in fetchConcursos:', err);
      throw err;
    }
  };
  
  const { data: concursos, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-concursos', filter],
    queryFn: fetchConcursos,
    retry: 1,
    meta: {
      onError: (err: any) => {
        devLog.error('Query error:', err);
        toast({
          title: 'Erro ao carregar rankings',
          description: 'Não foi possível carregar a lista de rankings.',
          variant: 'destructive',
        });
      }
    }
  });
  
  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este ranking?')) {
      try {
        // For admin mode, we force isAdmin=true
        await deleteRanking(id, user?.id || 'admin-user', true);
        
        toast({
          title: 'Ranking excluído com sucesso!',
          variant: 'default',
        });
        
        refetch();
      } catch (error: any) {
        devLog.error('Erro ao excluir ranking:', error);
        toast({
          title: 'Erro ao excluir ranking',
          description: error.message || 'Ocorreu um erro ao tentar excluir o ranking.',
          variant: 'destructive',
        });
      }
    }
  };

  const handleCreateRanking = () => {
    navigate('/criar-ranking');
  };
  
  const handleViewRanking = (id: string) => {
    // Redirecionar para lista de rankings em vez de URL com ID
    window.open('/pre-classificacao', '_blank');
  };
  
  const handleEditRanking = async (id: string) => {
    try {
      const editUrl = await generateEditUrl(id);
      navigate(editUrl);
    } catch (error: any) {
      devLog.error('Erro ao gerar link de edição:', error);
      toast({
        title: 'Erro ao abrir edição',
        description: error.message || 'Não foi possível gerar o link de edição do ranking.',
        variant: 'destructive',
      });
    }
  };
  
  const filteredConcursos = concursos?.filter(concurso =>
    concurso.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    concurso.orgao.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Rankings Cadastrados</h1>
        <Button onClick={handleCreateRanking}>
          <Plus className="mr-2 h-4 w-4" /> Novo Ranking
        </Button>
      </div>
      
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Filtre os rankings por diferentes critérios</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <label className="text-sm font-medium mb-1 block">Buscar</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Buscar rankings..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1 block">Banca</label>
              <Select
                onValueChange={(value) => setFilter({ ...filter, banca: value || undefined })}
                value={filter.banca || undefined}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas as bancas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as bancas</SelectItem>
                  <SelectItem value="Cebraspe">Cebraspe</SelectItem>
                  <SelectItem value="FGV">FGV</SelectItem>
                  <SelectItem value="FCC">FCC</SelectItem>
                  <SelectItem value="Vunesp">Vunesp</SelectItem>
                  <SelectItem value="Cesgranrio">Cesgranrio</SelectItem>
                  <SelectItem value="IBFC">IBFC</SelectItem>
                  <SelectItem value="IDECAN">IDECAN</SelectItem>
                  <SelectItem value="QUADRIX">QUADRIX</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1 block">Status</label>
              <Select
                onValueChange={(value) => setFilter({ ...filter, status: value || undefined })}
                value={filter.status || undefined}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="Aberto">Aberto</SelectItem>
                  <SelectItem value="Em andamento">Em andamento</SelectItem>
                  <SelectItem value="Encerrado">Encerrado</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
              Erro ao carregar os rankings. Por favor, tente novamente.
            </div>
          ) : filteredConcursos?.length === 0 ? (
            <div className="text-center p-8 text-gray-500">
              <Building className="mx-auto h-12 w-12 text-gray-400 mb-2" />
              <h3 className="font-medium text-lg">Nenhum ranking encontrado</h3>
              <p className="mt-1">Tente ajustar os filtros ou adicione um novo ranking.</p>
              <Button onClick={handleCreateRanking} variant="outline" className="mt-4">
                <Plus className="mr-2 h-4 w-4" /> Adicionar Ranking
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Ranking</TableHead>
                    <TableHead>Banca</TableHead>
                    <TableHead>Vagas</TableHead>
                    <TableHead>Participantes</TableHead>
                    <TableHead>Criado por</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredConcursos?.map((concurso) => (
                    <ConcursoTableRow 
                      key={concurso.id} 
                      concurso={concurso} 
                      onDelete={handleDelete} 
                      onView={handleViewRanking}
                      onEdit={handleEditRanking}
                    />
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

interface ConcursoTableRowProps {
  concurso: Concurso;
  onDelete: (id: string) => void;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
}

const ConcursoTableRow: React.FC<ConcursoTableRowProps> = ({ concurso, onDelete, onView, onEdit }) => {
  // Use hooks for getting participant count and creator info
  const { participantCount, isLoading: isLoadingCount } = useParticipantCount(concurso.id);
  const { creatorName, isAdmin } = useRankingCreatorInfo(concurso);
  
  return (
    <TableRow>
      <TableCell className="font-medium">{concurso.titulo}</TableCell>
      <TableCell>{concurso.orgao}</TableCell>
      <TableCell>{concurso.banca}</TableCell>
      <TableCell>{concurso.vagas}</TableCell>
      <TableCell>
        {isLoadingCount ? (
          <span className="text-muted-foreground">Carregando...</span>
        ) : (
          <div className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{participantCount}</span>
          </div>
        )}
      </TableCell>
      <TableCell>
        {isAdmin ? (
          <span className="text-blue-600 font-medium">Admin</span>
        ) : (
          <span>{creatorName || "Desconhecido"}</span>
        )}
      </TableCell>
      <TableCell>
        <span
          className={`px-2 py-1 rounded-full text-xs ${
            concurso.status === 'Aberto'
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : concurso.status === 'Em andamento'
              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {concurso.status}
        </span>
      </TableCell>
      <TableCell>
        {concurso.created_at
          ? new Date(concurso.created_at).toLocaleDateString('pt-BR')
          : 'N/A'}
      </TableCell>
      <TableCell className="text-right space-x-1">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => onView(concurso.id)}
        >
          <Eye className="h-4 w-4 text-blue-500 dark:text-blue-400" />
          <span className="sr-only">Ver</span>
        </Button>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => onEdit(concurso.id)}
        >
          <Pencil className="h-4 w-4 text-muted-foreground" />
          <span className="sr-only">Editar</span>
        </Button>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => onDelete(concurso.id)}
        >
          <Trash2 className="h-4 w-4 text-red-500 dark:text-red-400" />
          <span className="sr-only">Excluir</span>
        </Button>
      </TableCell>
    </TableRow>
  );
};

export default ListarConcursos;
