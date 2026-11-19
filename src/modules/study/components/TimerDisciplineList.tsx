import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, ChevronDown, ChevronRight } from 'lucide-react';
import type { EditalBlock } from './editalTypes';
import type { DisciplineStudyStats } from '../domain/disciplineStudyStats';
import {
  aggregateBlockStats,
  formatLastStudyDateDisplay,
  formatStudyDurationDisplay,
  getAccuracyColorClass,
  getAccuracyPercent,
  isDisciplineCompletedForProgress,
  isDisciplineInReview,
  isDisciplineNotStarted,
  normalizeDisciplineKey,
  resolveDisciplineStats,
} from '../domain/disciplineStudyStats';

interface TimerDisciplineListProps {
  blocks: EditalBlock[];
  disciplineStats?: Record<string, DisciplineStudyStats>;
  cycleName?: string;
  highlightDisciplineName?: string;
  highlightBlockName?: string;
  loading?: boolean;
  className?: string;
}

function StatChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">
      {children}
    </span>
  );
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function isHighlightedDiscipline(
  disciplineName: string,
  blockName: string,
  highlightDisciplineName?: string,
  highlightBlockName?: string
): boolean {
  if (!highlightDisciplineName) return false;
  const nameMatch = normalizeName(disciplineName) === normalizeName(highlightDisciplineName);
  if (!highlightBlockName) return nameMatch;
  return nameMatch && normalizeName(blockName) === normalizeName(highlightBlockName);
}

export function TimerDisciplineList({
  blocks,
  disciplineStats = {},
  cycleName,
  highlightDisciplineName,
  highlightBlockName,
  loading = false,
  className = '',
}: TimerDisciplineListProps) {
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setExpandedBlocks(new Set());
  }, [blocks, highlightDisciplineName, highlightBlockName]);

  const toggleBlock = (blockId: string) => {
    setExpandedBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(blockId)) next.delete(blockId);
      else next.add(blockId);
      return next;
    });
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="h-5 w-5" />
            Disciplinas do ciclo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
            <div className="h-4 bg-muted rounded w-2/3" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (blocks.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="h-5 w-5" />
            Disciplinas do ciclo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma disciplina cadastrada neste ciclo.
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalDisciplines = blocks.reduce((sum, block) => sum + block.disciplines.length, 0);
  const completedDisciplines = blocks.reduce(
    (sum, block) =>
      sum + block.disciplines.filter((discipline) => isDisciplineCompletedForProgress(discipline)).length,
    0
  );

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BookOpen className="h-5 w-5" />
          Disciplinas do ciclo
        </CardTitle>
        {cycleName && <p className="text-sm text-muted-foreground truncate">{cycleName}</p>}
        <p className="text-xs text-muted-foreground">
          {completedDisciplines} de {totalDisciplines} concluídas
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {blocks.map((block) => {
            const isExpanded = expandedBlocks.has(block.id);
            const blockCompleted = block.disciplines.filter((discipline) =>
              isDisciplineCompletedForProgress(discipline)
            ).length;
            const blockStats = aggregateBlockStats(
              block.disciplines.map((discipline) => discipline.name),
              disciplineStats
            );
            const blockAgg = resolveDisciplineStats(blockStats);
            const blockDurationLabel = formatStudyDurationDisplay(blockAgg.totalMinutes);
            const blockAccuracyPct =
              getAccuracyPercent(blockAgg.totalQuestions, blockAgg.correctAnswers) ?? 0;
            const blockDateLabel = formatLastStudyDateDisplay(blockAgg.lastDate);

            return (
              <div key={block.id}>
                <button
                  type="button"
                  onClick={() => toggleBlock(block.id)}
                  className="flex w-full items-start gap-2 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm flex-1 truncate">{block.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {blockCompleted}/{block.disciplines.length}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1 mt-1">
                      <StatChip>⏱ {blockDurationLabel}</StatChip>
                      <StatChip>
                        📝 {blockAgg.totalQuestions}Q (
                        <span className={getAccuracyColorClass(blockAccuracyPct)}>{blockAccuracyPct}%</span>)
                      </StatChip>
                      <StatChip>
                        <span title={blockAgg.lastSummary ?? undefined}>📅 {blockDateLabel}</span>
                      </StatChip>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <ul className="pb-2">
                    {block.disciplines.map((discipline, index) => {
                      const isCompleted = isDisciplineCompletedForProgress(discipline);
                      const inReview = isDisciplineInReview(discipline);
                      const rawStats = disciplineStats[normalizeDisciplineKey(discipline.name)];
                      const notStarted = isDisciplineNotStarted(discipline, rawStats);
                      const stats = resolveDisciplineStats(rawStats);
                      const durationLabel = formatStudyDurationDisplay(stats.totalMinutes);
                      const accuracyPct =
                        getAccuracyPercent(stats.totalQuestions, stats.correctAnswers) ?? 0;
                      const dateLabel = formatLastStudyDateDisplay(stats.lastDate);
                      const isActive = isHighlightedDiscipline(
                        discipline.name,
                        block.name,
                        highlightDisciplineName,
                        highlightBlockName
                      );

                      return (
                        <li
                          key={discipline.id}
                          className={`px-4 py-2 pl-10 text-sm ${
                            index % 2 === 0 ? 'bg-muted/10' : 'bg-background'
                          } ${isActive ? 'bg-primary/10 ring-1 ring-inset ring-primary/30' : ''}`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                            <div className="flex flex-wrap items-center gap-2 min-w-0">
                              <span
                                className={`font-medium text-xs truncate ${
                                  isCompleted
                                    ? 'line-through opacity-60 text-foreground'
                                    : inReview
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : notStarted
                                        ? 'text-red-600 dark:text-red-400'
                                        : 'text-foreground'
                                }`}
                              >
                                {discipline.name}
                              </span>
                              {notStarted && (
                                <span className="text-[10px] uppercase tracking-wide text-red-600/80 dark:text-red-400/80 shrink-0">
                                  Não iniciada
                                </span>
                              )}
                              {inReview && !isCompleted && (
                                <span className="text-[10px] uppercase tracking-wide text-emerald-600/80 dark:text-emerald-400/80 shrink-0">
                                  Revisão
                                </span>
                              )}
                              {isActive && (
                                <span className="text-[10px] uppercase tracking-wide text-primary shrink-0">
                                  Agora
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-1 shrink-0">
                              <StatChip>⏱ {durationLabel}</StatChip>
                              <StatChip>
                                📝 {stats.totalQuestions}Q (
                                <span className={getAccuracyColorClass(accuracyPct)}>{accuracyPct}%</span>)
                              </StatChip>
                              <StatChip>
                                <span title={stats.lastSummary ?? undefined}>📅 {dateLabel}</span>
                              </StatChip>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
