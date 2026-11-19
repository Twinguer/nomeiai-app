-- Corrige concursos com gabarito oficial salvo mas status ainda em consenso (dados legados)
UPDATE public.concursos
SET gabarito_status = 'final'
WHERE gabarito_status = 'consensus'
  AND official_answers IS NOT NULL
  AND official_answers <> '{}'::jsonb
  AND official_answers <> 'null'::jsonb;

-- Permite visitantes anônimos consultar nota de corte em rankings vitrine (e demais leituras públicas)
GRANT EXECUTE ON FUNCTION public.get_cutoff_projection(uuid) TO anon;
