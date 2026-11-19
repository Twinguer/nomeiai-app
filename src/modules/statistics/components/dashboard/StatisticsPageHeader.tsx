import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { RotateCcw } from 'lucide-react';
import { getStatisticsPeriodLabel } from '../../domain/statisticsFormatters';
import type { StatisticsTimeFilter } from '../../domain/types';

type StatisticsPageHeaderProps = {
  timeFilter: StatisticsTimeFilter;
  onTimeFilterChange: (filter: StatisticsTimeFilter) => void;
  onReset: () => void;
};

export function StatisticsPageHeader({
  timeFilter,
  onTimeFilterChange,
  onReset,
}: StatisticsPageHeaderProps) {
  const periodLabel = getStatisticsPeriodLabel(timeFilter);

  return (
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:justify-between md:items-start">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Estatísticas de Estudo</h1>
        <p className="text-sm text-muted-foreground">
          Gráficos refletem o período selecionado ({periodLabel}). Totais históricos aparecem nos
          cards quando aplicável.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <Select
          value={timeFilter}
          onValueChange={(value: StatisticsTimeFilter) => onTimeFilterChange(value)}
        >
          <SelectTrigger className="w-full sm:w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Hoje</SelectItem>
            <SelectItem value="week">7 dias</SelectItem>
            <SelectItem value="month">30 dias</SelectItem>
          </SelectContent>
        </Select>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="w-full sm:w-auto">
              <RotateCcw className="h-4 w-4 mr-2" />
              Zerar Estatísticas
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Zerar Estatísticas</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação irá deletar permanentemente todas as suas estatísticas de estudo. Esta
                ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={onReset}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Zerar Estatísticas
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
