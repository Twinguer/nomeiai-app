-- Ranking provisório por consenso: schema base
-- gabarito_status: consensus | preliminary | final

ALTER TABLE public.concursos
  ADD COLUMN IF NOT EXISTS gabarito_status text NOT NULL DEFAULT 'consensus',
  ADD COLUMN IF NOT EXISTS provisional_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS recalc_pending_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS provisional_version integer NOT NULL DEFAULT 0;

ALTER TABLE public.concursos
  DROP CONSTRAINT IF EXISTS concursos_gabarito_status_check;

ALTER TABLE public.concursos
  ADD CONSTRAINT concursos_gabarito_status_check
  CHECK (gabarito_status IN ('consensus', 'preliminary', 'final'));

COMMENT ON COLUMN public.concursos.gabarito_status IS
  'consensus = gabarito provisório por maioria; preliminary/final = gabarito oficial da banca';
COMMENT ON COLUMN public.concursos.provisional_answers IS
  'Gabarito provisório (mesmo formato JSONB de official_answers, por caderno)';
COMMENT ON COLUMN public.concursos.recalc_pending_at IS
  'Marca recálculo em massa pendente (debounce) quando líder de questão muda';
COMMENT ON COLUMN public.concursos.provisional_version IS
  'Incrementa quando alguma questão muda de líder no modo consenso';

-- Backfill: concursos com gabarito oficial → final; demais → consensus
UPDATE public.concursos
SET gabarito_status = CASE
  WHEN official_answers IS NOT NULL
    AND official_answers <> '{}'::jsonb
    AND official_answers <> 'null'::jsonb
  THEN 'final'
  ELSE 'consensus'
END
WHERE gabarito_status = 'consensus'
  AND (
    official_answers IS NOT NULL
    AND official_answers <> '{}'::jsonb
    AND official_answers <> 'null'::jsonb
  );

CREATE TABLE IF NOT EXISTS public.ranking_answer_votes (
  concurso_id uuid NOT NULL REFERENCES public.concursos(id) ON DELETE CASCADE,
  booklet_id text NOT NULL,
  question_number integer NOT NULL,
  answer text NOT NULL,
  vote_count integer NOT NULL DEFAULT 0 CHECK (vote_count >= 0),
  PRIMARY KEY (concurso_id, booklet_id, question_number, answer)
);

CREATE INDEX IF NOT EXISTS idx_ranking_answer_votes_concurso
  ON public.ranking_answer_votes (concurso_id);

CREATE TABLE IF NOT EXISTS public.provisional_gabarito_leaders (
  concurso_id uuid NOT NULL REFERENCES public.concursos(id) ON DELETE CASCADE,
  booklet_id text NOT NULL,
  question_number integer NOT NULL,
  leader_answer text NOT NULL,
  leader_votes integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (concurso_id, booklet_id, question_number)
);

CREATE INDEX IF NOT EXISTS idx_provisional_gabarito_leaders_concurso
  ON public.provisional_gabarito_leaders (concurso_id);

ALTER TABLE public.ranking_answer_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provisional_gabarito_leaders ENABLE ROW LEVEL SECURITY;

-- Leitura agregada permitida para autenticados; escrita só via RPC SECURITY DEFINER
DROP POLICY IF EXISTS ranking_answer_votes_select ON public.ranking_answer_votes;
CREATE POLICY ranking_answer_votes_select ON public.ranking_answer_votes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS provisional_gabarito_leaders_select ON public.provisional_gabarito_leaders;
CREATE POLICY provisional_gabarito_leaders_select ON public.provisional_gabarito_leaders
  FOR SELECT TO authenticated USING (true);
