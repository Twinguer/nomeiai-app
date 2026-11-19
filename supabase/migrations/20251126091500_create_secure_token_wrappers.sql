-- =====================================================
-- Migration: Secure token validation wrappers
-- Objetivo: expor novas funções *_secure usadas pelo frontend
-- Data: 2025-11-26
-- =====================================================

begin;

-- -----------------------------------------------------
-- validate_user_token_secure
-- -----------------------------------------------------
drop function if exists validate_user_token_secure(text);

create or replace function validate_user_token_secure(p_token text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  v_user_id := validate_user_token(p_token);
  if v_user_id is null then
    return null;
  end if;
  return v_user_id::text;
exception
  when others then
    return null;
end;
$$;

comment on function validate_user_token_secure(text) is 'Wrapper seguro que valida token de usuário e retorna UUID como texto.';

grant execute on function validate_user_token_secure(text) to anon, authenticated;

-- -----------------------------------------------------
-- validate_community_token_secure
-- -----------------------------------------------------
drop function if exists validate_community_token_secure(text);

create or replace function validate_community_token_secure(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload jsonb;
begin
  v_payload := validate_community_token(p_token);
  return v_payload;
exception
  when others then
    return null;
end;
$$;

comment on function validate_community_token_secure(text) is 'Wrapper seguro que valida token da comunidade e retorna JSONB com user_id/action.';

grant execute on function validate_community_token_secure(text) to anon, authenticated;

-- -----------------------------------------------------
-- validate_study_cycle_token_secure
-- -----------------------------------------------------
drop function if exists validate_study_cycle_token_secure(text, uuid);

create or replace function validate_study_cycle_token_secure(p_token text, p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle_id uuid;
begin
  v_cycle_id := validate_study_cycle_token(p_token, p_user_id);
  if v_cycle_id is null then
    return null;
  end if;
  return v_cycle_id::text;
exception
  when others then
    return null;
end;
$$;

comment on function validate_study_cycle_token_secure(text, uuid) is 'Wrapper seguro que valida token de ciclo de estudo e retorna UUID como texto.';

grant execute on function validate_study_cycle_token_secure(text, uuid) to authenticated;

commit;


