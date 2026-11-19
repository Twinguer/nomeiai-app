/**
 * Dashboard de Monitoramento de Segurança
 * Exibe métricas e alertas do sistema de migração
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { securityMonitor, type SecurityAlert, type MonitoringMetrics } from '@/services/securityMonitor';
import { AlertTriangle, CheckCircle, Clock, TrendingUp, Shield, Activity } from 'lucide-react';

export const SecurityDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<MonitoringMetrics>(securityMonitor.getMetrics());
  const [alerts, setAlerts] = useState<SecurityAlert[]>(securityMonitor.getUnresolvedAlerts());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshData = async () => {
    setIsRefreshing(true);
    setMetrics(securityMonitor.getMetrics());
    setAlerts(securityMonitor.getUnresolvedAlerts());
    setIsRefreshing(false);
  };

  useEffect(() => {
    const interval = setInterval(refreshData, 5000); // Atualizar a cada 5 segundos
    return () => clearInterval(interval);
  }, []);

  const getSeverityColor = (severity: SecurityAlert['severity']) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  const getSeverityIcon = (severity: SecurityAlert['severity']) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return <AlertTriangle className="h-4 w-4" />;
      case 'medium':
        return <Clock className="h-4 w-4" />;
      case 'low':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const resolveAlert = (alertId: string) => {
    if (securityMonitor.resolveAlert(alertId)) {
      setAlerts(securityMonitor.getUnresolvedAlerts());
    }
  };

  const criticalAlerts = alerts.filter(alert => alert.severity === 'critical' || alert.severity === 'high');
  const mediumAlerts = alerts.filter(alert => alert.severity === 'medium');
  const lowAlerts = alerts.filter(alert => alert.severity === 'low');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard de Segurança</h1>
          <p className="text-muted-foreground">
            Monitoramento da migração de segurança em tempo real
          </p>
        </div>
        <Button onClick={refreshData} disabled={isRefreshing}>
          {isRefreshing ? 'Atualizando...' : 'Atualizar'}
        </Button>
      </div>

      {/* Alertas Críticos */}
      {criticalAlerts.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>{criticalAlerts.length} alerta(s) crítico(s)</strong> requerem atenção imediata.
            Verifique a aba de Alertas para mais detalhes.
          </AlertDescription>
        </Alert>
      )}

      {/* Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Cálculos</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalCalculations}</div>
            <p className="text-xs text-muted-foreground">
              Última atualização: {new Date(metrics.lastUpdated).toLocaleTimeString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Frontend</CardTitle>
            <Activity className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{metrics.frontendCalculations}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.totalCalculations > 0 
                ? `${((metrics.frontendCalculations / metrics.totalCalculations) * 100).toFixed(1)}% do total`
                : '0% do total'
              }
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Backend</CardTitle>
            <Shield className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{metrics.backendCalculations}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.totalCalculations > 0 
                ? `${((metrics.backendCalculations / metrics.totalCalculations) * 100).toFixed(1)}% do total`
                : '0% do total'
              }
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Discrepâncias</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{metrics.discrepancies}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.totalCalculations > 0 
                ? `${((metrics.discrepancies / metrics.totalCalculations) * 100).toFixed(2)}% de taxa de erro`
                : '0% de taxa de erro'
              }
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Performance</CardTitle>
          <CardDescription>Métricas de tempo de resposta</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium">Tempo Médio de Resposta</p>
              <p className="text-2xl font-bold">
                {metrics.averageResponseTime.toFixed(2)}ms
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Erros</p>
              <p className="text-2xl font-bold text-red-600">{metrics.errors}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Status</p>
              <Badge variant={metrics.averageResponseTime < 100 ? 'default' : 'destructive'}>
                {metrics.averageResponseTime < 100 ? 'Ótimo' : 'Degradado'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alertas */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">Todos ({alerts.length})</TabsTrigger>
          <TabsTrigger value="critical">Críticos ({criticalAlerts.length})</TabsTrigger>
          <TabsTrigger value="medium">Médios ({mediumAlerts.length})</TabsTrigger>
          <TabsTrigger value="low">Baixos ({lowAlerts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-2">
          {alerts.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <div className="text-center">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <p className="text-lg font-medium">Nenhum alerta ativo</p>
                  <p className="text-muted-foreground">Sistema funcionando normalmente</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            alerts.map((alert) => (
              <Card key={alert.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      {getSeverityIcon(alert.severity)}
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium">{alert.message}</h4>
                          <Badge variant={getSeverityColor(alert.severity)}>
                            {alert.severity}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {new Date(alert.timestamp).toLocaleString()}
                        </p>
                        <p className="text-sm mt-2">
                          Tipo: {alert.type} | Contexto: {alert.details.context || 'N/A'}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resolveAlert(alert.id)}
                    >
                      Resolver
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="critical" className="space-y-2">
          {criticalAlerts.map((alert) => (
            <Card key={alert.id} className="border-red-200">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <div>
                      <h4 className="font-medium text-red-900">{alert.message}</h4>
                      <p className="text-sm text-red-600 mt-1">
                        {new Date(alert.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => resolveAlert(alert.id)}
                  >
                    Resolver
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="medium" className="space-y-2">
          {mediumAlerts.map((alert) => (
            <Card key={alert.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <Clock className="h-4 w-4 text-orange-500" />
                    <div>
                      <h4 className="font-medium">{alert.message}</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {new Date(alert.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => resolveAlert(alert.id)}
                  >
                    Resolver
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="low" className="space-y-2">
          {lowAlerts.map((alert) => (
            <Card key={alert.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <div>
                      <h4 className="font-medium">{alert.message}</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {new Date(alert.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => resolveAlert(alert.id)}
                  >
                    Resolver
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
};
