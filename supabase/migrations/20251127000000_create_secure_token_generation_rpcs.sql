-- =====================================================
-- MIGRATION: Criar RPCs para geração segura de tokens
-- OBJETIVO: Mover geração de tokens do frontend para backend
-- DATA: 2025-11-27
-- =====================================================
-- 
-- ✅ SEGURANÇA: Esta migration cria RPCs que geram tokens no backend,
-- eliminando a necessidade de expor a chave de ofuscação no frontend.
-- 
-- Os tokens são armazenados em uma tabela temporária e validados
-- sem expor a estrutura interna.
-- =====================================================

begin;

-- =====================================================
-- TABELA: secure_url_tokens
-- Armazena tokens gerados no backend
-- =====================================================
create table if not exists public.secure_url_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  entity_type text not null check (entity_type in ('user', 'concurso', 'community', 'study_cycle', 'admin', 'edit')),
  entity_id uuid not null,
  metadata jsonb default '{}'::jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  revoked_at timestamptz
);

-- Índices para performance
create index if not exists idx_secure_url_tokens_token_hash on public.secure_url_tokens(token_hash);
create index if not exists idx_secure_url_tokens_entity on public.secure_url_tokens(entity_type, entity_id);
create index if not exists idx_secure_url_tokens_expires_at on public.secure_url_tokens(expires_at);
create index if not exists idx_secure_url_tokens_active on public.secure_url_tokens(expires_at, revoked_at) 
  where revoked_at is null;

-- RLS: Apenas o sistema pode acessar (via SECURITY DEFINER)
alter table public.secure_url_tokens enable row level security;

create policy "Only system can access secure tokens"
  on public.secure_url_tokens
  for all
  using (false)
  with check (false);

comment on table public.secure_url_tokens is 'Armazena tokens seguros gerados no backend para ofuscação de URLs.';

-- =====================================================
-- FUNÇÃO: Gerar hash seguro de token
-- =====================================================
create or replace function generate_token_hash()
returns text
language plpgsql
immutable
as $$
declare
  v_random_bytes bytea;
  v_hash text;
begin
  -- Gerar 32 bytes aleatórios
  v_random_bytes := gen_random_bytes(32);
  
  -- Converter para base64 URL-safe
  v_hash := encode(v_random_bytes, 'base64');
  
  -- Remover caracteres não-URL-safe e truncar para 43 caracteres (tamanho padrão base64)
  v_hash := replace(replace(v_hash, '+', '-'), '/', '_');
  v_hash := rtrim(v_hash, '=');
  
  return v_hash;
end;
$$;

comment on function generate_token_hash() is 'Gera um hash seguro e aleatório para uso em tokens de URL.';

-- =====================================================
-- RPC: Gerar token seguro
-- =====================================================
create or replace function generate_secure_token(
  p_entity_type text,
  p_entity_id uuid,
  p_metadata jsonb default '{}'::jsonb,
  p_expires_in_minutes integer default 1440 -- 24 horas padrão
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token_hash text;
  v_expires_at timestamptz;
  v_token_id uuid;
begin
  -- Validar entrada
  if p_entity_type is null or p_entity_id is null then
    raise exception 'entity_type e entity_id são obrigatórios';
  end if;
  
  if p_entity_type not in ('user', 'concurso', 'community', 'study_cycle', 'admin', 'edit') then
    raise exception 'entity_type inválido: %', p_entity_type;
  end if;
  
  -- Validar que a entidade existe
  case p_entity_type
    when 'user' then
      if not exists (select 1 from users_profiles where id = p_entity_id) then
        raise exception 'Usuário não encontrado: %', p_entity_id;
      end if;
    when 'concurso' then
      if not exists (select 1 from concursos where id = p_entity_id) then
        raise exception 'Concurso não encontrado: %', p_entity_id;
      end if;
    when 'study_cycle' then
      if not exists (select 1 from user_study_v2 where id = p_entity_id) then
        raise exception 'Ciclo de estudo não encontrado: %', p_entity_id;
      end if;
    else
      -- Para outros tipos, apenas validar que não é null
      null;
  end case;
  
  -- Gerar hash único
  loop
    v_token_hash := generate_token_hash();
    exit when not exists (select 1 from secure_url_tokens where token_hash = v_token_hash);
  end loop;
  
  -- Calcular expiração
  v_expires_at := now() + (p_expires_in_minutes || ' minutes')::interval;
  
  -- Inserir token
  insert into secure_url_tokens (
    token_hash,
    entity_type,
    entity_id,
    metadata,
    expires_at
  ) values (
    v_token_hash,
    p_entity_type,
    p_entity_id,
    coalesce(p_metadata, '{}'::jsonb),
    v_expires_at
  ) returning id into v_token_id;
  
  return v_token_hash;
  
exception
  when others then
    raise exception 'Erro ao gerar token: %', sqlerrm;
end;
$$;

comment on function generate_secure_token(text, uuid, jsonb, integer) is 
  'Gera um token seguro no backend. Retorna hash do token que pode ser usado em URLs.';

grant execute on function generate_secure_token(text, uuid, jsonb, integer) to authenticated, anon;

-- =====================================================
-- RPC: Resolver token seguro (validar e retornar dados)
-- =====================================================
create or replace function resolve_secure_token(
  p_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token_record record;
  v_result jsonb;
begin
  -- Validar entrada
  if p_token_hash is null or p_token_hash = '' then
    return null;
  end if;
  
  -- Buscar token
  select 
    id,
    token_hash,
    entity_type,
    entity_id,
    metadata,
    expires_at,
    used_at,
    revoked_at
  into v_token_record
  from secure_url_tokens
  where token_hash = p_token_hash;
  
  -- Token não encontrado
  if not found then
    return null;
  end if;
  
  -- Token revogado
  if v_token_record.revoked_at is not null then
    return null;
  end if;
  
  -- Token expirado
  if v_token_record.expires_at < now() then
    -- Marcar como usado (para limpeza futura)
    update secure_url_tokens
    set used_at = now()
    where id = v_token_record.id;
    
    return null;
  end if;
  
  -- Marcar como usado
  update secure_url_tokens
  set used_at = coalesce(used_at, now())
  where id = v_token_record.id;
  
  -- Retornar dados do token
  v_result := jsonb_build_object(
    'entity_type', v_token_record.entity_type,
    'entity_id', v_token_record.entity_id,
    'metadata', v_token_record.metadata
  );
  
  -- Adicionar campos específicos baseados no tipo
  case v_token_record.entity_type
    when 'community' then
      -- Para community, metadata deve ter 'action'
      if v_token_record.metadata ? 'action' then
        v_result := v_result || jsonb_build_object('action', v_token_record.metadata->>'action');
      end if;
    else
      null;
  end case;
  
  return v_result;
  
exception
  when others then
    return null;
end;
$$;

comment on function resolve_secure_token(text) is 
  'Valida e resolve um token seguro. Retorna JSONB com dados da entidade ou NULL se inválido/expirado.';

grant execute on function resolve_secure_token(text) to authenticated, anon;

-- =====================================================
-- FUNÇÃO: Limpar tokens expirados (manutenção)
-- =====================================================
create or replace function cleanup_expired_tokens()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted_count integer;
begin
  -- Deletar tokens expirados há mais de 7 dias
  delete from secure_url_tokens
  where expires_at < now() - interval '7 days';
  
  get diagnostics v_deleted_count = row_count;
  
  return v_deleted_count;
end;
$$;

comment on function cleanup_expired_tokens() is 
  'Remove tokens expirados há mais de 7 dias. Retorna número de tokens removidos.';

grant execute on function cleanup_expired_tokens() to service_role;

commit;

