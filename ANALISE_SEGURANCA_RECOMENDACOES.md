# Análise de Segurança - Recomendações de Implementação

## 📋 Resumo Executivo

Este documento analisa as sugestões de segurança críticas e de alta prioridade para o sistema Convoca AI, fornecendo status atual, riscos identificados e recomendações de implementação.

---

## 🔴 CRÍTICO

### 1. Remover 'unsafe-inline' e 'unsafe-eval' do CSP

**Status Atual:**
- ✅ **Produção**: Já removido `unsafe-inline` e `unsafe-eval` do `script-src` (linha 81 de `securityHeaders.ts`)
- ⚠️ **Desenvolvimento**: Ainda contém ambos (linha 71)
- ⚠️ **Default Config**: Contém ambos (linha 18)

**Risco:**
- `unsafe-inline` permite XSS via inline scripts
- `unsafe-eval` permite execução de código dinâmico (eval, Function constructor)

**Recomendações:**
1. ✅ **Já implementado em produção** - O CSP de produção está correto
2. ⚠️ **Ação necessária**: Remover de desenvolvimento também (ou usar nonce/hash)
3. ⚠️ **Ação necessária**: Atualizar DEFAULT_CONFIG para remover ambos

**Implementação:**
```typescript
// src/utils/securityHeaders.ts
// Linha 18 - Atualizar DEFAULT_CONFIG
contentSecurityPolicy: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co; frame-ancestors 'none';"

// Linha 71 - Atualizar getDevelopmentHeaders
contentSecurityPolicy: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' http://localhost:* https://*.supabase.co; frame-ancestors 'none';"
```

**Nota:** `style-src 'unsafe-inline'` é necessário para frameworks CSS-in-JS como Tailwind. Se possível, usar nonces.

---

### 2. Mover validação de tokens para backend

**Status Atual:**
- ❌ **Validação de tokens está no frontend** em múltiplos lugares:
  - `src/services/userUrlObfuscation.ts` - `validateUserToken()` (linha 56)
  - `src/services/urlObfuscation.ts` - `validateConcursoToken()`
  - `src/services/studyCycleUrlObfuscation.ts` - `validateStudyCycleToken()`
  - `src/services/communityUrlObfuscation.ts` - `validateCommunityToken()`
  - `src/services/adminUrlObfuscation.ts` - `validateAdminToken()`

**Risco:**
- Tokens podem ser manipulados no frontend
- Lógica de validação exposta
- Chave de ofuscação exposta no código (`getOBFUSCATION_KEY()`)
- Validação pode ser contornada

**Recomendações:**
1. **Criar RPCs no Supabase** para validação de tokens:
   - `validate_user_token(token)`
   - `validate_concurso_token(token)`
   - `validate_study_cycle_token(token, user_id)`
   - `validate_community_token(token)`
   - `validate_admin_token(token)`

2. **Mover chave de ofuscação** para variável de ambiente no backend

3. **Atualizar serviços frontend** para chamar RPCs em vez de validar localmente

**Implementação Sugerida:**
```sql
-- Migration: criar RPCs de validação
CREATE OR REPLACE FUNCTION validate_user_token(token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_id UUID;
  obfuscation_key TEXT := current_setting('app.obfuscation_key', true);
BEGIN
  -- Decodificar e validar token
  -- Retornar user_id se válido, NULL se inválido
  -- ...
END;
$$;
```

**Prioridade:** 🔴 **ALTA** - Implementar imediatamente

---

### 3. Implementar rate limiting no backend

**Status Atual:**
- ✅ **Já implementado parcialmente:**
  - Edge Functions: `supabase/functions/_shared/rateLimiter.ts`
  - Database: Função `check_rate_limit()` em múltiplas migrations
  - Frontend: `src/utils/rateLimiter.ts` e `src/hooks/useRateLimiting.tsx`

**Risco:**
- Rate limiting no frontend pode ser contornado
- Edge Functions têm rate limiting, mas precisa verificar cobertura

**Recomendações:**
1. ✅ **Manter rate limiting no backend** (já implementado)
2. ⚠️ **Verificar cobertura**: Garantir que todas as operações críticas usam rate limiting
3. ⚠️ **Revisar configurações**: Ajustar limites conforme necessário
4. ⚠️ **Monitorar**: Adicionar logging e alertas para tentativas de bypass

**Ações:**
- [ ] Auditoria de todas as RPCs para garantir rate limiting
- [ ] Revisar limites atuais (50 inserts/min, 100 updates/min)
- [ ] Adicionar rate limiting para operações de autenticação no backend

**Prioridade:** 🟡 **MÉDIA** - Melhorar cobertura

---

## 🟠 ALTO

### 4. Sanitizar ou remover dangerouslySetInnerHTML

**Status Atual:**
- ⚠️ **1 uso encontrado**: `src/components/ui/chart.tsx` (linha 79)
- Uso: Geração dinâmica de CSS para temas de gráficos

**Risco:**
- XSS se conteúdo não for sanitizado
- Injeção de código CSS malicioso

**Recomendações:**
1. **Opção 1 (Recomendada)**: Remover `dangerouslySetInnerHTML` e usar CSS-in-JS ou classes Tailwind
2. **Opção 2**: Se necessário manter, sanitizar com DOMPurify ou similar

**Implementação:**
```typescript
// src/components/ui/chart.tsx
// Substituir dangerouslySetInnerHTML por:
// 1. Usar CSS variables via style prop
// 2. Ou usar biblioteca de sanitização (DOMPurify)
```

**Prioridade:** 🟠 **ALTA** - Implementar sanitização ou remover

---

### 5. Remover URL hardcoded do Supabase

**Status Atual:**
- ✅ **Já implementado corretamente**: `src/integrations/supabase/client.ts`
- ✅ Usa variáveis de ambiente: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
- ✅ Validação de URL inválida (linha 35-40)
- ⚠️ **Mensagem de erro contém URL hardcoded** (linha 36) - apenas para referência, não é usado

**Risco:**
- Baixo - URL está em variável de ambiente
- Mensagem de erro menciona URL, mas não é usada como fallback

**Recomendações:**
1. ✅ **Já está correto** - Não há URL hardcoded sendo usada
2. ⚠️ **Opcional**: Remover URL da mensagem de erro para evitar exposição

**Prioridade:** 🟢 **BAIXA** - Já implementado corretamente

---

### 6. Adicionar SRI ao script externo

**Status Atual:**
- ❌ **Script externo sem SRI**: `index.html` linha 19
  ```html
  <script src="https://cdn.gpteng.co/gptengineer.js" type="module"></script>
  ```

**Risco:**
- Script pode ser comprometido no CDN
- XSS se CDN for comprometido
- Man-in-the-middle attacks

**Recomendações:**
1. **Obter hash SRI** do script:
   ```bash
   curl -s https://cdn.gpteng.co/gptengineer.js | openssl dgst -sha384 -binary | openssl base64 -A
   ```

2. **Adicionar integrity e crossorigin**:
   ```html
   <script 
     src="https://cdn.gpteng.co/gptengineer.js" 
     type="module"
     integrity="sha384-<HASH_AQUI>"
     crossorigin="anonymous">
   </script>
   ```

3. **Alternativa**: Se script não for crítico, considerar remover

**Prioridade:** 🟠 **MÉDIA** - Implementar SRI ou remover script

---

### 7. Revisar uso de localStorage para dados sensíveis

**Status Atual:**
- ⚠️ **Múltiplos usos de localStorage** (92 ocorrências):
  - Tokens de ofuscação (user, concurso, study cycle, community, admin)
  - Estado de autenticação (lockout, password recovery)
  - Timer state
  - Rate limiting data
  - Logs de debug

**Risco:**
- Tokens armazenados em localStorage são vulneráveis a XSS
- Dados sensíveis podem ser acessados por scripts maliciosos
- localStorage persiste entre sessões

**Recomendações:**

#### 7.1. Tokens de Ofuscação
- ⚠️ **Risco**: Tokens armazenados em localStorage podem ser roubados via XSS
- ✅ **Ação**: Considerar usar sessionStorage (expira ao fechar aba)
- ✅ **Ação**: Implementar validação no backend (já recomendado acima)

#### 7.2. Estado de Autenticação
- ⚠️ **Risco**: `auth_lockout_end` e `is_password_recovery` em localStorage
- ✅ **Ação**: Mover para sessionStorage ou cookies httpOnly (backend)

#### 7.3. Timer State
- ✅ **OK**: Dados não sensíveis, localStorage é apropriado

#### 7.4. Rate Limiting Data
- ⚠️ **Risco**: Pode ser manipulado no frontend
- ✅ **Ação**: Rate limiting deve ser no backend (já implementado)
- ✅ **Ação**: Remover rate limiting do frontend ou usar apenas como UX

#### 7.5. Logs de Debug
- ⚠️ **Risco**: Pode conter informações sensíveis
- ✅ **Ação**: Remover em produção ou sanitizar

**Implementação Prioritária:**
```typescript
// 1. Mover tokens para sessionStorage
sessionStorage.setItem(`user_token_${token}`, JSON.stringify(tokenData));

// 2. Remover dados sensíveis de localStorage
// 3. Usar cookies httpOnly para dados críticos (requer backend)
```

**Prioridade:** 🟠 **ALTA** - Revisar e migrar dados sensíveis

---

## 📊 Priorização de Implementação

### Fase 1 - Crítico (Imediato)
1. ✅ **CSP** - Já corrigido em produção, remover de dev/default
2. 🔴 **Validação de Tokens** - Mover para backend (RPCs)
3. 🟡 **Rate Limiting** - Auditoria e melhorar cobertura

### Fase 2 - Alto (Próxima Sprint)
4. 🟠 **dangerouslySetInnerHTML** - Sanitizar ou remover
5. 🟠 **localStorage Sensível** - Migrar para sessionStorage/cookies
6. 🟠 **SRI** - Adicionar ou remover script externo

### Fase 3 - Melhorias (Backlog)
7. 🟢 **URL Hardcoded** - Já corrigido, apenas limpeza opcional

---

## 🔧 Checklist de Implementação

### Crítico
- [ ] Remover `unsafe-inline` e `unsafe-eval` de DEFAULT_CONFIG e desenvolvimento
- [ ] Criar RPCs de validação de tokens no Supabase
- [ ] Mover chave de ofuscação para variável de ambiente
- [ ] Atualizar serviços frontend para usar RPCs
- [ ] Auditoria de rate limiting em todas as RPCs críticas

### Alto
- [ ] Sanitizar ou remover `dangerouslySetInnerHTML` em chart.tsx
- [ ] Migrar tokens de localStorage para sessionStorage
- [ ] Migrar dados sensíveis de autenticação para sessionStorage/cookies
- [ ] Adicionar SRI ao script externo ou remover
- [ ] Revisar e limpar logs de debug em produção

---

## 📝 Notas Adicionais

1. **CSP em Produção**: Já está correto, apenas precisa remover de dev/default
2. **Rate Limiting**: Já implementado no backend, precisa auditoria
3. **Validação de Tokens**: É a vulnerabilidade mais crítica - implementar imediatamente
4. **localStorage**: Muitos usos, priorizar tokens e dados de autenticação
5. **Script Externo**: Verificar se `gptengineer.js` é realmente necessário

---

## 🔗 Referências

- [OWASP Content Security Policy](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/11-Client_Side_Testing/05-Testing_for_Content_Security_Policy)
- [OWASP XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [Subresource Integrity](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity)
- [localStorage Security](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage#security)

