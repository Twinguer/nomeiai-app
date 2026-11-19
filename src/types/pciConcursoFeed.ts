export type PciConcursoRegiao =
  | 'NACIONAL'
  | 'SUDESTE'
  | 'SUL'
  | 'CENTRO-OESTE'
  | 'NORDESTE'
  | 'NORTE';

export type PciNivelFilter = '' | 'fundamental' | 'medio' | 'superior';

export interface PciConcursoFeedItem {
  id: string;
  titulo: string;
  regiao: PciConcursoRegiao | string;
  uf: string | null;
  vagas: number | null;
  vagas_texto: string | null;
  salario_min: number | null;
  salario_max: number | null;
  salario_texto: string | null;
  cargos: string | null;
  escolaridade: string;
  resumo: string | null;
  inscricao_ate: string | null;
  inscricao_texto: string | null;
  status: string;
  scraped_at: string | null;
}

export const PCI_REGION_TAB_ORDER: PciConcursoRegiao[] = [
  'NACIONAL',
  'SUDESTE',
  'SUL',
  'CENTRO-OESTE',
  'NORDESTE',
  'NORTE',
];

export interface PciConcursoFeedSyncRun {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  items_upserted: number | null;
  items_deactivated: number | null;
  error_message: string | null;
}

export interface PciConcursoFeedSyncResult {
  ok: boolean;
  scrapedAt: string;
  total: number;
  upserted: number;
  deactivated: number;
}

export const PCI_REGION_LABELS: Record<string, string> = {
  NACIONAL: 'Nacional',
  SUDESTE: 'Sudeste',
  SUL: 'Sul',
  'CENTRO-OESTE': 'Centro-Oeste',
  NORDESTE: 'Nordeste',
  NORTE: 'Norte',
};
