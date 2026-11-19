-- Remove automação pg_cron/Vault; sincronização manual via painel admin.

DO $unschedule$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    BEGIN
      PERFORM cron.unschedule('sync-pci-concursos-weekdays');
    EXCEPTION
      WHEN OTHERS THEN NULL;
    END;
  END IF;
END;
$unschedule$;

DROP FUNCTION IF EXISTS public.invoke_sync_pci_concursos_edge();

DROP POLICY IF EXISTS pci_concurso_feed_sync_runs_select_admin ON public.pci_concurso_feed_sync_runs;
CREATE POLICY pci_concurso_feed_sync_runs_select_admin ON public.pci_concurso_feed_sync_runs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );

GRANT SELECT ON public.pci_concurso_feed_sync_runs TO authenticated;
