/** Limites de caracteres nos formulários de criar/editar ciclo de estudos. */
export const CYCLE_FORM_LIMITS = {
  cycleName: 30,
  organ: 30,
  position: 30,
  blockName: 50,
  disciplineName: 30,
} as const;

export function clampCycleText(value: string, max: number): string {
  return value.trim().slice(0, max);
}
