import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronDown, Plus, Trash2, GripVertical } from 'lucide-react';
import type { DisciplineStudyStats } from '../domain/disciplineStudyStats';
import {
  aggregateBlockStats,
  DisciplineProgressStatus,
  formatLastStudyDateDisplay,
  formatStudyDurationDisplay,
  getAccuracyColorClass,
  getAccuracyPercent,
  hasDisciplineStudyStats,
  isDisciplineCompletedForProgress,
  isDisciplineEmAndamentoEffective,
  isDisciplineInReview,
  isDisciplineNotStarted,
  normalizeDisciplineKey,
  resolveDisciplineStats,
} from '../domain/disciplineStudyStats';
import { blockSortId, disciplineSortId } from './editalDnd';
import type { EditalBlock, EditalDiscipline } from './editalTypes';

function StatChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">
      {children}
    </span>
  );
}

function DragHandle(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className="touch-none cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-0 border-0 bg-transparent flex-shrink-0 mr-1"
      aria-label="Arrastar para reordenar"
      {...props}
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );
}

function EditalDisciplineRow({
  blockId,
  discipline,
  disciplineIndex,
  disciplineStats,
  allowEdit,
  canReorder,
  onToggleDiscipline,
  onStatusChange,
  onEditDiscipline,
  onRemoveDiscipline,
}: {
  blockId: string;
  discipline: EditalDiscipline;
  disciplineIndex: number;
  disciplineStats: Record<string, DisciplineStudyStats>;
  allowEdit: boolean;
  canReorder: boolean;
  onToggleDiscipline: (blockId: string, disciplineId: string) => void;
  onStatusChange: (blockId: string, disciplineId: string, status: DisciplineProgressStatus) => void;
  onEditDiscipline?: (blockId: string, disciplineId: string) => void;
  onRemoveDiscipline?: (blockId: string, disciplineId: string) => void;
}) {
  const isCompleted = discipline.isCompleted === true;
  const inReview = isDisciplineInReview(discipline);
  const rawStats = disciplineStats[normalizeDisciplineKey(discipline.name)];
  const hasStats = hasDisciplineStudyStats(rawStats);
  const notStarted = isDisciplineNotStarted(discipline, rawStats);
  const emAndamentoChecked = isDisciplineEmAndamentoEffective(discipline, rawStats);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: disciplineSortId(blockId, discipline.id),
    data: { type: 'discipline' as const, blockId },
    disabled: !canReorder,
  });

  const style = canReorder
    ? { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
    : undefined;

  const stats = resolveDisciplineStats(rawStats);
  const durationLabel = formatStudyDurationDisplay(stats.totalMinutes);
  const accuracyPct = getAccuracyPercent(stats.totalQuestions, stats.correctAnswers) ?? 0;
  const dateLabel = formatLastStudyDateDisplay(stats.lastDate);

  return (
    <div
      ref={canReorder ? setNodeRef : undefined}
      style={style}
      className={`py-2 px-2 sm:px-4 pl-4 sm:pl-8 ${
        disciplineIndex % 2 === 0 ? 'bg-muted/10' : 'bg-background'
      } hover:bg-muted/30 transition-colors`}
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
        <div className="flex flex-col sm:flex-row sm:items-center flex-1 min-w-0">
          <div className="flex items-start sm:items-center min-w-0">
            {canReorder && <DragHandle {...attributes} {...listeners} />}
            <Checkbox
              checked={discipline.isCompleted || false}
              onCheckedChange={() => onToggleDiscipline(blockId, discipline.id)}
              className="mt-0.5 mr-2 sm:mr-3 flex-shrink-0 h-4 w-4"
            />
            <span
              className={`font-medium text-xs truncate ${
                isCompleted
                  ? 'line-through opacity-60 text-foreground'
                  : inReview
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : notStarted
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-foreground'
              } ${allowEdit && onEditDiscipline ? 'cursor-pointer hover:text-primary' : ''}`}
              onClick={
                allowEdit && onEditDiscipline
                  ? (e) => {
                      e.stopPropagation();
                      onEditDiscipline(blockId, discipline.id);
                    }
                  : undefined
              }
              title={allowEdit && onEditDiscipline ? 'Clique para editar' : undefined}
            >
              {discipline.name}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1 mt-1 sm:mt-0 sm:ml-2 pl-6 sm:pl-0">
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

        <div className="flex items-center gap-x-3 gap-y-1 sm:ml-auto sm:flex-shrink-0 text-xs flex-wrap pl-6 sm:pl-0">
          {allowEdit && onRemoveDiscipline && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`Tem certeza que deseja remover a disciplina "${discipline.name}"?`)) {
                  onRemoveDiscipline(blockId, discipline.id);
                }
              }}
              title="Remover disciplina"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
          <label
            className={`flex items-center gap-1 whitespace-nowrap ${
              hasStats ? 'cursor-default' : 'cursor-pointer'
            }`}
          >
            <Checkbox
              checked={emAndamentoChecked}
              disabled={hasStats}
              onCheckedChange={(checked) => {
                if (hasStats) return;
                if (checked) onStatusChange(blockId, discipline.id, 'em_andamento');
                else if (discipline.status === 'em_andamento') onStatusChange(blockId, discipline.id, null);
              }}
              className="h-3.5 w-3.5 flex-shrink-0"
            />
            <span className="text-muted-foreground text-[10px] sm:text-xs">Em andamento</span>
          </label>
          <label className="flex items-center gap-1 cursor-pointer whitespace-nowrap">
            <Checkbox
              checked={discipline.status === 'em_revisao' || discipline.status === 'em-revisao'}
              onCheckedChange={(checked) => {
                if (checked) onStatusChange(blockId, discipline.id, 'em_revisao');
                else if (discipline.status === 'em_revisao' || discipline.status === 'em-revisao') {
                  onStatusChange(blockId, discipline.id, null);
                }
              }}
              className="h-3.5 w-3.5 flex-shrink-0"
            />
            <span className="text-muted-foreground text-[10px] sm:text-xs">Em revisão</span>
          </label>
        </div>
      </div>
    </div>
  );
}

export interface EditalBlockRowProps {
  block: EditalBlock;
  blockIndex: number;
  isExpanded: boolean;
  showProgress: boolean;
  allowEdit: boolean;
  canReorder: boolean;
  disciplineStats: Record<string, DisciplineStudyStats>;
  onToggleBlock: (blockId: string) => void;
  onToggleDiscipline: (blockId: string, disciplineId: string) => void;
  onStatusChange: (blockId: string, disciplineId: string, status: DisciplineProgressStatus) => void;
  onAddDiscipline?: (blockId: string) => void;
  onEditDiscipline?: (blockId: string, disciplineId: string) => void;
  onRemoveDiscipline?: (blockId: string, disciplineId: string) => void;
}

export function EditalBlockRow({
  block,
  blockIndex,
  isExpanded,
  showProgress,
  allowEdit,
  canReorder,
  disciplineStats,
  onToggleBlock,
  onToggleDiscipline,
  onStatusChange,
  onAddDiscipline,
  onEditDiscipline,
  onRemoveDiscipline,
}: EditalBlockRowProps) {
  const hasDisciplines = block.disciplines.length > 0;
  const blockCompleted = hasDisciplines && block.disciplines.every((d) => isDisciplineCompletedForProgress(d));
  const blockCompletedCount = block.disciplines.filter((d) => isDisciplineCompletedForProgress(d)).length;
  const blockStats = aggregateBlockStats(
    block.disciplines.map((d) => d.name),
    disciplineStats
  );

  const {
    attributes: blockDragAttrs,
    listeners: blockDragListeners,
    setNodeRef: setBlockRef,
    transform: blockTransform,
    transition: blockTransition,
    isDragging: isBlockDragging,
  } = useSortable({
    id: blockSortId(block.id),
    data: { type: 'block' as const },
    disabled: !canReorder,
  });

  const blockStyle = canReorder
    ? {
        transform: CSS.Transform.toString(blockTransform),
        transition: blockTransition,
        opacity: isBlockDragging ? 0.85 : 1,
      }
    : undefined;

  const disciplineIds = block.disciplines.map((d) => disciplineSortId(block.id, d.id));
  const blockAgg = resolveDisciplineStats(blockStats);
  const blockDurationLabel = formatStudyDurationDisplay(blockAgg.totalMinutes);
  const blockAccuracyPct = getAccuracyPercent(blockAgg.totalQuestions, blockAgg.correctAnswers) ?? 0;
  const blockDateLabel = formatLastStudyDateDisplay(blockAgg.lastDate);

  return (
    <div ref={canReorder ? setBlockRef : undefined} style={blockStyle}>
      <div
        className={`flex items-center py-2 px-2 sm:px-4 ${
          blockIndex % 2 === 0 ? 'bg-muted/20' : 'bg-background'
        } hover:bg-muted/40 transition-colors ${hasDisciplines ? 'cursor-pointer' : ''}`}
        onClick={() => hasDisciplines && onToggleBlock(block.id)}
      >
        {canReorder && (
          <DragHandle {...blockDragAttrs} {...blockDragListeners} onClick={(e) => e.stopPropagation()} />
        )}
        <Checkbox
          checked={blockCompleted}
          onCheckedChange={() => {
            block.disciplines.forEach((d) => onToggleDiscipline(block.id, d.id));
          }}
          className="mt-0.5 mr-2 sm:mr-3 flex-shrink-0 h-4 w-4"
          onClick={(e) => e.stopPropagation()}
        />
        <div className="flex-1 flex flex-col sm:flex-row sm:items-center min-w-0 gap-0 sm:gap-2">
          <div className="min-w-0">
            <span className="font-semibold text-foreground text-sm">{block.name.toUpperCase()}</span>
            {showProgress && hasDisciplines && (
              <span className="ml-2 text-xs text-muted-foreground">
                ({blockCompletedCount}/{block.disciplines.length})
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1 mt-1 sm:mt-0 sm:ml-2">
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
        <div className="ml-2 flex items-center gap-2">
          {allowEdit && onAddDiscipline && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={(e) => {
                e.stopPropagation();
                onAddDiscipline(block.id);
              }}
              title="Adicionar disciplina"
            >
              <Plus className="h-3 w-3" />
            </Button>
          )}
          {hasDisciplines &&
            (isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            ))}
        </div>
      </div>

      {hasDisciplines && isExpanded && (
        <div className="bg-muted/20">
          <SortableContext items={disciplineIds} strategy={verticalListSortingStrategy}>
            {block.disciplines.map((discipline, disciplineIndex) => (
              <EditalDisciplineRow
                key={discipline.id}
                blockId={block.id}
                discipline={discipline}
                disciplineIndex={disciplineIndex}
                disciplineStats={disciplineStats}
                allowEdit={allowEdit}
                canReorder={canReorder}
                onToggleDiscipline={onToggleDiscipline}
                onStatusChange={onStatusChange}
                onEditDiscipline={onEditDiscipline}
                onRemoveDiscipline={onRemoveDiscipline}
              />
            ))}
          </SortableContext>
        </div>
      )}
    </div>
  );
}
