import React, { useState, useEffect } from 'react';
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
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Edit, CheckCircle, GripVertical } from 'lucide-react';
import { CYCLE_FORM_LIMITS } from '../domain/cycleFormLimits';

export interface SortableDiscipline {
  id: string;
  name: string;
}

export interface SortableBlock {
  id: string;
  name: string;
  disciplines: SortableDiscipline[];
}

interface SortableBlockCardProps {
  block: SortableBlock;
  disciplineLabel: string;
  addButtonLabel?: string;
  onRemove: () => void;
  onUpdateName: (name: string) => void;
  onAddDiscipline: () => void;
  onEditDiscipline: (discipline: SortableDiscipline) => void;
  onRemoveDiscipline: (disciplineId: string) => void;
  onReorderDisciplines: (disciplines: SortableDiscipline[]) => void;
}

const blockSortId = (id: string) => `block:${id}`;
const disciplineSortId = (blockId: string, disciplineId: string) =>
  `discipline:${blockId}:${disciplineId}`;

function SortableGripButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className="touch-none cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-0 border-0 bg-transparent flex-shrink-0"
      aria-label="Arrastar para reordenar"
      {...props}
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );
}

function SortableDisciplineRow({
  blockId,
  discipline,
  onEdit,
  onRemove,
}: {
  blockId: string;
  discipline: SortableDiscipline;
  onEdit?: () => void;
  onRemove?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: disciplineSortId(blockId, discipline.id),
    data: { type: 'discipline' as const, blockId },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between p-3 border rounded-lg bg-background gap-2"
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <SortableGripButton {...attributes} {...listeners} />
        <span className="font-medium truncate">{discipline.name}</span>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {onEdit && (
          <Button size="sm" variant="ghost" onClick={onEdit} type="button">
            <Edit className="h-3 w-3" />
          </Button>
        )}
        {onRemove && (
          <Button size="sm" variant="ghost" onClick={onRemove} type="button">
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

function SortableBlockCard({
  block,
  disciplineLabel,
  addButtonLabel,
  onRemove,
  onUpdateName,
  onAddDiscipline,
  onEditDiscipline,
  onRemoveDiscipline,
  onReorderDisciplines,
}: SortableBlockCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [nameValue, setNameValue] = useState(block.name);

  useEffect(() => {
    setNameValue(block.name);
  }, [block.name]);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: blockSortId(block.id),
    data: { type: 'block' as const },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
  };

  const disciplineIds = block.disciplines.map((d) => disciplineSortId(block.id, d.id));

  return (
    <Card ref={setNodeRef} style={style}>
      <CardHeader>
        <div className="flex justify-between items-center gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <SortableGripButton {...attributes} {...listeners} />
            {isEditing ? (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Input
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  className="w-full max-w-xs"
                  maxLength={CYCLE_FORM_LIMITS.blockName}
                />
                <Button size="sm" onClick={() => { onUpdateName(nameValue); setIsEditing(false); }} type="button">
                  <CheckCircle className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="text-lg font-semibold truncate">{block.name}</h3>
                <Button size="sm" variant="ghost" onClick={() => setIsEditing(true)} type="button">
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant="outline">
              {block.disciplines.length} {disciplineLabel}
            </Badge>
            <Button size="sm" variant="outline" onClick={onAddDiscipline} type="button">
              <Plus className="h-4 w-4 mr-1" />
              {addButtonLabel ?? disciplineLabel}
            </Button>
            <Button size="sm" variant="destructive" onClick={onRemove} type="button">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      {block.disciplines.length > 0 && (
        <CardContent>
          <SortableContext items={disciplineIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {block.disciplines.map((discipline) => (
                <SortableDisciplineRow
                  key={discipline.id}
                  blockId={block.id}
                  discipline={discipline}
                  onEdit={() => onEditDiscipline(discipline)}
                  onRemove={() => onRemoveDiscipline(discipline.id)}
                />
              ))}
            </div>
          </SortableContext>
        </CardContent>
      )}
    </Card>
  );
}

interface SortableBlocksListProps {
  blocks: SortableBlock[];
  onChange: (blocks: SortableBlock[]) => void;
  disciplineLabel?: string;
  addButtonLabel?: string;
  onAddDiscipline?: (blockId: string) => void;
  onEditDiscipline?: (blockId: string, discipline: SortableDiscipline) => void;
  onRemoveDiscipline?: (blockId: string, disciplineId: string) => void;
  onRemoveBlock?: (blockId: string) => void;
  onUpdateBlockName?: (blockId: string, name: string) => void;
}

export function SortableBlocksList({
  blocks,
  onChange,
  disciplineLabel = 'disciplina(s)',
  addButtonLabel,
  onAddDiscipline,
  onEditDiscipline,
  onRemoveDiscipline,
  onRemoveBlock,
  onUpdateBlockName,
}: SortableBlocksListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const blockIds = blocks.map((b) => blockSortId(b.id));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeType = active.data.current?.type as string | undefined;

    if (activeType === 'block') {
      const oldIndex = blockIds.indexOf(String(active.id));
      const newIndex = blockIds.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return;
      onChange(arrayMove(blocks, oldIndex, newIndex));
      return;
    }

    if (activeType === 'discipline') {
      const blockId = active.data.current?.blockId as string;
      if (!blockId || blockId !== over.data.current?.blockId) return;

      const block = blocks.find((b) => b.id === blockId);
      if (!block) return;

      const ids = block.disciplines.map((d) => disciplineSortId(blockId, d.id));
      const oldIndex = ids.indexOf(String(active.id));
      const newIndex = ids.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(block.disciplines, oldIndex, newIndex);
      onChange(
        blocks.map((b) => (b.id === blockId ? { ...b, disciplines: reordered } : b))
      );
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-4">
          {blocks.map((block) => (
            <SortableBlockCard
              key={block.id}
              block={block}
              disciplineLabel={disciplineLabel}
              addButtonLabel={addButtonLabel}
              onRemove={() =>
                onRemoveBlock
                  ? onRemoveBlock(block.id)
                  : onChange(blocks.filter((b) => b.id !== block.id))
              }
              onUpdateName={(name) =>
                onUpdateBlockName
                  ? onUpdateBlockName(block.id, name)
                  : onChange(blocks.map((b) => (b.id === block.id ? { ...b, name } : b)))
              }
              onAddDiscipline={() => onAddDiscipline?.(block.id)}
              onEditDiscipline={(d) => onEditDiscipline?.(block.id, d)}
              onRemoveDiscipline={(disciplineId) => onRemoveDiscipline?.(block.id, disciplineId)}
              onReorderDisciplines={() => {}}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
