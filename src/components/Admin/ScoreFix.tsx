import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Calculator, CheckCircle, AlertCircle, Wrench } from 'lucide-react';

interface FixResult {
  success: boolean;
  message: string;
  totalUsers?: number;
  usersWithDiscrepancies?: number;
  totalCorrections?: number;
  totalDiscrepancy?: number;
  error?: string;
}

export const ScoreFix: React.FC = () => {
  const [concursoId, setConcursoId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<FixResult | null>(null);

  const handleFixAll = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/fix-all-scores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({})
      });

      const fixResult = await response.json();
      setResult(fixResult);
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

  const handleFixConcurso = async () => {
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
      const response = await fetch('/api/fix-concurso-scores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ concursoId: concursoId.trim() })
      });

      const fixResult = await response.json();
      setResult(fixResult);
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

  const handleTestFix = async () => {
    if (!concursoId.trim()) {
      setResult({
        success: false,
        message: 'ID do concurso é obrigatório para teste',
        error: 'Concurso ID required'
      });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/test-score-fix', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ concursoId: concursoId.trim() })
      });

      const testResult = await response.json();
      setResult(testResult);
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

  const handleTestSubjective = async () => {
    if (!concursoId.trim()) {
      setResult({
        success: false,
        message: 'ID do concurso é obrigatório para teste de subjetivas',
        error: 'Concurso ID required'
      });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/test-subjective-calculation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ concursoId: concursoId.trim() })
      });

      const testResult = await response.json();
      setResult(testResult);
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
          <Calculator className="h-5 w-5" />
          Correção de Pontuações
        </CardTitle>
        <CardDescription>
          Corrige discrepâncias de pontuação causadas por duplicação de pontuações subjetivas.
          Use esta ferramenta para resolver problemas como o do Ricardo Lima (45 vs 25 pontos).
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="concurso-id">ID do Concurso (opcional)</Label>
          <Input
            id="concurso-id"
            value={concursoId}
            onChange={(e) => setConcursoId(e.target.value)}
            placeholder="Digite o ID do concurso (UUID) - opcional"
            disabled={isLoading}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Button 
            onClick={handleFixAll} 
            disabled={isLoading}
            className="w-full"
            variant="destructive"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Corrigindo...
              </>
            ) : (
              <>
                <Wrench className="mr-2 h-4 w-4" />
                Corrigir Todos
              </>
            )}
          </Button>

          <Button 
            onClick={handleFixConcurso} 
            disabled={isLoading || !concursoId.trim()}
            className="w-full"
            variant="default"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Corrigindo...
              </>
            ) : (
              <>
                <Calculator className="mr-2 h-4 w-4" />
                Corrigir Concurso
              </>
            )}
          </Button>

          <Button 
            onClick={handleTestFix} 
            disabled={isLoading || !concursoId.trim()}
            className="w-full"
            variant="outline"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testando...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Testar Concurso
              </>
            )}
          </Button>

          <Button 
            onClick={handleTestSubjective} 
            disabled={isLoading || !concursoId.trim()}
            className="w-full"
            variant="secondary"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testando...
              </>
            ) : (
              <>
                <Calculator className="mr-2 h-4 w-4" />
                Testar Subjetivas
              </>
            )}
          </Button>
        </div>

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
                {result.totalUsers !== undefined && (
                  <div className="text-sm space-y-1">
                    <p>Usuários processados: {result.totalUsers}</p>
                    {result.usersWithDiscrepancies !== undefined && (
                      <p>Usuários com discrepâncias: {result.usersWithDiscrepancies}</p>
                    )}
                    {result.totalCorrections !== undefined && (
                      <p>Correções aplicadas: {result.totalCorrections}</p>
                    )}
                    {result.totalDiscrepancy !== undefined && (
                      <p>Total de discrepância corrigida: {result.totalDiscrepancy.toFixed(2)} pontos</p>
                    )}
                  </div>
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
          <h4 className="font-medium">🔧 Funcionalidades:</h4>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Corrigir Todos:</strong> Aplica correção em todos os rankings do sistema</li>
            <li><strong>Corrigir Concurso:</strong> Aplica correção apenas em um concurso específico</li>
            <li><strong>Testar Concurso:</strong> Identifica discrepâncias sem aplicar correções</li>
            <li><strong>Testar Subjetivas:</strong> Verifica se pontuações subjetivas estão sendo incluídas no total</li>
          </ul>
          
          <h4 className="font-medium">⚠️ Importante:</h4>
          <ul className="list-disc list-inside space-y-1">
            <li>Esta operação corrige duplicações de pontuação subjetiva</li>
            <li>Os dados são atualizados permanentemente no banco de dados</li>
            <li>Recomenda-se fazer backup antes de executar em produção</li>
            <li>Use "Testar" primeiro para verificar o impacto</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
