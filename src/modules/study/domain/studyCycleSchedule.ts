/** Bloco/disciplina mínimos para montar schedule_data.available_disciplines */
export type StudyCycleBlockInput = {
  id: string;
  name: string;
  disciplines: Array<{ id: string; name: string }>;
};

export function buildAvailableDisciplinesFromBlocks(blocks: StudyCycleBlockInput[]) {
  return blocks.flatMap((block) =>
    block.disciplines.map((disc) => ({
      id: disc.id,
      name: disc.name,
      block_name: block.name,
    }))
  );
}

export function reorderArray<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return items;
  const next = [...items];
  const [removed] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, removed);
  return next;
}
