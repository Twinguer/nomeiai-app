-- Agendamento seg–sex do scrap PCI via Edge Function sync-pci-concursos
-- Requer secrets no Vault: supabase_url, service_role_key (ver scripts/setup-pci-sync-automation.mjs)

CREATE OR REPLACE FUNCTION public.invoke_sync_pci_concursos_edge()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_base_url text;
  v_cron_secret text;
  v_request_id bigint;
BEGIN
  SELECT decrypted_secret INTO v_base_url
  FROM vault.decrypted_secrets
  WHERE name = 'supabase_url'
  LIMIT 1;

  SELECT decrypted_secret INTO v_cron_secret
  FROM vault.decrypted_secrets
  WHERE name = 'pci_sync_cron_secret'
  LIMIT 1;

  IF v_base_url IS NULL OR v_cron_secret IS NULL THEN
    RAISE EXCEPTION 'Vault: crie secrets supabase_url e pci_sync_cron_secret (rode node scripts/setup-pci-sync-automation.mjs)';
  END IF;

  SELECT net.http_post(
    url := rtrim(v_base_url, '/') || '/functions/v1/sync-pci-concursos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', v_cron_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.invoke_sync_pci_concursos_edge() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invoke_sync_pci_concursos_edge() TO service_role;

COMMENT ON FUNCTION public.invoke_sync_pci_concursos_edge IS
  'Dispara POST na Edge Function sync-pci-concursos (uso interno / pg_cron).';

DO $schedule$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    RAISE NOTICE 'pg_cron não habilitado.';
    RETURN;
  END IF;

  BEGIN
    PERFORM cron.unschedule('sync-pci-concursos-weekdays');
  EXCEPTION
    WHEN OTHERS THEN NULL;
  END;

  -- 09:00 UTC ≈ 06:00 BRT | seg(1) a sex(5)
  PERFORM cron.schedule(
    'sync-pci-concursos-weekdays',
    '0 9 * * 1-5',
    $cmd$SELECT public.invoke_sync_pci_concursos_edge();$cmd$
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Não foi possível agendar sync-pci-concursos-weekdays: %', SQLERRM;
END;
$schedule$;
