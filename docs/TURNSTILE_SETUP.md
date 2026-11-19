# Configuração do Cloudflare Turnstile

## ✅ Status da Implementação

- ✅ Dependência instalada: `@marsidev/react-turnstile`
- ✅ Componente criado: `TurnstileCaptcha.tsx`
- ✅ Integrado no `SignupForm`
- ✅ Validação no backend via Edge Function
- ✅ Chave secreta configurada no banco de dados

## Variáveis de Ambiente

### Frontend (.env.local ou .env)

Adicione a seguinte variável:

```env
VITE_TURNSTILE_SITE_KEY=0x4AAAAAACD_iQ1EmDInHf4E
```

**Importante**: Reinicie o servidor de desenvolvimento após adicionar a variável.

### Backend (Supabase Edge Functions)

A chave secreta já foi configurada no banco de dados via migração `20251202000005_add_turnstile_config.sql`.

A Edge Function `validate-turnstile` usa a chave do banco de dados automaticamente, mas você pode também configurar como secret:

1. Acesse: Supabase Dashboard > Edge Functions > Secrets
2. Adicione: `TURNSTILE_SECRET_KEY` = `0x4AAAAAACD_iSbION01_i3Qx0sL5uQV0xo`

Ou via CLI:

```bash
supabase secrets set TURNSTILE_SECRET_KEY=0x4AAAAAACD_iSbION01_i3Qx0sL5uQV0xo
```

**Nota**: A Edge Function prioriza o secret do ambiente, mas usa o banco de dados como fallback.

## Como Funciona

1. **Frontend**: O componente `TurnstileCaptcha` exibe o widget do Turnstile
2. **Validação**: Quando o usuário completa o captcha, um token é gerado
3. **Backend**: O token é validado via Edge Function `validate-turnstile`
4. **Signup**: Apenas após validação bem-sucedida, o cadastro prossegue

## Arquivos Criados/Modificados

### Novos Arquivos
- `src/components/Security/TurnstileCaptcha.tsx` - Componente do captcha
- `supabase/functions/validate-turnstile/index.ts` - Edge Function de validação
- `supabase/migrations/20251202000005_add_turnstile_config.sql` - Configuração da chave secreta
- `docs/TURNSTILE_SETUP.md` - Esta documentação

### Arquivos Modificados
- `src/components/Auth/SignupForm.tsx` - Adicionado componente Turnstile
- `src/hooks/useSecureAuth.tsx` - Adicionada validação de captcha
- `package.json` - Adicionada dependência `@marsidev/react-turnstile`

## Testes

- **Modo de Teste**: As chaves fornecidas são de teste do Cloudflare
- **Sempre passa**: Em modo de teste, o Turnstile sempre retorna sucesso
- **Produção**: Substitua pelas chaves de produção quando estiver pronto

## Troubleshooting

### Captcha não aparece
- Verifique se `VITE_TURNSTILE_SITE_KEY` está configurada
- Verifique o console do navegador para erros
- Reinicie o servidor de desenvolvimento

### Validação falha
- Verifique se a chave secreta está no banco de dados (`app_config`)
- Verifique os logs da Edge Function no Supabase Dashboard
- Em desenvolvimento, a validação pode ser bypassada se não houver chave configurada

### Edge Function não funciona
- Verifique se a função foi deployada: `supabase functions deploy validate-turnstile`
- Verifique os logs: `supabase functions logs validate-turnstile`

## Próximos Passos

1. **Adicionar variável de ambiente**: Configure `VITE_TURNSTILE_SITE_KEY` no `.env.local`
2. **Deploy da Edge Function**: Execute `supabase functions deploy validate-turnstile`
3. **Testar**: Tente criar uma conta e verificar se o captcha aparece e funciona
4. **Produção**: Quando estiver pronto, substitua as chaves de teste pelas de produção
