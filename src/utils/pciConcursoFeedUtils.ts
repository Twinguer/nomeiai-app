import type { PciConcursoFeedItem, PciNivelFilter } from '@/types/pciConcursoFeed';

/** Siglas de UF usadas no badge e no filtro por estado */
export const BRAZILIAN_UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

export type BrazilianUf = (typeof BRAZILIAN_UFS)[number];

const UF_SET = new Set<string>(BRAZILIAN_UFS);

/** Retorna sigla se o texto for exatamente uma UF (ex.: "AL", " al "). */
export function parseUfFilter(input: string): BrazilianUf | null {
  const t = input.trim().toUpperCase();
  if (t.length !== 2 || !UF_SET.has(t)) return null;
  return t as BrazilianUf;
}

export function inferNiveis(escolaridade: string): PciNivelFilter[] {
  const t = (escolaridade || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const niveis: PciNivelFilter[] = [];
  if (/fundamental/.test(t)) niveis.push('fundamental');
  if (/medio|médio/.test(t) || /tecnico|técnico/.test(t)) niveis.push('medio');
  if (/superior/.test(t)) niveis.push('superior');
  return [...new Set(niveis)];
}

export function matchesNivel(item: PciConcursoFeedItem, nivel: PciNivelFilter): boolean {
  if (!nivel) return true;
  return inferNiveis(item.escolaridade).includes(nivel);
}

export function filterPciItems(
  items: PciConcursoFeedItem[],
  query: string,
  nivel: PciNivelFilter,
  selectedUf?: string | null,
): PciConcursoFeedItem[] {
  const ufFromSearch = parseUfFilter(query);
  const activeUf = (selectedUf ? selectedUf.toUpperCase() : null) || ufFromSearch;
  const textQ =
    ufFromSearch && !selectedUf ? '' : query.trim().toLowerCase();

  return items.filter((item) => {
    if (!matchesNivel(item, nivel)) return false;
    if (activeUf && (item.uf || '').toUpperCase() !== activeUf) return false;
    if (!textQ) return true;
    const hay = `${item.titulo} ${item.cargos || ''} ${item.resumo || ''} ${item.escolaridade}`
      .toLowerCase();
    return hay.includes(textQ);
  });
}

/** UFs presentes no feed, para chips de filtro (mesmo valor do badge). */
export function collectUfsFromItems(items: PciConcursoFeedItem[]): BrazilianUf[] {
  const set = new Set<BrazilianUf>();
  for (const item of items) {
    const uf = parseUfFilter(item.uf || '');
    if (uf) set.add(uf);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function daysUntilInscricao(dateStr: string | null | undefined): number | null {
  if (!dateStr || !/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return null;
  const [d, m, y] = dateStr.split('/').map(Number);
  const end = new Date(y, m - 1, d, 23, 59, 59);
  return Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function formatBRL(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function getGridColumnCount(containerWidth: number): number {
  const CARD_MIN = 300;
  const GAP = 14;
  return Math.max(1, Math.floor((containerWidth + GAP) / (CARD_MIN + GAP)));
}
