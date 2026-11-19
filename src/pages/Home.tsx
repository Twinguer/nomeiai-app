import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Filter } from 'lucide-react';
import ConcursoCard from '../components/ConcursoCard';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { fetchConcursos } from '../services/concursoService';
import { Concurso, ConcursoFilter } from '../types/concursos';
import { Label } from '../components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../components/ui/sheet';
import { Badge } from '../components/ui/badge';
import { useToast } from '../hooks/use-toast';
import Footer from '../components/Footer';

const Home: React.FC = () => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<ConcursoFilter>({
    status: 'Em andamento'
  });
  
  // Fetch concursos with React Query
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['concursos', filters],
    queryFn: () => fetchConcursos(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Filter concursos based on search term
  const filteredConcursos = data?.filter(concurso => 
    concurso.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    concurso.orgao.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // Get unique values for filter dropdowns
  const uniqueOrgaos = [...new Set(data?.map(c => c.orgao) || [])];
  const uniqueBancas = [...new Set(data?.map(c => c.banca) || [])];
  const statusOptions = ['Em andamento', 'Finalizado', 'Todos'];

  // Handle filter changes
  const handleFilterChange = (key: keyof ConcursoFilter, value: string) => {
    if (value === 'Todos') {
      const newFilters = { ...filters };
      delete newFilters[key];
      setFilters(newFilters);
    } else {
      setFilters({ ...filters, [key]: value });
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({ status: 'Em andamento' });
    setSearchTerm('');
  };

  // Count active filters
  const activeFilterCount = Object.keys(filters).length;

  useEffect(() => {
    // Initial fetch to populate data
    refetch();
  }, [refetch]);

  return (
    <div className="page-content-container">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Editais de Concursos</h1>
        <p className="text-gray-600">
          Confira os concursos abertos e em andamento dos últimos 5 anos
        </p>
      </div>

      <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Buscar concurso ou órgão..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2" onClick={() => setShowFilters(true)}>
              <Filter className="h-4 w-4" />
              Filtros
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1">{activeFilterCount}</Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Filtros</SheetTitle>
            </SheetHeader>
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select 
                  value={filters.status || 'Todos'} 
                  onValueChange={(value) => handleFilterChange('status', value)}
                >
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((status) => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="orgao">Órgão</Label>
                <Select 
                  value={filters.orgao || 'Todos'} 
                  onValueChange={(value) => handleFilterChange('orgao', value)}
                >
                  <SelectTrigger id="orgao">
                    <SelectValue placeholder="Órgão" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Todos">Todos</SelectItem>
                    {uniqueOrgaos.map((orgao) => (
                      <SelectItem key={orgao} value={orgao}>{orgao}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="banca">Banca</Label>
                <Select 
                  value={filters.banca || 'Todos'} 
                  onValueChange={(value) => handleFilterChange('banca', value)}
                >
                  <SelectTrigger id="banca">
                    <SelectValue placeholder="Banca" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Todos">Todos</SelectItem>
                    {uniqueBancas.map((banca) => (
                      <SelectItem key={banca} value={banca}>{banca}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <Button 
                variant="outline" 
                className="w-full mt-6" 
                onClick={clearFilters}
              >
                Limpar Filtros
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 animate-pulse">
          {[...Array(6)].map((_, index) => (
            <div key={index} className="bg-gray-100 rounded-lg shadow p-6 h-48"></div>
          ))}
        </div>
      ) : isError ? (
        <div className="text-center py-10">
          <p className="text-red-500">Erro ao carregar concursos. Tente novamente mais tarde.</p>
          <Button variant="outline" className="mt-4" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : filteredConcursos.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-gray-500">Nenhum concurso encontrado com os filtros selecionados.</p>
          <Button variant="outline" className="mt-4" onClick={clearFilters}>
            Limpar filtros
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {filteredConcursos.map((concurso) => (
            <ConcursoCard
              key={concurso.id}
              id={concurso.id}
              titulo={concurso.titulo}
              orgao={concurso.orgao}
              data={new Date(concurso.created_at).toLocaleDateString('pt-BR')}
              vagas={concurso.vagas}
              status={concurso.status}
            />
          ))}
        </div>
      )}
      <Footer />
    </div>
  );
};

export default Home;
