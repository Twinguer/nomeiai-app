import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import { cleanupConcursoSubjectives } from '@/utils/cleanupRemovedSubjectives';

interface CleanupResult {
  success: boolean;
  message: string;
  cleanedRankings?: number;
  error?: string;
}

export const SubjectiveCleanup: React.FC = () => {
  const [concursoId, setConcursoId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CleanupResult | null>(null);

  const handleCleanup = async () => {
    if (!concursoId.trim()) {
      setResult({
        success: false,
        message: 'ID do concurso é obrigatório',
        error: 'Concurso ID required'
      });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const cleanupResult = await cleanupConcursoSubjectives(concursoId.trim());
      setResult(cleanupResult);
    } catch (error: any) {
      setResult({
        success: false,
        message: 'Erro interno',
        error: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trash2 className="h-5 w-5" />
          Limpeza de Subjetivas Removidas
        </CardTitle>
        <CardDescription>
          Remove pontuações de subjetivas que foram removidas durante edições de ranking.
          Use esta ferramenta para corrigir problemas de pontuação causados por dados antigos.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="concurso-id">ID do Concurso</Label>
          <Input
            id="concurso-id"
            value={concursoId}
            onChange={(e) => setConcursoId(e.target.value)}
            placeholder="Digite o ID do concurso (UUID)"
            disabled={isLoading}
          />
        </div>

        <Button 
          onClick={handleCleanup} 
          disabled={isLoading || !concursoId.trim()}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Limpando...
            </>
          ) : (
            <>
              <Trash2 className="mr-2 h-4 w-4" />
              Executar Limpeza
            </>
          )}
        </Button>

        {result && (
          <Alert className={result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
            {result.success ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <AlertDescription className={result.success ? 'text-green-800' : 'text-red-800'}>
              <div className="space-y-1">
                <p className="font-medium">{result.message}</p>
                {result.cleanedRankings !== undefined && (
                  <p className="text-sm">
                    Rankings limpos: {result.cleanedRankings}
                  </p>
                )}
                {result.error && (
                  <p className="text-sm font-mono bg-red-100 p-2 rounded">
                    {result.error}
                  </p>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="text-sm text-gray-600 space-y-2">
          <h4 className="font-medium">⚠️ Importante:</h4>
          <ul className="list-disc list-inside space-y-1">
            <li>Esta operação remove pontuações de subjetivas que não estão mais ativas no concurso</li>
            <li>Os dados são atualizados permanentemente no banco de dados</li>
            <li>Recomenda-se fazer backup antes de executar em produção</li>
            <li>Use apenas quando houver problemas de pontuação causados por subjetivas removidas</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
