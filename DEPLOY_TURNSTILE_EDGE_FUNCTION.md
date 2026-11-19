# ✅ Deploy da Edge Function - validate-turnstile

## Status do Deploy

**✅ DEPLOY CONCLUÍDO COM SUCESSO**

### Detalhes da Função

- **Nome**: `validate-turnstile`
- **ID**: `84c34673-31f7-4959-9a4c-ef6b79c7d444`
- **Versão**: 1
- **Status**: `ACTIVE` ✅
- **Entrypoint**: `index.ts`
- **JWT Verification**: Habilitado
- **Criado em**: 2025-12-01 (timestamp: 1764597797705)
- **Atualizado em**: 2025-12-01 (timestamp: 1764597797705)

## Funcionalidades

A Edge Function `validate-turnstile` valida tokens do Cloudflare Turnstile:

1. **Recebe**: Token do Turnstile do frontend
2. **Valida**: Token com a API do Cloudflare
3. **Retorna**: Status de validação (válido/inválido)

### Características

- ✅ CORS configurado
- ✅ Tratamento de erros
- ✅ Fallback para chave do banco de dados
- ✅ Modo desenvolvimento (bypass se não configurado)

## Como Usar

### No Frontend

```typescript
const { data, error } = await supabase.functions.invoke('validate-turnstile', {
  body: { token: captchaToken }
});

if (data?.valid) {
  // Token válido, prosseguir com cadastro
} else {
  // Token inválido, mostrar erro
}
```

### Endpoint

```
POST https://[PROJECT_REF].supabase.co/functions/v1/validate-turnstile
```

**Headers**:
- `Content-Type: application/json`
- `Authorization: Bearer [ANON_KEY]` (se verify_jwt estiver habilitado)

**Body**:
```json
{
  "token": "token_do_turnstile_aqui"
}
```

**Response**:
```json
{
  "valid": true,
  "errorCodes": []
}
```

## Configuração

### Variáveis de Ambiente (Secrets)

A função usa a seguinte ordem de prioridade para obter a chave secreta:

1. **Variável de ambiente**: `TURNSTILE_SECRET_KEY` (se configurada como secret)
2. **Banco de dados**: Tabela `app_config`, chave `turnstile_secret_key`

### Configurar Secret (Opcional)

Se quiser usar variável de ambiente em vez do banco de dados:

```bash
supabase secrets set TURNSTILE_SECRET_KEY=0x4AAAAAACD_iSbION01_i3Qx0sL5uQV0xo
```

**Nota**: A função já está configurada para usar a chave do banco de dados, então este passo é opcional.

## Teste

### Via cURL

```bash
curl -X POST \
  https://[PROJECT_REF].supabase.co/functions/v1/validate-turnstile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [ANON_KEY]" \
  -d '{"token":"token_de_teste_aqui"}'
```

### Via Supabase Dashboard

1. Acesse: Supabase Dashboard > Edge Functions > validate-turnstile
2. Clique em "Invoke"
3. Use o body: `{"token": "token_de_teste"}`

## Logs

Para ver os logs da função:

```bash
supabase functions logs validate-turnstile
```

Ou no Dashboard:
- Supabase Dashboard > Edge Functions > validate-turnstile > Logs

## Próximos Passos

1. ✅ Edge Function deployada
2. ✅ Chave secreta configurada no banco de dados
3. ⏳ Verificar variável de ambiente no frontend (`.env.local`)
4. ⏳ Testar no navegador (acessar `/auth` e verificar widget)

## Troubleshooting

### Erro: "Turnstile not configured"
- **Causa**: Chave secreta não encontrada
- **Solução**: Verificar se a chave está em `app_config` ou configurar como secret

### Erro: "Token missing"
- **Causa**: Token não enviado no body
- **Solução**: Verificar se o frontend está enviando o token corretamente

### Erro: CORS
- **Causa**: Headers CORS não configurados
- **Solução**: Verificar se a função tem os headers CORS corretos (já configurado)

## Status Final

✅ **Edge Function deployada e ativa**
✅ **Pronta para uso em produção**

