/**
 * Dashboard de Migração Gradual
 * Interface para controlar e monitorar a migração de segurança
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { migrationManager, type MigrationConfig, type MigrationStatus } from '@/services/migrationManager';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Settings, 
  TrendingUp, 
  Users, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  Activity
} from 'lucide-react';

export const MigrationDashboard: React.FC = () => {
  const [status, setStatus] = useState<MigrationStatus | null>(null);
  const [config, setConfig] = useState<MigrationConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);

  // Configuração local para edição
  const [localConfig, setLocalConfig] = useState<Partial<MigrationConfig>>({});

  const loadData = async () => {
    try {
      setIsLoading(true);
      const currentStatus = migrationManager.getStatus();
      setStatus(currentStatus);
      setConfig(currentStatus.config);
      setLocalConfig(currentStatus.config);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000); // Atualizar a cada 10 segundos
    return () => clearInterval(interval);
  }, []);

  const handleStartMigration = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await migrationManager.startMigration();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao iniciar migração');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePauseMigration = async () => {
    try {
      setIsLoading(true);
      await migrationManager.pauseMigration();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao pausar migração');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResumeMigration = async () => {
    try {
      setIsLoading(true);
      await migrationManager.resumeMigration();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao retomar migração');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRollback = async () => {
    try {
      setIsLoading(true);
      await migrationManager.rollbackMigration();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao executar rollback');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    try {
      setIsLoading(true);
      await migrationManager.saveConfig(localConfig);
      await loadData();
      setShowConfig(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar configuração');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'idle': return 'secondary';
      case 'migrating': return 'default';
      case 'paused': return 'outline';
      case 'rollback': return 'destructive';
      case 'completed': return 'default';
      case 'error': return 'destructive';
      default: return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'idle': return <Clock className="h-4 w-4" />;
      case 'migrating': return <Activity className="h-4 w-4" />;
      case 'paused': return <Pause className="h-4 w-4" />;
      case 'rollback': return <RotateCcw className="h-4 w-4" />;
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'error': return <AlertTriangle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  if (isLoading && !status) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Activity className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Carregando dashboard de migração...</p>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Erro ao carregar dashboard</h3>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={loadData}>Tentar novamente</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard de Migração</h1>
          <p className="text-muted-foreground">
            Controle e monitore a migração gradual de segurança
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={() => setShowConfig(!showConfig)}
          >
            <Settings className="h-4 w-4 mr-2" />
            Configurações
          </Button>
          <Button onClick={loadData} disabled={isLoading}>
            Atualizar
          </Button>
        </div>
      </div>

      {/* Alertas */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Status Principal */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            {getStatusIcon(status.status)}
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Badge variant={getStatusColor(status.status)}>
                {status.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Última verificação: {new Date(status.lastCheck).toLocaleTimeString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Progresso</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{status.currentPercentage}%</div>
            <Progress value={status.currentPercentage} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {status.migratedUsers} de {status.totalUsers} usuários
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Erro</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {status.errorRate.toFixed(2)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {status.alerts} alertas ativos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Performance</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {status.averageResponseTime.toFixed(0)}ms
            </div>
            <p className="text-xs text-muted-foreground">
              Tempo médio de resposta
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Controles de Migração */}
      <Card>
        <CardHeader>
          <CardTitle>Controles de Migração</CardTitle>
          <CardDescription>
            Inicie, pause ou execute rollback da migração
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {status.status === 'idle' && (
              <Button onClick={handleStartMigration} disabled={isLoading}>
                <Play className="h-4 w-4 mr-2" />
                Iniciar Migração
              </Button>
            )}
            
            {status.status === 'migrating' && (
              <Button onClick={handlePauseMigration} disabled={isLoading} variant="outline">
                <Pause className="h-4 w-4 mr-2" />
                Pausar
              </Button>
            )}
            
            {status.status === 'paused' && (
              <Button onClick={handleResumeMigration} disabled={isLoading}>
                <Play className="h-4 w-4 mr-2" />
                Retomar
              </Button>
            )}
            
            {(status.status === 'migrating' || status.status === 'paused') && (
              <Button 
                onClick={handleRollback} 
                disabled={isLoading} 
                variant="destructive"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Rollback
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Configurações */}
      {showConfig && (
        <Card>
          <CardHeader>
            <CardTitle>Configurações de Migração</CardTitle>
            <CardDescription>
              Configure a estratégia e parâmetros de migração
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="enabled"
                checked={localConfig.enabled || false}
                onCheckedChange={(checked) => 
                  setLocalConfig({ ...localConfig, enabled: checked })
                }
              />
              <Label htmlFor="enabled">Habilitar migração</Label>
            </div>

            <div>
              <Label htmlFor="strategy">Estratégia de Migração</Label>
              <Select
                value={localConfig.strategy || 'percentage'}
                onValueChange={(value: any) => 
                  setLocalConfig({ ...localConfig, strategy: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Por Percentual</SelectItem>
                  <SelectItem value="beta_users">Usuários Beta</SelectItem>
                  <SelectItem value="gradual_rollout">Rollout Gradual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {localConfig.strategy === 'percentage' && (
              <div>
                <Label htmlFor="percentage">Percentual de Usuários (%)</Label>
                <Input
                  id="percentage"
                  type="number"
                  min="0"
                  max="100"
                  value={localConfig.percentage || 0}
                  onChange={(e) => 
                    setLocalConfig({ 
                      ...localConfig, 
                      percentage: parseInt(e.target.value) || 0 
                    })
                  }
                />
              </div>
            )}

            {localConfig.strategy === 'beta_users' && (
              <div>
                <Label htmlFor="betaUsers">IDs dos Usuários Beta</Label>
                <Textarea
                  id="betaUsers"
                  placeholder="user-id-1, user-id-2, user-id-3"
                  value={localConfig.betaUserIds?.join(', ') || ''}
                  onChange={(e) => 
                    setLocalConfig({ 
                      ...localConfig, 
                      betaUserIds: e.target.value.split(',').map(id => id.trim()).filter(Boolean)
                    })
                  }
                />
              </div>
            )}

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowConfig(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveConfig} disabled={isLoading}>
                Salvar Configuração
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Histórico de Migração */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Migração</CardTitle>
          <CardDescription>
            Log de ações e eventos da migração
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="recent" className="space-y-4">
            <TabsList>
              <TabsTrigger value="recent">Recentes</TabsTrigger>
              <TabsTrigger value="all">Todos</TabsTrigger>
            </TabsList>
            
            <TabsContent value="recent" className="space-y-2">
              {migrationManager.getHistory().slice(-10).map((entry, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <p className="font-medium">{entry.action}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(entry.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {entry.action.replace('_', ' ')}
                  </Badge>
                </div>
              ))}
            </TabsContent>
            
            <TabsContent value="all" className="space-y-2">
              {migrationManager.getHistory().map((entry, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <p className="font-medium">{entry.action}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(entry.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {entry.action.replace('_', ' ')}
                  </Badge>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
