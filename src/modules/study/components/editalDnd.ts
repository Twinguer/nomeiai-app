import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';

export const blockSortId = (id: string) => `block:${id}`;
export const disciplineSortId = (blockId: string, disciplineId: string) =>
  `discipline:${blockId}:${disciplineId}`;

export type EditalBlockLike = {
  id: string;
  name: string;
  disciplines: Array<{ id: string; name: string }>;
};

export function applyBlocksDragEnd<T extends EditalBlockLike>(
  event: DragEndEvent,
  blocks: T[]
): T[] | null {
  const { active, over } = event;
  if (!over || active.id === over.id) return null;

  const activeType = active.data.current?.type as string | undefined;

  if (activeType === 'block') {
    const blockIds = blocks.map((b) => blockSortId(b.id));
    const oldIndex = blockIds.indexOf(String(active.id));
    const newIndex = blockIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return null;
    return arrayMove(blocks, oldIndex, newIndex);
  }

  if (activeType === 'discipline') {
    const blockId = active.data.current?.blockId as string;
    if (!blockId || blockId !== over.data.current?.blockId) return null;

    const block = blocks.find((b) => b.id === blockId);
    if (!block) return null;

    const ids = block.disciplines.map((d) => disciplineSortId(blockId, d.id));
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return null;

    const reordered = arrayMove(block.disciplines, oldIndex, newIndex);
    return blocks.map((b) => (b.id === blockId ? { ...b, disciplines: reordered } : b));
  }

  return null;
}
