/** Remove @ no início e espaços; nickname no banco não deve incluir @. */
export function stripNicknamePrefix(value: string | null | undefined): string {
  if (!value) return '';
  return value.trim().replace(/^@+/, '');
}

/**
 * Normaliza texto para nickname: translitera acentos, minúsculas, remove espaços
 * e caracteres inválidos. Espaços em "Nataly Lima" viram "natalylima", não "natalylim".
 */
export function normalizeNicknameInput(value: string | null | undefined): string {
  if (!value) return '';
  return stripNicknamePrefix(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, '')
    .slice(0, 20);
}

/** Exibe handle público (@nickname) sem duplicar @. */
export function formatPublicNicknameHandle(value: string | null | undefined): string | null {
  const handle = stripNicknamePrefix(value);
  return handle ? `@${handle}` : null;
}
