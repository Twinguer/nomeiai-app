/**
 * Sistema de Monitoramento de Segurança
 * Detecta discrepâncias e gera alertas para a migração
 */

import { supabase } from '@/integrations/supabase/client';
import { featureFlags } from '@/config/featureFlags';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

export interface SecurityAlert {
  id: string;
  type: 'discrepancy' | 'permission_denied' | 'validation_failed' | 'performance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: Record<string, any>;
  timestamp: number;
  resolved: boolean;
}

export interface MonitoringMetrics {
  totalCalculations: number;
  frontendCalculations: number;
  backendCalculations: number;
  discrepancies: number;
  errors: number;
  averageResponseTime: number;
  lastUpdated: number;
}

class SecurityMonitor {
  private alerts: SecurityAlert[] = [];
  private metrics: MonitoringMetrics = {
    totalCalculations: 0,
    frontendCalculations: 0,
    backendCalculations: 0,
    discrepancies: 0,
    errors: 0,
    averageResponseTime: 0,
    lastUpdated: Date.now(),
  };

  /**
   * Registra uma discrepância entre frontend e backend
   */
  logDiscrepancy(
    frontendResult: any,
    backendResult: any,
    input: any,
    context?: string
  ): void {
    if (!featureFlags.enableSecurityLogging) return;

    const alert: SecurityAlert = {
      id: `discrepancy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'discrepancy',
      severity: this.calculateDiscrepancySeverity(frontendResult, backendResult),
      message: 'Discrepância detectada entre frontend e backend',
      details: {
        frontend: frontendResult,
        backend: backendResult,
        input,
        context,
        differences: this.calculateDifferences(frontendResult, backendResult),
      },
      timestamp: Date.now(),
      resolved: false,
    };

    this.alerts.push(alert);
    this.metrics.discrepancies++;
    
    // Enviar para backend para persistência
    this.persistAlert(alert);
  }

  /**
   * Registra erro de permissão
   */
  logPermissionDenied(userId: string, concursoId: string, context?: string): void {
    if (!featureFlags.enableSecurityLogging) return;

    const alert: SecurityAlert = {
      id: `permission_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'permission_denied',
      severity: 'high',
      message: 'Tentativa de acesso negada por permissão',
      details: {
        userId,
        concursoId,
        context,
      },
      timestamp: Date.now(),
      resolved: false,
    };

    this.alerts.push(alert);
    this.persistAlert(alert);
  }

  /**
   * Registra falha de validação
   */
  logValidationFailed(
    input: any,
    errors: string[],
    context?: string
  ): void {
    if (!featureFlags.enableSecurityLogging) return;

    const alert: SecurityAlert = {
      id: `validation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'validation_failed',
      severity: 'medium',
      message: 'Falha na validação de entrada',
      details: {
        input,
        errors,
        context,
      },
      timestamp: Date.now(),
      resolved: false,
    };

    this.alerts.push(alert);
    this.persistAlert(alert);
  }

  /**
   * Registra métrica de performance
   */
  logPerformance(
    operation: string,
    duration: number,
    source: 'frontend' | 'backend',
    context?: string
  ): void {
    if (!featureFlags.enableSecurityLogging) return;

    this.metrics.totalCalculations++;
    
    if (source === 'frontend') {
      this.metrics.frontendCalculations++;
    } else {
      this.metrics.backendCalculations++;
    }

    // Atualizar tempo médio de resposta
    this.updateAverageResponseTime(duration);

    // Alertar se performance estiver ruim
    if (duration > 1000) { // > 1 segundo
      const alert: SecurityAlert = {
        id: `performance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'performance',
        severity: duration > 5000 ? 'high' : 'medium',
        message: `Performance degradada: ${operation} levou ${duration}ms`,
        details: {
          operation,
          duration,
          source,
          context,
        },
        timestamp: Date.now(),
        resolved: false,
      };

      this.alerts.push(alert);
      devLog.warn('⚠️ PERFORMANCE ALERT:', alert);
    }
  }

  /**
   * Registra erro geral
   */
  logError(error: Error, context?: string): void {
    if (!featureFlags.enableSecurityLogging) return;

    this.metrics.errors++;
    
    devLog.error('❌ SECURITY ERROR:', {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: Date.now(),
    });
  }

  /**
   * Obtém alertas não resolvidos
   */
  getUnresolvedAlerts(): SecurityAlert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }

  /**
   * Obtém alertas por severidade
   */
  getAlertsBySeverity(severity: SecurityAlert['severity']): SecurityAlert[] {
    return this.alerts.filter(alert => alert.severity === severity);
  }

  /**
   * Obtém métricas atuais
   */
  getMetrics(): MonitoringMetrics {
    return { ...this.metrics };
  }

  /**
   * Resolve um alerta
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      return true;
    }
    return false;
  }

  /**
   * Limpa alertas antigos (mais de 24 horas)
   */
  cleanupOldAlerts(): void {
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    this.alerts = this.alerts.filter(alert => alert.timestamp > oneDayAgo);
  }

  /**
   * Calcula severidade da discrepância
   */
  private calculateDiscrepancySeverity(frontend: any, backend: any): SecurityAlert['severity'] {
    const totalDiff = Math.abs(frontend.totalDelta - backend.totalDelta);
    const weightedDiff = Math.abs(frontend.weightedDisciplineDelta - backend.weightedDisciplineDelta);
    
    const maxDiff = Math.max(totalDiff, weightedDiff);
    
    if (maxDiff > 1) return 'critical';
    if (maxDiff > 0.5) return 'high';
    if (maxDiff > 0.1) return 'medium';
    return 'low';
  }

  /**
   * Calcula diferenças entre resultados
   */
  private calculateDifferences(frontend: any, backend: any): Record<string, number> {
    return {
      totalDelta: Math.abs(frontend.totalDelta - backend.totalDelta),
      disciplineDelta: Math.abs(frontend.disciplineDelta - backend.disciplineDelta),
      weightedDisciplineDelta: Math.abs(frontend.weightedDisciplineDelta - backend.weightedDisciplineDelta),
    };
  }

  /**
   * Atualiza tempo médio de resposta
   */
  private updateAverageResponseTime(duration: number): void {
    const total = this.metrics.totalCalculations;
    const current = this.metrics.averageResponseTime;
    this.metrics.averageResponseTime = ((current * (total - 1)) + duration) / total;
  }

  /**
   * Persiste alerta no backend
   */
  private async persistAlert(alert: SecurityAlert): Promise<void> {
    try {
      await supabase
        .from('score_calculation_logs')
        .insert({
          calculation_type: 'security_alert',
          calculation_details: {
            alert_type: alert.type,
            severity: alert.severity,
            message: alert.message,
            details: alert.details,
            timestamp: alert.timestamp,
          },
        });
    } catch (error) {
      devLog.error('Erro ao persistir alerta:', error);
    }
  }
}

// Instância singleton
export const securityMonitor = new SecurityMonitor();

// Limpeza automática a cada hora
setInterval(() => {
  securityMonitor.cleanupOldAlerts();
}, 60 * 60 * 1000);
