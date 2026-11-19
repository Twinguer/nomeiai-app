import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen } from 'lucide-react';
import { applyBlocksDragEnd, blockSortId } from './editalDnd';
import { EditalBlockRow } from './EditalBlockRow';
import type { EditalBlock } from './editalTypes';

export type { EditalBlock, EditalDiscipline } from './editalTypes';
import { ProFeatureGuard } from '@/components/Subscription/ProFeatureGuard';
import { useStudyProAccess } from '../hooks/useStudyProAccess';
import type { DisciplineStudyStats } from '../domain/disciplineStudyStats';
import { DisciplineProgressStatus, isDisciplineCompletedForProgress } from '../domain/disciplineStudyStats';

interface EditalVerticalizadoProps {
  blocks: EditalBlock[];
  disciplineStats?: Record<string, DisciplineStudyStats>;
  onToggleDiscipline?: (blockId: string, disciplineId: string) => void;
  onToggleBlock?: (blockId: string) => void;
  onStatusChange?: (blockId: string, disciplineId: string, status: DisciplineProgressStatus) => void;
  onAddDiscipline?: (blockId: string) => void;
  onEditDiscipline?: (blockId: string, disciplineId: string) => void;
  onRemoveDiscipline?: (blockId: string, disciplineId: string) => void;
  onBlocksChange?: (blocks: EditalBlock[]) => void;
  expandedBlocks?: Set<string>;
  showProgress?: boolean;
  className?: string;
  allowEdit?: boolean;
  allowReorder?: boolean;
  /** Coach no modo aluno: não exige plano Pro do usuário logado */
  bypassProGuard?: boolean;
}

function StatsLegend() {
  return (
    <div className="mt-3 rounded-md border border-border bg-muted/30 px-2 py-1.5 sm:px-3 sm:py-2 text-[10px] sm:text-xs text-muted-foreground">
      <span className="font-medium text-foreground">Legenda: </span>
      <span className="inline-flex flex-wrap gap-x-3 gap-y-1">
        <span>⏱ Tempo de estudo</span>
        <span>
          📝 Questões (
          <span className="text-red-600 dark:text-red-400 font-semibold">&lt;70%</span>
          {' · '}
          <span className="text-amber-600 dark:text-amber-400 font-semibold">70–80%</span>
          {' · '}
          <span className="text-green-600 dark:text-green-400 font-semibold">&gt;80%</span>)
        </span>
        <span>📅 Último estudo (passe o mouse para ver o que foi registrado)</span>
      </span>
    </div>
  );
}

export const EditalVerticalizado: React.FC<EditalVerticalizadoProps> = ({
  blocks,
  disciplineStats = {},
  onToggleDiscipline,
  onToggleBlock,
  onStatusChange,
  onAddDiscipline,
  onEditDiscipline,
  onRemoveDiscipline,
  onBlocksChange,
  expandedBlocks: externalExpandedBlocks,
  showProgress = true,
  className = '',
  allowEdit = false,
  allowReorder = false,
  bypassProGuard = false,
}) => {
  const { canAccessStudyPro, isLoading: isLoadingStudyAccess } = useStudyProAccess();
  const [internalExpandedBlocks, setInternalExpandedBlocks] = useState<Set<string>>(new Set());

  const canReorder = allowReorder && !!onBlocksChange;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const expandedBlocks = externalExpandedBlocks || internalExpandedBlocks;
  const setExpandedBlocks = externalExpandedBlocks ? () => {} : setInternalExpandedBlocks;

  const handleToggleBlock = (blockId: string) => {
    if (onToggleBlock) {
      onToggleBlock(blockId);
    } else {
      const newExpanded = new Set(expandedBlocks);
      if (newExpanded.has(blockId)) {
        newExpanded.delete(blockId);
      } else {
        newExpanded.add(blockId);
      }
      setExpandedBlocks(newExpanded);
    }
  };

  const handleToggleDiscipline = (blockId: string, disciplineId: string) => {
    onToggleDiscipline?.(blockId, disciplineId);
  };

  const handleStatusChange = (
    blockId: string,
    disciplineId: string,
    status: DisciplineProgressStatus
  ) => {
    onStatusChange?.(blockId, disciplineId, status);
  };

  const totalDisciplines = blocks.reduce((total, block) => total + block.disciplines.length, 0);
  const completedDisciplines = blocks.reduce(
    (total, block) =>
      total + block.disciplines.filter((d) => isDisciplineCompletedForProgress(d)).length,
    0
  );
  const progressPercentage =
    totalDisciplines > 0 ? Math.round((completedDisciplines / totalDisciplines) * 100) : 0;

  const blockIds = blocks.map((b) => blockSortId(b.id));

  const handleDragEnd = (event: DragEndEvent) => {
    const next = applyBlocksDragEnd(event, blocks);
    if (next) onBlocksChange?.(next);
  };

  const listContent =
    blocks.length === 0 ? (
      <div className="text-center p-8 text-muted-foreground">
        <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-sm">Nenhum bloco de estudo encontrado</p>
      </div>
    ) : (
      blocks.map((block, blockIndex) => (
        <EditalBlockRow
          key={block.id}
          block={block}
          blockIndex={blockIndex}
          isExpanded={expandedBlocks.has(block.id)}
          showProgress={showProgress}
          allowEdit={allowEdit}
          canReorder={canReorder}
          disciplineStats={disciplineStats}
          onToggleBlock={handleToggleBlock}
          onToggleDiscipline={handleToggleDiscipline}
          onStatusChange={handleStatusChange}
          onAddDiscipline={onAddDiscipline}
          onEditDiscipline={onEditDiscipline}
          onRemoveDiscipline={onRemoveDiscipline}
        />
      ))
    );

  if (!bypassProGuard && !isLoadingStudyAccess && !canAccessStudyPro) {
    return (
      <div className={className}>
        <ProFeatureGuard featureName="Ciclo de Estudos" />
      </div>
    );
  }

  if (!bypassProGuard && isLoadingStudyAccess) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-muted-foreground text-sm">Carregando...</div>
      </div>
    );
  }

  return (
    <Card className={`w-full ${className}`}>
      <CardHeader className="p-3 pb-3 sm:p-6">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-bold text-center text-foreground">
          <BookOpen className="h-5 w-5" />
          Ciclo de Estudos
        </CardTitle>

        <StatsLegend />

        {canReorder && blocks.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Arraste pelo ícone para reordenar blocos ou disciplinas (cada um no seu nível).
          </p>
        )}

        {showProgress && blocks.length > 0 && (
          <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-primary/5 rounded-lg border border-primary/20">
            <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
              <div>
                <div className="text-xl font-bold text-primary">{totalDisciplines}</div>
                <div className="text-sm text-primary/80 font-medium">Total de Disciplinas</div>
              </div>
              <div>
                <div className="text-xl font-bold text-green-600 dark:text-green-400">
                  {completedDisciplines}
                </div>
                <div className="text-sm text-green-600/80 dark:text-green-400/80 font-medium">
                  Concluídas
                </div>
              </div>
              <div>
                <div className="text-xl font-bold text-orange-600 dark:text-orange-400">
                  {progressPercentage}%
                </div>
                <div className="text-sm text-orange-600/80 dark:text-orange-400/80 font-medium">
                  Progresso
                </div>
              </div>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <div className="bg-muted/30 rounded-lg overflow-hidden">
          {canReorder ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
                {listContent}
              </SortableContext>
            </DndContext>
          ) : (
            listContent
          )}
        </div>
      </CardContent>
    </Card>
  );
};
