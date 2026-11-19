-- Feed público de concursos abertos (scrap PCI /concursos/)
CREATE TABLE IF NOT EXISTS public.pci_concurso_feed (
  id TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  regiao TEXT NOT NULL,
  uf TEXT,
  vagas INTEGER,
  vagas_texto TEXT,
  salario_min NUMERIC,
  salario_max NUMERIC,
  salario_texto TEXT,
  cargos TEXT,
  escolaridade TEXT NOT NULL DEFAULT '—',
  resumo TEXT,
  inscricao_ate TEXT,
  inscricao_texto TEXT,
  status TEXT NOT NULL DEFAULT 'aberto',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  scraped_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pci_concurso_feed_regiao ON public.pci_concurso_feed (regiao) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_pci_concurso_feed_active ON public.pci_concurso_feed (is_active);

COMMENT ON TABLE public.pci_concurso_feed IS 'Concursos abertos agregados (fonte PCI); leitura pública, escrita apenas via service role.';

ALTER TABLE public.pci_concurso_feed ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pci_concurso_feed_select_public ON public.pci_concurso_feed;
CREATE POLICY pci_concurso_feed_select_public ON public.pci_concurso_feed
  FOR SELECT
  TO anon, authenticated
  USING (is_active = TRUE);

GRANT SELECT ON public.pci_concurso_feed TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.pci_concurso_feed_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',
  items_upserted INTEGER DEFAULT 0,
  items_deactivated INTEGER DEFAULT 0,
  error_message TEXT
);

ALTER TABLE public.pci_concurso_feed_sync_runs ENABLE ROW LEVEL SECURITY;

-- Apenas service role insere runs (sem policy para anon/auth)
