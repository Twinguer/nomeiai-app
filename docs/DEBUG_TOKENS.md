# 🔍 Debug de Tokens

## Problema

Os tokens de **aluno no modo coach** (study cycle) e **perfil da comunidade** não estão funcionando, mesmo que os tokens de rankings estejam funcionando.

## Funções de Debug Criadas

### 1. Debug de Token de Ciclo de Estudo

```sql
SELECT debug_validate_study_cycle_token('seu_token_aqui', 'user_id_aqui');
```

Esta função retorna informações detalhadas sobre:
- Decodificação do token
- Formato e partes do token
- Validação do user_id
- Comparação de chaves
- Verificação de expiração
- Existência e status do ciclo

### 2. Debug de Token de Comunidade

```sql
SELECT debug_validate_community_token('seu_token_aqui');
```

Esta função retorna informações detalhadas sobre:
- Decodificação do token
- Formato e partes do token
- Comparação de chaves
- Verificação de expiração
- Existência do usuário

## Como Usar

1. **Obter um token de teste**:
   - No console do navegador, gere um token:
   ```javascript
   // Para ciclo de estudo
   const token = await StudyCycleUrlObfuscationService.generateStudyCycleToken('cycle_id', 'user_id');
   console.log(token);
   
   // Para comunidade
   const token = await CommunityUrlObfuscationService.generateCommunityToken('user_id', 'profile');
   console.log(token);
   ```

2. **Executar debug no Supabase SQL Editor**:
   ```sql
   -- Para ciclo de estudo
   SELECT debug_validate_study_cycle_token('token_gerado', 'user_id');
   
   -- Para comunidade
   SELECT debug_validate_community_token('token_gerado');
   ```

3. **Analisar o resultado**:
   - O resultado mostrará exatamente onde está falhando
   - Verifique especialmente:
     - `key_match`: deve ser `true`
     - `expired`: deve ser `false`
     - `cycle_exists` ou `user_exists`: deve ser `true`

## Problemas Comuns

### 1. Chave não corresponde
**Sintoma**: `key_match: false`
**Solução**: Verifique se todas as chaves no `.env.local` são iguais:
```bash
node scripts/configure-all-obfuscation-keys.js
```

### 2. Token expirado
**Sintoma**: `expired: true`
**Solução**: Gere um novo token

### 3. Ciclo não encontrado
**Sintoma**: `cycle_exists: false`
**Possíveis causas**:
- Ciclo não existe na tabela `user_study_v2`
- Ciclo não está ativo (`is_active = false`)
- User ID não corresponde

### 4. Formato inválido
**Sintoma**: `parts_count` diferente de 4
**Solução**: Verifique se o token está sendo gerado corretamente no frontend

## Verificação Rápida

Execute no Supabase SQL Editor:

```sql
-- Verificar chave configurada
SELECT get_obfuscation_key_status();

-- Verificar estrutura da tabela
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_study_v2' 
AND table_schema = 'public';
```

## Próximos Passos

1. Execute o debug com um token real
2. Identifique o erro específico
3. Corrija o problema baseado no erro retornado
4. Teste novamente

