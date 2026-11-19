-- Fix missing search_path in SQL functions
-- This migration adds search_path to functions that don't have it

-- 1. Fix functions that are missing search_path entirely
-- (This is a template - actual functions will be identified by the audit script)

-- Example pattern for fixing functions:
-- ALTER FUNCTION function_name(argument_types) SET search_path = public;

-- 2. Add search_path to commonly used functions that might be missing it
-- (These are examples based on common patterns in the codebase)

-- Fix upsert_user_study_data if missing search_path
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname = 'upsert_user_study_data'
          AND p.prokind = 'f'
          AND (p.proconfig IS NULL OR NOT EXISTS (
            SELECT 1 FROM unnest(p.proconfig) AS config 
            WHERE config LIKE 'search_path=%'
          ))
    ) THEN
        ALTER FUNCTION public.upsert_user_study_data(uuid, jsonb) SET search_path = public;
    END IF;
END $$;

-- Fix get_user_study_data if missing search_path
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname = 'get_user_study_data'
          AND p.prokind = 'f'
          AND (p.proconfig IS NULL OR NOT EXISTS (
            SELECT 1 FROM unnest(p.proconfig) AS config 
            WHERE config LIKE 'search_path=%'
          ))
    ) THEN
        ALTER FUNCTION public.get_user_study_data(uuid) SET search_path = public;
    END IF;
END $$;

-- Fix add_study_session if missing search_path
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname = 'add_study_session'
          AND p.prokind = 'f'
          AND (p.proconfig IS NULL OR NOT EXISTS (
            SELECT 1 FROM unnest(p.proconfig) AS config 
            WHERE config LIKE 'search_path=%'
          ))
    ) THEN
        ALTER FUNCTION public.add_study_session(uuid, jsonb) SET search_path = public;
    END IF;
END $$;

-- Fix update_study_statistics if missing search_path
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname = 'update_study_statistics'
          AND p.prokind = 'f'
          AND (p.proconfig IS NULL OR NOT EXISTS (
            SELECT 1 FROM unnest(p.proconfig) AS config 
            WHERE config LIKE 'search_path=%'
          ))
    ) THEN
        ALTER FUNCTION public.update_study_statistics(uuid, jsonb) SET search_path = public;
    END IF;
END $$;

-- 3. Add a comment to track this migration
COMMENT ON SCHEMA public IS 'Updated 2025-01-15: Fixed missing search_path in SQL functions for better security and reliability';
