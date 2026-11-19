# Análise: QueryClient e Migração para RPCs

## 📋 Resumo Executivo

**Prioridade:** IMEDIATA  
**Status:** Em Progresso  
**Impacto:** Alto - Segurança, Performance e Manutenibilidade

## 🔍 Problemas Identificados

### 1. QueryClient Não Configurado

**Problema:**
- QueryClient criado sem configurações de cache, retry, staleTime
- Sem otimizações de performance
- Sem controle de garbage collection

**Impacto:**
- Requisições desnecessárias ao banco
- Falhas de rede não são tratadas adequadamente
- Cache não otimizado

**Solução Implementada:**
- ✅ Criado `src/config/queryClient.ts` com configurações adequadas
- ✅ StaleTime: 30 segundos
- ✅ CacheTime: 5 minutos
- ✅ Retry automático com exponential backoff
- ✅ Helper para invalidação otimizada de queries

### 2. Operações Críticas Sem RPC

**Operações Identificadas:**

#### A. Buscar Rankings de Usuários
- **Arquivo:** `src/components/profile/RankingsTab.tsx`
- **Código Atual:**
  ```typescript
  await supabase.from('user_rankings').select(`
    user_id,
    consolidated_data
  `).eq('user_id', userId);
  ```
- **Riscos:**
  - Exposição direta de estrutura JSONB
  - Sem validação de permissões no backend
  - Possível vazamento de dados

#### B. Buscar Perfis Públicos
- **Arquivo:** `src/pages/PublicUserProfile.tsx`
- **Código Atual:**
  ```typescript
  await supabase.from('users_profiles').select('id, name, avatar_url, nickname')
    .eq('id', id).maybeSingle();
  ```
- **Riscos:**
  - Campos sensíveis podem ser expostos
  - Sem controle centralizado de campos públicos
  - Contagem de rankings exposta diretamente

#### C. Buscar Lista de Concursos
- **Arquivo:** `src/modules/rankings/pages/RankingsPage.tsx`
- **Código Atual:**
  ```typescript
  await supabase.from('concursos').select(`
    id, titulo, orgao, banca, ...
  `).eq('is_general_card', true)
  ```
- **Riscos:**
  - Sem paginação otimizada
  - Sem controle de campos públicos
  - Busca não otimizada

### 3. Invalidação de Queries Ineficiente

**Problema:**
- Múltiplas chamadas `invalidateQueries` espalhadas
- Sem padrão consistente
- Pode causar refetch excessivo

**Exemplo:**
```typescript
queryClient.invalidateQueries({ queryKey: ['rankings', concurso.id] });
queryClient.invalidateQueries({ queryKey: ['rankings-v2', concurso.id] });
queryClient.invalidateQueries({ queryKey: ['participant-count-v2', concurso.id] });
// ... mais 5-10 invalidações
```

## ✅ Soluções Implementadas

### 1. QueryClient Configurado

**Arquivo:** `src/config/queryClient.ts`

**Configurações:**
- `staleTime: 30s` - Dados frescos por 30 segundos
- `gcTime: 5min` - Cache mantido por 5 minutos
- `retry: 2` - Retry automático em falhas
- `retryDelay: exponential backoff` - Delay inteligente
- `refetchOnWindowFocus: true` - Atualizar ao focar janela
- `refetchOnReconnect: true` - Atualizar ao reconectar

**Helpers:**
- `invalidateRelatedQueries.concurso(id)` - Invalida todas queries de um concurso
- `invalidateRelatedQueries.user(id)` - Invalida todas queries de um usuário
- `invalidateRelatedQueries.rankings()` - Invalida todas queries de rankings

### 2. RPCs Criados

**Migration:** `supabase/migrations/20250128000000_create_critical_rpcs.sql`

#### A. `get_user_rankings_secure(p_user_id UUID)`
- ✅ Validação de autenticação
- ✅ Verificação de permissões (apenas próprio usuário)
- ✅ Retorna apenas dados necessários
- ✅ Tratamento de erros

#### B. `get_public_user_profile_secure(p_user_id UUID)`
- ✅ Retorna apenas campos públicos
- ✅ Contagem de rankings incluída
- ✅ Acesso público permitido (anon + authenticated)
- ✅ Tratamento de erros

#### C. `get_public_concursos_list(p_limit, p_offset, p_search_text)`
- ✅ Paginação otimizada
- ✅ Busca por texto (titulo, orgao, banca)
- ✅ Retorna apenas campos públicos
- ✅ Contagem total incluída
- ✅ Acesso público permitido

## 📝 Próximos Passos

### Fase 1: Migração de Componentes (PRIORIDADE IMEDIATA)

1. **RankingsTab.tsx**
   - [ ] Substituir `.from('user_rankings')` por `get_user_rankings_secure`
   - [ ] Atualizar tipos TypeScript
   - [ ] Testar funcionalidade

2. **PublicUserProfile.tsx**
   - [ ] Substituir `.from('users_profiles')` por `get_public_user_profile_secure`
   - [ ] Remover contagem manual de rankings
   - [ ] Atualizar tipos TypeScript
   - [ ] Testar funcionalidade

3. **RankingsPage.tsx**
   - [ ] Substituir `.from('concursos')` por `get_public_concursos_list`
   - [ ] Implementar paginação usando RPC
   - [ ] Implementar busca usando RPC
   - [ ] Testar funcionalidade

### Fase 2: Otimizações de Performance

1. **Cache Strategy**
   - [ ] Implementar cache seletivo por tipo de query
   - [ ] Otimizar staleTime por tipo de dado
   - [ ] Implementar prefetch para navegação

2. **Invalidação Otimizada**
   - [ ] Migrar todos os componentes para usar helpers
   - [ ] Implementar invalidação em batch
   - [ ] Reduzir refetch desnecessário

### Fase 3: Outras Operações Críticas

1. **Coach/Student Operations**
   - [ ] Verificar se já usam RPCs
   - [ ] Migrar operações diretas se necessário

2. **Study Groups**
   - [ ] Verificar operações diretas
   - [ ] Criar RPCs se necessário

3. **Notifications**
   - [ ] Verificar operações diretas
   - [ ] Criar RPCs se necessário

## 🔒 Benefícios de Segurança

1. **Validação Centralizada**
   - Todas as validações de permissão no backend
   - Impossível burlar validações do frontend

2. **Controle de Campos**
   - Apenas campos públicos são retornados
   - Estrutura JSONB não exposta diretamente

3. **Proteção contra SQL Injection**
   - Parâmetros validados no backend
   - Queries preparadas

4. **Auditoria**
   - Todas as operações podem ser logadas no backend
   - Rastreamento de acessos

## ⚡ Benefícios de Performance

1. **Redução de Requisições**
   - Cache otimizado reduz requisições desnecessárias
   - StaleTime evita refetch prematuro

2. **Queries Otimizadas**
   - RPCs podem ser otimizados no banco
   - Índices podem ser usados eficientemente

3. **Paginação Eficiente**
   - Paginação no banco (não no frontend)
   - Menos dados transferidos

## 🛠️ Manutenibilidade

1. **Código Centralizado**
   - Lógica de negócio no backend
   - Frontend apenas consome APIs

2. **Fácil Evolução**
   - Mudanças no backend não quebram frontend
   - Versão de APIs pode ser controlada

3. **Testes Simplificados**
   - RPCs podem ser testados isoladamente
   - Frontend testa apenas integração

## 📊 Métricas de Sucesso

- [ ] 100% das operações críticas usando RPCs
- [ ] Redução de 30%+ em requisições desnecessárias
- [ ] Tempo de resposta reduzido em 20%+
- [ ] Zero vazamentos de dados sensíveis
- [ ] Cobertura de testes > 80%

## 🚀 Como Aplicar

1. **Aplicar Migration:**
   ```bash
   # Via Supabase CLI
   supabase migration up
   ```

2. **Atualizar Frontend:**
   - Importar helpers de `src/config/queryClient.ts`
   - Substituir operações diretas por RPCs
   - Testar funcionalidade

3. **Monitorar:**
   - Verificar logs do Supabase
   - Monitorar performance
   - Validar segurança

