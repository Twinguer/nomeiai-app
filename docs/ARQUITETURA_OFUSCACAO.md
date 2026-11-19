# Arquitetura de Ofuscação de URLs

## Resumo

O sistema de ofuscação usa uma arquitetura onde:
- **Backend**: Usa **UMA chave única** para validar todos os tokens
- **Frontend**: Usa **4 variáveis de ambiente** (todas com o **MESMO valor**)

## Backend (Supabase)

### Armazenamento
- **Localização**: Tabela `app_config` no Supabase
- **Chave**: `obfuscation_key`
- **Função**: `get_obfuscation_key()` retorna a chave única

### Uso
Todas as funções de validação usam a mesma chave:
- `validate_user_token()`
- `validate_concurso_token()`
- `validate_study_cycle_token()`
- `validate_community_token()`
- `validate_admin_token()`

## Frontend (Vite)

### Variáveis de Ambiente

O frontend usa **4 variáveis diferentes**, mas todas devem ter o **MESMO valor**:

1. **`VITE_OBFUSCATION_KEY`**
   - Usado por: `userUrlObfuscation.ts`
   - Para: Tokens de usuário

2. **`VITE_URL_OBFUSCATION_KEY`**
   - Usado por: `urlObfuscation.ts` e `studyCycleUrlObfuscation.ts`
   - Para: Tokens de rankings e ciclos de estudo (coach)

3. **`VITE_ADMIN_OBFUSCATION_KEY`**
   - Usado por: `adminUrlObfuscation.ts`
   - Para: Tokens de admin

4. **`VITE_COMMUNITY_OBFUSCATION_KEY`**
   - Usado por: `communityUrlObfuscation.ts`
   - Para: Tokens da comunidade

### Por que 4 variáveis?

Cada serviço tem sua própria variável para:
- **Organização**: Facilita identificar qual serviço está usando qual chave
- **Flexibilidade futura**: Permite usar chaves diferentes se necessário (não recomendado)
- **Clareza**: Deixa explícito qual variável cada serviço usa

### ⚠️ IMPORTANTE

**Todas as 4 variáveis DEVEM ter o MESMO valor da chave do backend!**

Se os valores forem diferentes:
- Tokens gerados no frontend não serão validados no backend
- Acesso será negado
- Erro: "Token inválido ou expirado"

## Fluxo de Validação

1. **Frontend gera token** usando uma das 4 variáveis
2. **Token é enviado** para o backend via RPC
3. **Backend valida token** usando `get_obfuscation_key()`
4. **Se chaves correspondem**: Token válido ✅
5. **Se chaves não correspondem**: Token inválido ❌

## Configuração

### Atualizar Chave

1. **Backend (Supabase)**:
   ```sql
   SELECT update_obfuscation_key('sua_chave_aqui');
   ```

2. **Frontend (.env)**:
   ```bash
   VITE_OBFUSCATION_KEY=sua_chave_aqui
   VITE_URL_OBFUSCATION_KEY=sua_chave_aqui
   VITE_ADMIN_OBFUSCATION_KEY=sua_chave_aqui
   VITE_COMMUNITY_OBFUSCATION_KEY=sua_chave_aqui
   ```

3. **Rebuild**:
   ```bash
   npm run build
   ```

4. **Reiniciar servidor**:
   ```bash
   pm2 restart nomeiai --update-env
   ```

## Verificação

### Verificar Backend
```sql
SELECT get_obfuscation_key();
```

### Verificar Frontend
```bash
grep VITE_.*OBFUSCATION_KEY .env
```

### Verificar Sincronização
Todas as variáveis devem ter o mesmo valor da chave do backend.

## Troubleshooting

### "Token inválido ou expirado"

1. Verifique se todas as 4 variáveis do frontend têm o mesmo valor
2. Verifique se o valor corresponde à chave do backend
3. Faça rebuild completo: `rm -rf dist && npm run build`
4. Limpe cache do navegador
5. Reinicie o servidor

### Apenas rankings funcionam

- Rankings usam `VITE_URL_OBFUSCATION_KEY`
- Se apenas rankings funcionam, outras variáveis podem estar diferentes
- Verifique todas as 4 variáveis no `.env`
- Faça rebuild completo

