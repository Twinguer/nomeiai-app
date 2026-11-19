
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSecureUrls } from '@/services/urlObfuscation';
import { useQuery } from '@tanstack/react-query';
import { fetchConcursoById } from '@/services/concursoService';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingState } from '@/modules/rankings/components/classification/LoadingState';
import { Trophy, ArrowRight, FileText, AlertCircle, UserPlus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { openRankingFromList } from '@/modules/rankings';

interface ConcursoDetailsProps {
  concursoId?: string;
  secureToken?: string;
}

const ConcursoDetails: React.FC<ConcursoDetailsProps> = ({ concursoId, secureToken }) => {
  const { id } = useParams<{ id: string; }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isPro } = useSubscription();
  const { generateSecureUrl } = useSecureUrls();
  
  // Usar concursoId da prop se disponível, senão usar id da URL
  const actualConcursoId = concursoId || id;
  
  const { data: concurso, isLoading } = useQuery({
    queryKey: ['concurso', actualConcursoId],
    queryFn: () => fetchConcursoById(actualConcursoId!),
    enabled: !!actualConcursoId
  });

  if (isLoading) {
    return <LoadingState />;
  }

  if (!concurso) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Concurso não encontrado</h1>
        <p>O concurso que você está tentando acessar não existe ou foi removido.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-2">{concurso.titulo}</h1>
      <div className="flex items-center gap-2 mb-6">
        <Badge variant="outline">{concurso.orgao}</Badge>
        <Badge variant="outline">{concurso.banca}</Badge>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-1">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xl">Informações Gerais</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Número de Vagas</dt>
                <dd className="bg-transparent">{concurso.vagas || 'Não informado'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Inscritos</dt>
                <dd>{concurso.inscritos?.toLocaleString() || 'Não informado'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Data da Prova</dt>
                <dd>{concurso.created_at || 'Não informado'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Etapa Atual</dt>
                <dd>{concurso.status || 'Não informado'}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xl">Provas</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Tipo de Prova</dt>
                <dd>{concurso.exam_type || 'Objetiva'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Quantidade de Alternativas</dt>
                <dd>{concurso.alternatives_count || 5}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xl">Pesos das Provas</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2">
              {concurso.has_basic_knowledge && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Conhecimentos Básicos</dt>
                  <dd>{concurso.basic_knowledge_weight || 1}</dd>
                </div>
              )}
              {concurso.has_specific_knowledge_1 && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Conhecimentos Específicos 1</dt>
                  <dd>{concurso.specific_knowledge_1_weight || 1}</dd>
                </div>
              )}
              {concurso.has_specific_knowledge_2 && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Conhecimentos Específicos 2</dt>
                  <dd>{concurso.specific_knowledge_2_weight || 1}</dd>
                </div>
              )}
              {concurso.has_specific_knowledge_3 && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Conhecimentos Específicos 3</dt>
                  <dd>{concurso.specific_knowledge_3_weight || 1}</dd>
                </div>
              )}
              {concurso.subjects?.discr && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Discursiva</dt>
                  <dd>1</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Trophy className="mr-2 h-5 w-5 text-yellow-500" />
              Ranking
            </CardTitle>
            <CardDescription>
              Participe do ranking e compare seu desempenho com outros candidatos
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button 
              variant="outline" 
              className="border-0" 
              onClick={() => {
                if (!actualConcursoId) return;
                openRankingFromList({ user, isPro, navigate }, actualConcursoId);
              }}
            >
              <ArrowRight className="mr-2 h-4 w-4" />
              Ver Ranking
            </Button>
          </CardFooter>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="mr-2 h-5 w-5" />
              Recursos
            </CardTitle>
            <CardDescription>
              Acesse recursos e informações adicionais sobre o concurso
            </CardDescription>
          </CardHeader>
          <CardFooter>
            {concurso.link ? (
              <Button asChild>
                <a 
                  href={concurso.link} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex items-center"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Acessar Edital
                </a>
              </Button>
            ) : (
              <div className="flex items-center text-gray-500">
                <AlertCircle className="mr-2 h-4 w-4" />
                Edital não disponível
              </div>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default ConcursoDetails;
