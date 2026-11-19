import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { recalculateAllUserScores, recalculateSpecificUserScore } from '@/utils/recalculateUserScores';
import { useAuth } from '@/hooks/useAuth';
// import { testRecalculate } from '@/utils/testRecalculate'; // Removido - arquivo deletado
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

const RecalculateScores: React.FC = () => {
  const [concursoId, setConcursoId] = useState('44c3e864-9c12-4f41-9d12-40b2a1273b62');
  // ✅ SEGURANÇA: Removido user ID hardcoded - deve ser obtido do contexto de autenticação
  const { user } = useAuth();
  const [userId, setUserId] = useState(user?.id || '');
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const handleRecalculateAll = async () => {
    setIsRecalculating(true);
    setResults([]);
    
    try {
      await recalculateAllUserScores(concursoId);
      setResults(prev => [...prev, { type: 'success', message: 'Recálculo de todos os usuários concluído' }]);
    } catch (error) {
      setResults(prev => [...prev, { type: 'error', message: `Erro: ${error.message}` }]);
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleRecalculateSpecific = async () => {
    // Debug logs removed for security
    setIsRecalculating(true);
    setResults([]);
    
    try {
      devLog.log('🔍 [RecalculateScores] Chamando recalculateSpecificUserScore...');
      const result = await recalculateSpecificUserScore(userId, concursoId);
      devLog.log('🔍 [RecalculateScores] Resultado recebido');
      
      setResults(prev => [...prev, { 
        type: result.success ? 'success' : 'error', 
        message: result.success ? 'Recálculo do usuário específico concluído' : `Erro: ${result.message}` 
      }]);
    } catch (error) {
      devLog.error('❌ [RecalculateScores] Erro capturado:', error);
      setResults(prev => [...prev, { type: 'error', message: `Erro: ${error.message}` }]);
    } finally {
      setIsRecalculating(false);
    }
  };

  // const handleTestRecalculate = async () => {
  //   // Função removida - arquivo testRecalculate.ts foi deletado
  // };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Recálculo de Pontuações</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Recálculo de Todos os Usuários</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="concursoId">Concurso ID</Label>
            <Input
              id="concursoId"
              value={concursoId}
              onChange={(e) => setConcursoId(e.target.value)}
              placeholder="ID do concurso"
            />
          </div>
          <Button 
            onClick={handleRecalculateAll} 
            disabled={isRecalculating}
            className="w-full"
          >
            {isRecalculating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Recalculando...
              </>
            ) : (
              'Recalcular Todos os Usuários'
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recálculo de Usuário Específico</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="userId">User ID</Label>
            <Input
              id="userId"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="ID do usuário"
            />
          </div>
          <div>
            <Label htmlFor="concursoId2">Concurso ID</Label>
            <Input
              id="concursoId2"
              value={concursoId}
              onChange={(e) => setConcursoId(e.target.value)}
              placeholder="ID do concurso"
            />
          </div>
          <Button 
            onClick={handleRecalculateSpecific} 
            disabled={isRecalculating}
            className="w-full"
          >
            {isRecalculating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Recalculando...
              </>
            ) : (
              'Recalcular Usuário Específico'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Card de teste removido - arquivo testRecalculate.ts foi deletado */}

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Resultados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {results.map((result, index) => (
                <div key={index} className="flex items-center space-x-2">
                  {result.type === 'success' ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className={result.type === 'success' ? 'text-green-700' : 'text-red-700'}>
                    {result.message}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RecalculateScores;
